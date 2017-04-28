/*jslint node: true */
(function (Scanner) {
    "use strict";
    
    var fs = require("fs"),
        logger = require("log4js").getLogger("Scanner"),
        async = require("async"),
        _  = require("underscore"),
        path = require("path"),
        nconf = require("nconf"),
        uuid = require('uuid'),
        crypto = require('crypto'),
        ProgressBar = require('progress'),
        mm,
        groove;
    // groove seems to be better than mm
    try {
      groove = require('groove');
    } catch (ex){
      logger.warn("Optional dependency not installed");
      mm = require('musicmetadata');
    }

    logger.setLevel(nconf.get('logLevel'));

    Scanner.library = function (callback) {
        var audio = [],
            video = [];
        logger.info("loading new entries into library.");
        if (Array.isArray(nconf.get("library"))){
          var folders = nconf.get("library");
          var i = folders.length;

          var scanned = {
            audio: i,
            video: i
          }

          async.each(folders, function(folder, next){
            Scanner.scanFolder(folder, function(ret){
              var finishedType = 1;

              if (ret.isFinishedAll){
                logger.info("directory scanned", folder);
                if (ret.audio){
                  scanned.audio -= 1;
                  finishedType = scanned.audio;
                  logger.info(scanned.audio);
                } else {
                  scanned.video -= 1;
                  finishedType = scanned.video;
                }
              }

              if (finishedType <= 0){
                logger.info("scanned all lib folders", folder);                
                ret.isFinishedAll = true;
              } else {
                ret.isFinishedAll = false;  
              }
              
              callback(ret);
            });
          }, function(ret){
            logger.info("all directories scanned");
          });
        } else {
          var folder = nconf.get("library");
          logger.info('scan unique folder:', folder);
          this.scanFolder(folder, callback);
        }
    };

    Scanner.scanFolder = function(folder, callback) {
      async.parallel({
        audio: function(){
          Scanner.scanAudio(folder, function (err, res, isFinishedAll) {
            logger.debug("Callback scan audio folder");
            callback({audio: res, isFinishedAll: isFinishedAll});
          });
        },
        video: function(){
          Scanner.scanVideo(folder, function (err, res, isFinishedAll) {
            logger.debug("Callback scan video folder");
            callback({video: res, isFinishedAll: isFinishedAll});
          });
        }
      }, function(){

      });
    };

    Scanner.Appenders = function (){

    };

    Scanner.Appenders.video = {
      type: "video",
      append: function (filePath, cb, results) {
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
      }
    };

    Scanner.Appenders.audio = {
      type: "audio",
      append: function (filePath, cb, results) {
          if (_.contains(nconf.get('audio'), path.extname(filePath).replace(".", ""))) {
              if (groove){
                groove.open(filePath, function (err, file) {
                    if (err) {
                        logger.error("filePath: " + filePath, err);
                        return cb(err, results);
                        //throw err;
                    }
                    var libElement = Scanner.song(filePath, file.metadata(), file.duration());
                    results.push(libElement);
                    logger.debug(libElement);

                    file.close(function (err) {
                        if (err) {
                            throw err;
                        }
                    });
                    cb(null, results); // asynchronously call the loop
                });
              } else {
                logger.debug("Loading using mm: ", filePath);
                var parser = mm(fs.createReadStream(filePath), { duration: true }, function (err, metadata) {
                  if (err) throw err;
                });

                parser.on("metadata", function(metadata){
                  if (metadata.picture){
                    metadata.picture = undefined;
                  }
                  var libElement = Scanner.song(filePath, metadata, metadata.duration);
                  results.push(libElement);
                  logger.debug(libElement);
                  return cb(null, results);
                });

                parser.on("done", function(err){
                  if (err){
                    // in error call the loopback
                    logger.warn("Error on parsing metadata on " + filePath);
                    var libElement = Scanner.song(filePath, {}, null);
                    results.push(libElement);
                  
                    return cb(null, results);
                  }
                });
              }
          } else {
              cb(null, results); // asynchronously call the loop
          }

          // callback(null, results, false);
      }
    };

    Scanner.scanVideo = function (apath, callback) {
        this.scan(apath, callback, Scanner.Appenders.video, callback);
    };

    Scanner.scanAudio = function (apath, callback) {
        this.scan(apath, callback, Scanner.Appenders.audio, callback);
    };

    Scanner.scan = function (apath, callback, appender, libraryCallBack) {
        var results = [];
        logger.debug("Scanning " + appender.type + " directory: ".concat(apath));
        
        fs.readdir(apath, function (err, files) {
          var bar = new ProgressBar('  "Scanning ' + apath + '" [:bar] :rate/bps :percent :etas', {
            complete: '=',
            incomplete: ' ',
            width: 20,
            total: files.length
          });
            if (files === undefined){
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
            async.whilst(function () {
                return counter < files.length;
            }, function (cb) {
                var file = files[counter++],
                    newpath = path.join(apath, file);
                bar.tick(1);

                fs.stat(newpath, function (err, stat) {
                    if (err) {
                        return cb(err);
                    }

                    if (stat.isFile()) {
                        logger.debug("File found".concat(newpath));
                        if (appender) {
                            appender.append(newpath, cb, results);
                        }
                    }
                    if (stat.isDirectory()) {
                        Scanner.scan(newpath, cb, appender, libraryCallBack); // recursion loop
                    }

                });
            }, function (err) {
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

    Scanner.song = function (file, metadatas, duration) {
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
        return {
            artist: artist,
            file: file,
            relativePath: typeof nconf.get("library") === 'String' ? file.replace(nconf.get("library"), "") : file,
            title: metadatas.title ? metadatas.title : metadatas.TITLE ? metadatas.TITLE : path.basename(file.replace(nconf.get("library"), "")),
            album: metadatas.album ? metadatas.album : metadatas.ALBUM ? metadatas.ALBUM : "Uknown album",
            metadatas: metadatas,
            duration: durationMin.toString().concat(":").concat(durationSec),
            uid: shasum.digest('hex'),
            encoding: originalEncoding,
            genre: metadatas.genre && metadatas.genre.join ? metadatas.genre.join(",") : "-"
        };
    };


    Scanner.video = function (file, metadatas, duration) {
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


}(exports));
