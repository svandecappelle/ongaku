/*jslint node: true */
const fs = require("fs");
const logger = require("log4js").getLogger("Scanner");
const async = require("async");
const _  = require("underscore");
const communication = require('../communication');
const path = require("path");
const nconf = require("nconf");
const uuid = require('uuid');
const crypto = require('crypto');
const ProgressBar = require('progress');

var groove;
var mm;
// groove seems to be better than mm
try {
  groove = require('groove');
} catch (ex){
  logger.warn("Optional dependency not installed");
  mm = require('musicmetadata');
}

class Appender {

    constructor(type, scanner){
      this.type = type;
      this.scanner = scanner;
      this.song = scanner.song;
    }

    append (filePath, cb, results) {
      if (this.type === 'audio') {
        this.audio(filePath, cb, results);
      } else {
        this.video(filePath, cb, results);
      }
    }

    video (filePath, cb, results) {
      var uuid,
        shasum = crypto.createHash('sha1');
      if (_.contains(nconf.get('video'), path.extname(filePath).replace(".", ""))) {
          shasum.update(filePath);
          uuid = shasum.digest('hex');
          results.push({
              encoding: path.extname(filePath).replace(".", ""),
              uid: uuid.concat(".").concat(path.extname(filePath).replace(".", "")),  /*uuid.v1().concat(".").concat(path.extname(filePath).replace(".", "")),*/
              file: "/video/stream".concat(filePath.replace(nconf.get("library"), "")),
              type: "video",
              name: path.basename(filePath),
              extension: path.extname(filePath).replace(".", ""),
              relativePath: typeof nconf.get("library") === 'String' ? filePath.replace(nconf.get("library"), "") : filePath,
          });
          cb(null, results); // asynchronously call the loop
      } else {
          cb(null, results); // asynchronously call the loop
      }
    };
  
    audio (filePath, cb, results) {
      if (_.contains(nconf.get('audio'), path.extname(filePath).replace(".", ""))) {
          if (groove){
            groove.open(filePath, (err, file) => {
                if (err) {
                    console.log('');
                    logger.error("filePath: " + filePath, err);
                    return cb(err, results);
                    //throw err;
                }
                var libElement = this.song(filePath, file.metadata(), file.duration());
                results.push(libElement);
                logger.debug(libElement);

                file.close( (err) => {
                    if (err) {
                        throw err;
                    }
                });
                return cb(null, results); // asynchronously call the loop
            });
          } else {
            logger.debug("Loading using mm: ", filePath);
            var parser = mm(fs.createReadStream(filePath), { duration: true }, (err, metadata) => {
              if (err) throw err;
            });

            parser.on("metadata", (metadata) => {
              if (metadata.picture){
                metadata.picture = undefined;
              }
              var libElement = this.song(filePath, metadata, metadata.duration);
              results.push(libElement);
              logger.debug(libElement);
              //return cb(null, results);
            });

            parser.on("done", (err) => {
              if (err){
                // in error call the loopback
                console.log('');
                logger.warn("Error on parsing metadata on " + filePath);
                var libElement = this.song(filePath, {}, null);
                results.push(libElement);

              }
              return cb(null, results);
            });
          }
      } else {
          return cb(null, results); // asynchronously call the loop
      }

      // callback(null, results, false);
  }
}

const walkSync = (dir, filelist) => {
  if ( ! filelist ){
    filelist = [];
  }
  fs.readdirSync(dir).forEach(file => {
    filelist = filelist.concat(path.join(dir, file));
    if (fs.statSync(path.join(dir, file)).isDirectory()){
      filelist = walkSync(path.join(dir, file), filelist);
    }
  });
  return filelist;
}

class Scanner {
  
  constructor(){
    this.all_files_count = 0;
    this.scanned_files_count = 0;  
  }

  status () {
    // twice because of scanning directory for audio and video files.
    // TODO search a better method to scan only one time the directories.
    //  logger.error(this.scanned_files_count);
    return this.scanned_files_count * 100 / (this.all_files_count * 2);
  };

  addToScan (folder){
    this.all_files_count += walkSync(folder).length;
  }

