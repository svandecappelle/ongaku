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

    logger.setLevel("INFO");
    Scanner.library = function (callback) {
        var audio = [],
            video = [],
            that = this;

        this.scanAudio(nconf.get("library"), audio, function () {
            that.scanVideo(nconf.get("library"), video, function () {
                callback({audio: audio, video: video});
            });
        });

    };

    Scanner.scanVideo = function (apath, results, callback) {
        this.scan(apath, results, callback, function (filePath, cb) {
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
        });
    };

    Scanner.scanAudio = function (apath, results, callback) {
        this.scan(apath, results, callback, function (filePath, cb) {
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
        });
    };

    Scanner.scan = function (apath, results, callback, appender) {
        logger.info("Scanning directory: ".concat(apath));
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
                            appender(newpath, cb);
                        }
                    }
                    if (stat.isDirectory()) {
                        Scanner.scan(newpath, results, cb, appender); // recursion loop
                    }
                });
            }, function (err) {
                logger.info("Scan " + apath + " finished");
                callback(err); // loop over, come out
            });
        });
    };

    Scanner.song = function (file, metadatas, duration) {
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