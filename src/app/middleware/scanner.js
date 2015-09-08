/*jslint node: true */
(function (Scanner) {
    "use strict";

    var fs = require("fs"),
        logger = require("log4js").getLogger("Scanner"),
        async = require("async"),
        _  = require("underscore"),
        path = require("path"),
        nconf = require("nconf"),
        mm = require('musicmetadata'),
        // groove seems to be better than mm
        groove = require('groove'),
        uuid = require('uuid');

    logger.setLevel(nconf.get('logLevel'));

    Scanner.library = function (callback) {
        var audio = [],
            video = [];

        logger.info("loading new entries into library.");
        async.parallel({
          audio: function(){
            Scanner.scanAudio(nconf.get("library"), function (err, res, isFinishedAll) {
              logger.info("loading '" + res.length + "' new entries into library.");
              callback({audio: res, isFinishedAll: isFinishedAll});
            });
          },
          video: function(){
            Scanner.scanVideo(nconf.get("library"), function (err, res, isFinishedAll) {
              if (res.length > 0){
                callback({video: res, isFinishedAll: isFinishedAll});
              }
            });
          }
        }, function(){

        });
    };

    Scanner.scanVideo = function (apath, callback) {
        this.scan(apath, callback, function (filePath, cb, results) {
            if (_.contains(nconf.get('video'), path.extname(filePath).replace(".", ""))) {
                results.push({
                    encoding: path.extname(filePath).replace(".", ""),
                    uid: uuid.v1().concat(".").concat(path.extname(filePath).replace(".", "")),
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
        }, callback);
    };

    Scanner.scanAudio = function (apath, callback) {
        this.scan(apath, callback, function (filePath, cb, results) {
            if (_.contains(nconf.get('audio'), path.extname(filePath).replace(".", ""))) {
                groove.open(filePath, function (err, file) {
                    if (err) {
                        throw err;
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
                cb(null, results); // asynchronously call the loop
            }

            //callback(null, results, false);
        }, callback);
    };

    Scanner.scan = function (apath, callback, appender, libraryCallBack) {
        var results = [];
        logger.debug("Scanning directory: ".concat(apath));
        fs.readdir(apath, function (err, files) {
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
                        var metadataParser = mm(fs.createReadStream(newpath));

                        if (appender) {
                            appender(newpath, cb, results);
                        }
                    }
                    if (stat.isDirectory()) {
                        Scanner.scan(newpath, cb, appender, libraryCallBack); // recursion loop
                    }

                });
            }, function (err) {
                logger.debug("Scan " + apath + " finished");
                if (callback !== libraryCallBack){
                    callback(err, results); // loop over, come out
                }
                if (libraryCallBack){
                  libraryCallBack(err, results, callback === libraryCallBack);
                }
            });
        });
    };

    Scanner.song = function (file, metadatas, duration) {
        var durationMin = Math.floor(duration / 60),
            durationSec = Math.floor(duration % 60);
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
            uid: uuid.v1(),
            encoding: originalEncoding
        };
    };


    Scanner.video = function (file, metadatas, duration) {
        var durationMin = Math.floor(duration / 60),
            durationSec = Math.floor(duration % 60);
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
            uid: uuid.v1(),
            encoding: path.extname(file.replace(nconf.get("library"), "")).replace(".", "")
        };
    };


}(exports));