  removeToScan (folder){
    this.all_files_count -= walkSync(folder).length;
  }

  library (callback) {
    this.all_files_count = 0;
    this.scanned_files_count = 0;

    var audio = [],
        video = [];
    logger.info("loading new entries into library.");

    if (Array.isArray(nconf.get("library"))){
      var folders = nconf.get("library");
      var i = folders.length;

      var scanned = {
        audio: [],
        video: []
      }

      for (var fold_index = 0; fold_index < folders.length; fold_index++) {
        this.all_files_count += walkSync(folders[fold_index]).length;
      }

      async.each(folders, (folder, next) => {

        logger.debug(this.all_files_count);

        this.scanFolder(folder, (ret) => {
          logger.debug(this.all_files_count);

          var finishedType = 1;

          if (ret.isFinishedAll){
            console.log('');
            logger.debug("directory scanned", folder);
            if (ret.audio){
              scanned.audio.push(folder);
              finishedType = scanned.audio;
            } else {
              scanned.video.push(folder)
              finishedType = scanned.video;
            }
          }

          logger.debug(scanned);

          if (scanned.audio.indexOf(folder) !== -1 && scanned.video.indexOf(folder) !== -1){
            ret.isFinishedAll = true;
            console.log('');


            delete scanned.video[scanned.video.indexOf(folder)];
            delete scanned.audio[scanned.audio.indexOf(folder)];

            logger.debug("scanned all lib folders", folder);
            next(ret);
          } else {
            ret.isFinishedAll = false;
          }
          callback(ret);
        });
      }, function(ret){
        logger.info("all directories scanned", ret);

      });
    } else {
      var folder = nconf.get("library");
      logger.debug('scan unique folder:', folder);
      this.all_files_count = walkSync(folder).length;

      this.scanFolder(folder, callback);
    }
  };

  scanFolder (folder, callback) {
    if (fs.existsSync(folder)){
      async.parallel({
        audio: (next) => {
          this.scanAudio(folder, (err, res, isFinishedAll) => {
            logger.debug("Callback scan audio folder", folder);
            callback({audio: res, isFinishedAll: isFinishedAll});
          });
        },
        video: (next) => {
          this.scanVideo(folder, (err, res, isFinishedAll) => {
            logger.debug("Callback scan video folder");
            callback({video: res, isFinishedAll: isFinishedAll});
          });
        }
      }, function(err, obj){

      });
    } else {
      callback({audio: null, isFinishedAll: true});
      callback({audio: null, isFinishedAll: true});
    }
  };

  scanVideo (apath, callback) {
      this.scan(apath, callback, new Appender("video", this), callback);
  };

  scanAudio (apath, callback) {
      this.scan(apath, callback, new Appender("audio", this), callback);
  };

  scan (apath, callback, appender, libraryCallBack) {
    var results = [];
    logger.debug("Scanning " + appender.type + " directory: ".concat(apath));

    fs.readdir(apath, (err, files) => {
      var bar = new ProgressBar('  "Scanning ' + apath + '" [:bar] :rate/bps :percent :etas', {
        complete: '=',
        incomplete: ' ',
        width: 20,
        total: files.length
      });

      if (files === undefined){
        console.log('');
        logger.warn("Not any files found on your library folder.");
        if (callback !== libraryCallBack) {
          callback(err, results);
          libraryCallBack(err, results, false);
        } else {
          logger.debug("finish lib scan: " + apath + " type: " + appender.type, (callback !== libraryCallBack ? "Not": "") + "Finished");
          libraryCallBack(err, results, callback === libraryCallBack);
        }
        return;
      }
      var counter = 0;
      async.whilst(() => {
          return counter < files.length;
      }, (cb) => {
          var file = files[counter++],
              newpath = path.join(apath, file);
          this.scanned_files_count += 1;
          bar.tick(1);

          fs.stat(newpath, (err, stat) => {
              if (err) {
                  return cb(err);
              }

              if (stat.isFile()) {
                  logger.debug("File found".concat(newpath));
                  if (appender) {
                      return appender.append(newpath, cb, results);
                  }
              } else if (stat.isDirectory()) {
                  return this.scan(newpath, cb, appender, libraryCallBack); // recursion loop
              }

          });
      }, (err) => {
        setTimeout( () => {
          var message = `<div class="progress" style="min-width: 300px; height: 10px;"><div class="progress-bar progress-bar-info progress-bar-striped active" style="width:${this.status()}%"></div></div>`;

          communication.broadcast("library:scanner:progress", {
            close: false,
            message: message,
            value: this.status()
          });
        }, 250);
        if (results.length){
          logger.debug("All files " + appender.type + " scanned into " + apath + " finished: " + results.length + " elements found.");
        }
        if (callback !== libraryCallBack){
          callback(err, results);
          libraryCallBack(err, results, false);
        } else {
          logger.debug("finish lib scan: " + apath + " type: " + appender.type, (callback !== libraryCallBack ? "Not": "") + "Finished");
          libraryCallBack(err, results, callback === libraryCallBack);
        }
      });
    });
  };

