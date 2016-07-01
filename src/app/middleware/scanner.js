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
        async.parallel({
          audio: function(){
            Scanner.scanAudio(nconf.get("library"), function (err, res, isFinishedAll) {
              logger.debug("Callback scan audio folder");
              callback({audio: res, isFinishedAll: isFinishedAll});
            });
          },
          video: function(){
            Scanner.scanVideo(nconf.get("library"), function (err, res, isFinishedAll) {
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
                  relativePath: filePath.replace(nconf.get("library"), ""),
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
                        console.log("filePath: "+ filePath, err);
                        //return cb(null, results);
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
                  var libElement = Scanner.song(filePath, metadata, metadata.duration);
                  results.push(libElement);
                  logger.debug(libElement);
                  return cb(null, results);
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
        logger.debug("Scanning directory: ".concat(apath));
        fs.readdir(apath, function (err, files) {
            if (files === undefined){
              logger.warn("Not any files found on your library folder.");
              return;
            }
            var counter = 0;
            async.whilst(function () {
                return counter < files.length;
            }, function (cb) {
                var file = files[counter++],
                    newpath = path.join(apath, file);

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
                logger.info("All files " + appender.type + " scanned into " + apath + " finished: " + results.length + " elements found.");
                if (callback !== libraryCallBack){
                  callback(err, results);
                  libraryCallBack(err, results, false);
                }else{
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
        return {
            artist: metadatas.artist ? metadatas.artist : metadatas.ARTIST ? metadatas.ARTIST : "Unknown artist",
            file: file,
            relativePath: file.replace(nconf.get("library"), ""),
            title: metadatas.title ? metadatas.title : metadatas.TITLE ? metadatas.TITLE : path.basename(file.replace(nconf.get("library"), "")),
            album: metadatas.album ? metadatas.album : metadatas.ALBUM ? metadatas.ALBUM : "Uknown album",
            metadatas: metadatas,
            duration: durationMin.toString().concat(":").concat(durationSec),
            uid: shasum.digest('hex'),
            encoding: originalEncoding
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
            relativePath: file.replace(nconf.get("library"), ""),
            title: metadatas.title ? metadatas.title : metadatas.TITLE ? metadatas.TITLE : path.basename(file.replace(nconf.get("library"), "")),
            album: metadatas.album ? metadatas.album : metadatas.ALBUM ? metadatas.ALBUM : "Uknown album",
            metadatas: metadatas,
            duration: durationMin.toString().concat(":").concat(durationSec),
            uid: shasum.digest('hex'),
            encoding: path.extname(file.replace(nconf.get("library"), "")).replace(".", "")
        };
    };


}(exports));
