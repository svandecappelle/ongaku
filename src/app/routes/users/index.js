/*jslint node: true */
var logger = require('log4js').getLogger("UsersRoutes");
var nconf = require("nconf");
var passport = require("passport");
var _ = require("underscore");

var authentication = require("./../../middleware/authentication"),
    library = require("./../../middleware/library"),
    middleware = require("./../../middleware/middleware"),
    meta = require("./../../meta");

logger.setLevel(nconf.get('logLevel'));


(function (UsersRoutes) {
    "use strict";

    UsersRoutes.checkingAuthorization = function (req, res, callback) {
        meta.settings.getOne("global", "require-authentication", function (err, curValue) {
            if (err) {
                logger.debug("userauth error checking");
                middleware.redirect('403', res);
            } else if (curValue === "true") {
                logger.debug("userauth is required to listen");
                if (middleware.isAuthenticated(req)) {
                    callback();
                } else {
                    logger.warn("Anonymous access forbidden: authentication required to stream");
                    middleware.redirect('403', res);
                }
            } else {
                logger.debug("userauth is not required to listen");
                callback();
            }
        });
    };

    UsersRoutes.load = function (app) {

        authentication.initialize(app);
        authentication.createRoutes(app);

        app.get('/', function (req, res) {
            logger.info("Client access to index [" + req.ip + "]");

            var libraryDatas = library.getAudio();

            logger.debug(libraryDatas);
            middleware.render('songlist', req, res, {library: libraryDatas});

        });

        app.get('/403', function (req, res) {
            middleware.render('403', req, res);
        });

        meta.settings.getOne("global", "require-authentication", function (err, curValue) {
            if (err) {
                logger.debug("userauth error checking");
            } else if (curValue === "true") {
                logger.debug("userauth is required to listen");
            } else {
                logger.debug("userauth is not required to listen");
            }
        });

        app.get('/video', function (req, res) {
            logger.info("Client access to videos [" + req.ip + "]");

            var libraryDatas = library.getVideo();

            logger.debug(libraryDatas);
            middleware.render('videolist', req, res, {library: libraryDatas});
        });

        app.get('/video/stream/:media', function (req, res) {
            // ".ogg": "video/ogg
            // to convert to ogv
            // ffmpeg -i demoreel.mp4 -c:v libtheora -c:a libvorbis demoreel.ogv

            // To webm
            // ffmpeg -i "fichier source" -codec:v libvpx -quality good -cpu-used 0 -b:v 500k -r 25 -qmin 10 -qmax 42 -maxrate 800k -bufsize 1600k -threads 4 -vf scale=-1:360 -an -pass 1 -f webm /dev/null
            // ffmpeg -i "fichier source" -codec:v libvpx -quality good -cpu-used 0 -b:v 500k -r 25 -qmin 10 -qmax 42 -maxrate 800k -bufsize 1600k -threads 4 -vf scale=-1:360 -codec:a libvorbis -b:a 128k -pass 2 -f webm sortie.webm
            var stream = function () {
                logger.info("streaming video");
                middleware.stream(req, res, req.params.media, "video");
            };

            UsersRoutes.checkingAuthorization(req, res, function () {
                stream();
            });
        });

        app.get('/video/library/filter/:search', function (req, res) {
            logger.info("Search filtering video library");
            var libraryDatas = library.search(req.params.search, "video");
            middleware.json(req, res, libraryDatas);
        });

        app.get('/library/filter/:search', function (req, res) {
            logger.info("Search filtering audio library");
            var libraryDatas = library.search(req.params.search, "audio");
            middleware.json(req, res, libraryDatas);
        });

        app.get('/library', function (req, res) {
            logger.info("Get all audio library");
            var libraryDatas = library.getAudio();
            middleware.json(req, res, libraryDatas);
        });


        app.get('/stream/:media', function (req, res) {
            var stream = function () {
                logger.info("streaming audio");
                middleware.stream(req, res, req.params.media, "audio");
            };

            UsersRoutes.checkingAuthorization(req, res, function () {
                stream();
            });
        });

        if (nconf.get("uploader")) {
            var fs = require('fs'),
                busboy = require('connect-busboy');
            //...
            app.use(busboy());
            //...
            app.get('/upload', function (req, res) {
                middleware.render('upload', req, res);
            });

            app.post('/fileupload', function (req, res) {
                var fstream;
                req.pipe(req.busboy);
                req.busboy.on('file', function (fieldname, file, filename) {
                    logger.warn("Uploading: " + filename);
                    fstream = fs.createWriteStream('./video/' + filename);
                    file.pipe(fstream);
                    fstream.on('close', function () {
                        res.redirect('back');
                    });
                });
            });
        }

        // Posts

        app.post('/playlist/add/:uid', function (req, res) {
            // TODO save playlist
            var uidFile = req.params.uid,
                track = library.getByUid(uidFile);
            logger.info("Add file to playlist", uidFile);
            if (req.session.playlist === undefined) {
                req.session.playlist = [];
            }

            if (track !== undefined) {
                req.session.playlist.push(track);
                req.session.save(function () {
                    res.setHeader('Access-Control-Allow-Credentials', 'true');
                    res.send({all: req.session.playlist, lastAdded: track});
                });
            } else {
                logger.warn("A playlist add request returns unknown track for: " + uidFile);
                res.send({all: req.session.playlist, lastAdded: track});
            }
        });

        app.post('/playlist/remove/:id', function (req, res) {
            var id = req.params.id;
            logger.info("Remove file index to playlist: ", id);
            // TODO remove on saved playlist
            if (req.session.playlist !== undefined) {
                req.session.playlist.slice(id, 1);
            }

            req.session.save(function () {
                res.setHeader('Access-Control-Allow-Credentials', 'true');
                res.send({all: req.session.playlist});
            });
        });

        app.post('/playlist/clear', function (req, res) {
            var id = req.params.id;
            // TODO remove on saved playlist
            logger.info("Remove file index to playlist: ", id);
            req.session.playlist = [];
            req.session.save(function () {
                res.setHeader('Access-Control-Allow-Credentials', 'true');
                res.send({all: req.session.playlist});
            });
        });

    };
}(exports));