  song (file, metadatas, duration) {
      var durationMin = Math.floor(duration / 60),
          durationSec = Math.floor(duration % 60),
          uuid,
          shasum = crypto.createHash('sha1');
      shasum.update(file);
      if (durationSec < 10) {
          durationSec = "0".concat(durationSec);
      }

      var originalEncoding = path.extname(file.replace(nconf.get("library"), "")).replace(".", "");
      if (!_.contains(["mp3", "ogg"], originalEncoding)){
        originalEncoding = "mp3";
      }

      if (metadatas.genre && metadatas.genre.length === 0) {
        metadatas.genre = ["Unknown"];
      }
      var artist = metadatas.artist ? metadatas.artist : metadatas.ARTIST ? metadatas.ARTIST : metadatas.artistalbum ? metadatas.artistalbum : "Unknown artist";
      if (Array.isArray(artist) && artist.length === 1){
        artist = artist[0];
      }

      if (metadatas.ALBUM){
        metadatas.album = metadatas.ALBUM;
      }

      if ( metadatas.TITLE ){
        metadatas.title = metadatas.TITLE;
      }

      if (metadatas.disk && metadatas.disk.of > 1){
        metadatas.album_origin = metadatas.album;
        metadatas.album = `${metadatas.album} Disk - ${metadatas.disk.no}/${metadatas.disk.of}`;
      }


      return {
          artist: artist,
          file: file,
          relativePath: typeof nconf.get("library") === 'String' ? file.replace(nconf.get("library"), "") : file,
          title: metadatas.title ? metadatas.title : path.basename(file.replace(nconf.get("library"), "")),
          album: metadatas.album ? metadatas.album : "Uknown album",
          metadatas: metadatas,
          duration: durationMin.toString().concat(":").concat(durationSec),
          uid: shasum.digest('hex'),
          encoding: originalEncoding,
          genre: metadatas.genre && metadatas.genre.join ? metadatas.genre.join(",") : "-"
      };
  };


  video (file, metadatas, duration) {
      var durationMin = Math.floor(duration / 60),
          durationSec = Math.floor(duration % 60),
          uuid,
          shasum = crypto.createHash('sha1');

      shasum.update(file);

      uuid = shasum.digest('hex');
      if (durationSec < 10) {
          durationSec = "0".concat(durationSec);
      }
      return {
          artist: metadatas.artist ? metadatas.artist : metadatas.ARTIST ? metadatas.ARTIST : "Unknown artist",
          file: file,
          relativePath: typeof nconf.get("library") === 'String' ? file.replace(nconf.get("library"), ""): file,
          title: metadatas.title ? metadatas.title : metadatas.TITLE ? metadatas.TITLE : path.basename(file.replace(nconf.get("library"), "")),
          album: metadatas.album ? metadatas.album : metadatas.ALBUM ? metadatas.ALBUM : "Uknown album",
          metadatas: metadatas,
          duration: durationMin.toString().concat(":").concat(durationSec),
          uid: shasum.digest('hex'),
          encoding: path.extname(file.replace(nconf.get("library"), "")).replace(".", "")
      };
  };
}

module.exports = new Scanner();
