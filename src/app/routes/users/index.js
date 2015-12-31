/*jslint node: true */
var logger = require('log4js').getLogger("UsersRoutes");
var nconf = require("nconf");
var passport = require("passport");
var _ = require("underscore");

var authentication = require("./../../middleware/authentication"),
    library = require("./../../middleware/library"),
    middleware = require("./../../middleware/middleware"),
    meta = require("./../../meta"),
    user = require("./../../model/user"),
    userlib = require("./../../model/library"),
    async = require("async");

logger.setLevel(nconf.get('logLevel'));


(function (UsersRoutes) {
    "use strict";

    UsersRoutes.checkingAuthorization = function (req, res, callback) {
        meta.settings.getOne("global", "require-authentication", function (err, curValue) {
            if (err) {
                logger.debug("userauth error checking");
                middleware.redirect('/login', res);
            } else if (curValue === "true") {
                logger.debug("userauth is required to listen");
                if (middleware.isAuthenticated(req)) {
                    callback();
                } else {
                    logger.warn("Anonymous access forbidden: authentication required to stream");
                    middleware.redirect('/login', res);
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
            // Get first datas fetch is defined into client side.
            var libraryDatas = library.getAudio(0, 3);

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
            middleware.render('videolist', req, res);
        });

        app.get('/api/video/stream/:media', function (req, res) {
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

        app.get('/api/video/library/filter/:search', function (req, res) {
            logger.info("Search filtering video library");
            var libraryDatas = library.search(req.params.search, "video");
            middleware.json(req, res, libraryDatas);
        });

        app.get('/api/audio/library/filter/:search', function (req, res) {
            logger.info("Search filtering audio library");
            var libraryDatas = library.search(req.params.search, "audio");
            middleware.json(req, res, libraryDatas);
        });

        app.get('/api/audio/library', function (req, res) {
            logger.info("Get all audio library");
            var libraryDatas = library.getAudio();
            middleware.json(req, res, libraryDatas);
        });

        app.get('/api/audio/library/:page', function (req, res) {
            // load by page of 3 artists.

            // Time out for testing the defered loading
            //setTimeout(function () {
            logger.info("Get all one page of library ".concat(req.params.page));
            var libraryDatas = library.getAudio(req.params.page, 3);
            middleware.json(req, res, libraryDatas);
            //}, 10000);

        });

        app.get('/api/video/library/:page', function (req, res) {
            // load by page of 3 artists.
            logger.info("Get all one page of library ".concat(req.params.page));
            var libraryDatas = library.getVideo(req.params.page, 9);
            middleware.json(req, res, libraryDatas);
        });

        app.get('/api/video/library', function (req, res) {
            logger.info("Get all video library");
            var libraryDatas = library.getVideo();
            middleware.json(req, res, libraryDatas);
        });

        app.get('/api/stream/:media', function (req, res) {
            var stream = function () {
                logger.info("streaming audio");
                middleware.stream(req, res, req.params.media, "audio");
            };

            UsersRoutes.checkingAuthorization(req, res, function () {
                stream();
            });
        });

        app.get('/library', function (req, res){
          var username = req.session.passport.user.username;

          userlib.get(username, function (err, uids){
            var libraryDatas = library.getAudioById(uids, 0, 3);
            logger.info(uids);
            middleware.render('userlist', req, res, {library: libraryDatas});
          });
        });

        app.get('/api/user/library/:page', function (req, res){
          var username = req.session.passport.user.username;

          userlib.get(username, function (err, uids){
            var libraryDatas = library.getAudioById(uids, req.params.page, 3);
            middleware.json(req, res, libraryDatas);
          });
        });

        app.get('/api/user/library/filter/:search', function (req, res) {
          logger.info("Search filtering audio library");

          var username = req.session.passport.user.username;

          userlib.get(username, function (err, uids){
            var libraryDatas = library.getAudioFlattenById(uids);

            var filteredDatas = library.search(req.params.search, "audio", libraryDatas);
            middleware.json(req, res, filteredDatas);
          });
        });

        if (nconf.get("uploader")) {
            var fs = require('fs'),
                busboy = require('connect-busboy');
            //...
            app.use(busboy());
            //...
            app.get('/api/upload', function (req, res) {
                middleware.render('upload', req, res);
            });

            app.post('/api/fileupload', function (req, res) {
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

        app.get("/user/info/:username", function (req, res){
          var username = req.params.username;

          if (username !== undefined) {
            logger.info("get user: ", username);
            user.getUserDataByUsername(username, function (err, userData){
              user.getGroupsByUsername(username, function (groups){
                userData = _.extend(userData, { groups: groups });
                logger.info("Check user: ", username, userData);
                middleware.render('user', req, res, {user: userData});
              });
            });
          }
        });

        app.get("/users", function (req, res){
          user.getAllUsers(function (err, usersDatas){
            async.map(usersDatas.users, function (userData, next){
              user.getGroupsByUsername(userData.username, function (groups){
                userData = _.extend(userData, {groups: groups});
                next(null, userData);
              });
            }, function (err, usersDatas){
              middleware.render('users', req, res, {users: usersDatas});
            });
          });
        });

        // Posts

        app.post('/api/playlist/add/:uid', function (req, res) {
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

        app.post('/api/user/library/add', function (req, res) {
          var username = req.session.passport.user.username,
            uids = req.body.elements;
          logger.info("append to user lib: ".concat(username).concat(" -> ").concat(uids));

          async.each(uids, function(uid, next){
            userlib.append(username, uid, function (){
              logger.info("Appended to list: " + uid);
              next();
            });
          }, function(){
            logger.info("All elements added");
          });
          res.send({message: "ok"});
        });

        app.post('/api/user/library/remove', function (req, res) {
          var username = req.session.passport.user.username,
            uids = req.body.elements;
          logger.info("remove to user lib: ".concat(username).concat(" -> ").concat(uids));

          async.each(uids, function(uid, next){
            userlib.remove(username, uid, function (){
              logger.info("Remove from list: " + uid);
              next();
            });
          }, function(){
            logger.info("All elements removed");
          });
          res.send({message: "ok"});
        });

        app.post('/api/playlist/addgroup', function (req, res) {
          var firstTrack;
          logger.info("Add group of file to playlist", req.body.elements);
          if (req.session.playlist === undefined) {
              req.session.playlist = [];
          }

          _.each(req.body.elements, function (uid){
            var track = library.getByUid(uid);
            if (firstTrack === undefined){
              firstTrack = track;
            }
            if (track !== undefined) {
              req.session.playlist.push(track);
            }
          });

          req.session.save(function () {
              res.setHeader('Access-Control-Allow-Credentials', 'true');
              res.send({all: req.session.playlist, lastAdded: firstTrack});
          });
        });

        app.post('/api/playlist/remove/:id', function (req, res) {
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

        app.post('/api/playlist/clear', function (req, res) {
            var id = req.params.id;
            // TODO remove on saved playlist
            logger.info("Remove file index to playlist: ", id);
            req.session.playlist = [];
            req.session.save(function () {
                res.setHeader('Access-Control-Allow-Credentials', 'true');
                res.send({all: req.session.playlist});
            });
        });

        app.post('/api/metadata/set/:id', function (req, res) {
          var id = req.params.id;
          var metadata = req.body.metadatas;
          console.log("Set song metadata: ".concat(id), metadata);
        });

        app.get("/api/users", function (req, res){

          res.json();
        });

    };
}(exports));
