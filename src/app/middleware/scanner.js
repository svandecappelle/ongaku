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

class Decoder {

  constructor(type){
    this.type = type;
  }

  decode (filePath) {
    if (this.type === 'audio') {
      return this.audio(filePath);
    } else {
      return this.video(filePath);
    }
  }

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

/*
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
  };*/

  video (filePath) {
    var uuid,
      shasum = crypto.createHash('sha1');

    return new Promise((resolve, reject) => {
      if (_.contains(nconf.get('video'), path.extname(filePath).replace(".", ""))) {
        shasum.update(filePath);
        uuid = shasum.digest('hex');
        resolve({
            encoding: path.extname(filePath).replace(".", ""),
            uid: uuid.concat(".").concat(path.extname(filePath).replace(".", "")),  /*uuid.v1().concat(".").concat(path.extname(filePath).replace(".", "")),*/
            file: "/video/stream".concat(filePath.replace(nconf.get("library"), "")),
            type: "video",
            name: path.basename(filePath),
            extension: path.extname(filePath).replace(".", ""),
            relativePath: typeof nconf.get("library") === 'String' ? filePath.replace(nconf.get("library"), "") : filePath,
        });
      } else {
        reject({"cause": 'not an video file to listen'}); // asynchronously call the loop
      }
    });
  };

  check (filePath) {
    return _.contains(nconf.get(this.type), path.extname(filePath).replace(".", ""));
  }

  audio (filePath) {
    return new Promise((resolve, reject) => {
      if (_.contains(nconf.get('audio'), path.extname(filePath).replace(".", ""))) {
        logger.debug("Loading using mm: ", filePath);
        try{
          var parser = mm(fs.createReadStream(filePath), { duration: true }, (err, metadata) => {
            logger.debug(`libelement: ${filePath}`, err, metadata)
            if (err) {
              logger.error(`libelement: ${filePath}`, err);
              return reject(err);
            }

            resolve(this.song(filePath, metadata, metadata.duration));
          });
        } catch (error) {
          reject(error);
        }
      } else {
        logger.error(`metadata-check: ${filePath} `)
        reject({"cause": `Not an audio file to listen: ${filePath}`}); // asynchronously call the loop
      }
    });
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
        });
      }, function(ret){
        logger.info("all directories scanned", ret);
        callback(ret);

      });
    } else {
      var folder = nconf.get("library");
      logger.debug('scan unique folder:', folder);
      this.all_files_count = walkSync(folder).length;

      this.scanFolder(folder, callback);
    }
  };

  scanFolder (folder, callback) {
    logger.debug(`scanFolder: ${folder}`);
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
      callback({video: null, isFinishedAll: true});
    }
  };

  scanVideo (apath, callback) {
      this.scan(apath, callback, new Decoder("video", this), callback);
  };

  scanAudio (apath, callback) {
      this.scan(apath, callback, new Decoder("audio", this), callback);
  };

  scan (apath, nextDirectoryCallback, appender, libraryCallBack) {
    logger.debug("Scanning " + appender.type + " directory: ".concat(apath));
    var files = walkSync(apath);
    files = _.filter(files, (file) => {
      return appender.check(file);
    });
    logger.info(files.length);
    var bar = new ProgressBar('  "Scanning ' + apath + '" [:bar] :rate/bps :percent :etas', {
      complete: '=',
      incomplete: ' ',
      width: 20,
      total: files.length
    });

    async.map(files, (file, next) => {
      bar.tick(1);
      appender.decode(file).then((song) => {
        logger.debug("decoded", song);
        next(null, song);
      }, (e)=>{
        logger.error(e);
        next(null, null);
      }).catch((error) => {
        next(null, null);
      });
    }, (err, results) => {
      results = _.compact(results);
      //logger.info(results);
      logger.info("scanned files: ", results.length);
      libraryCallBack(err, results, false);
    })
    /*
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
        if (nextDirectoryCallback !== libraryCallBack) {
          logger.info("finish folder scan: " + apath + " type: " + appender.type);
          nextDirectoryCallback(err, results);
          libraryCallBack(err, [], false);
        } else {
          logger.debug("finish lib scan: " + apath + " type: " + appender.type, (nextDirectoryCallback !== libraryCallBack ? "Not": "") + "Finished");
          libraryCallBack(err, [], callback === libraryCallBack);
        }
        return;
      }
      var counter = 0;
      async.map(files,
        (file, next) => {
          var file = files[counter++],
              newpath = path.join(apath, file);
          this.scanned_files_count += 1;
          bar.tick(1);


          
          fs.stat(newpath, (err, stat) => {
              if (err) {
                logger.error(err);
                return next(err);
              }

              if (stat.isFile()) {
                logger.debug("File found".concat(newpath));
                if (appender) {
                  if (!appender.check(file)){
                    return next('Not a controlled file');
                  }

                  appender.decode(newpath).then((song) => {
                    logger.debug("decoded", song);
                    next(null, song);
                  }).catch(error => {
                    logger.warn("error getting metadatas: ", error);
                    next(error);
                  });
                }
              } else if (stat.isDirectory()) {
                return this.scan(newpath, next, appender, libraryCallBack); // recursion loop
              }
          });
      }, (err, results) => {
        if (err) {
          logger.debug(err);
/*
          _.each(results, (res) => {
            logger.info("#################");
            
            logger.info(res);
            
            logger.info("#################");
          });


          nextDirectoryCallback(err, null);
          libraryCallBack(err, null, nextDirectoryCallback === libraryCallBack);
          return;
        }

        results = _.compact(results);
        results = _.flatten(results);
        logger.debug(apath, results.length);

       
        logger.debug("finish folder scan: " + apath + " type: " + appender.type);
        
        setTimeout( () => {
          var message = `<div class="progress" style="min-width: 300px; height: 10px;"><div class="progress-bar progress-bar-info progress-bar-striped active" style="width:${this.status()}%"></div></div>`;

          communication.broadcast("library:scanner:progress", {
            close: false,
            message: message,
            value: this.status()
          });
        }, 2500);
        if (results.length){
          logger.debug("All files " + appender.type + " scanned into " + apath + " finished: " + results.length + " elements found."); 
        }
        if (nextDirectoryCallback !== libraryCallBack) {

          logger.debug("finish folder scan: " + apath + " type: " + appender.type);
        
          nextDirectoryCallback(err, results);
          libraryCallBack(err, results, false);
        } else {
          logger.info("finish lib scan: " + apath + " type: " + appender.type, (nextDirectoryCallback !== libraryCallBack ? "Not": "") + "Finished");
          nextDirectoryCallback(err, results);
          libraryCallBack(err, results, nextDirectoryCallback === libraryCallBack);
        }
      });
    });*/
  };
}

module.exports = new Scanner();
