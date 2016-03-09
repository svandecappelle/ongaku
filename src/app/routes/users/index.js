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
    playlist = require("./../../model/playlist"),
    async = require("async");

logger.setLevel(nconf.get('logLevel'));


(function (UsersRoutes) {
    "use strict";

    var SuccessCall = function(){

    };

    SuccessCall.prototype.json = function () {
      return {code: 200, message: "Success"};
    };

    UsersRoutes.redirectIfNotAuthenticated = function (req, res, callback) {
      if (middleware.isAuthenticated(req)) {
          callback();
      } else {
          logger.warn("Anonymous access forbidden: authentication required.");
          middleware.redirect('/login', res);
      }
    };

    UsersRoutes.callIfAuthenticated = function (req, res, callback) {
      if (middleware.isAuthenticated(req)) {
          callback();
      } else {
          logger.warn("Call with Anonymous access is forbidden: authentication required.");
          middleware.json(req, res, {error: "Authentication required", code: "403"});
      }
    };

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
            logger.debug("Client access to videos [" + req.ip + "]");
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
                logger.debug("streaming video");
                middleware.stream(req, res, req.params.media, "video");
            };

            UsersRoutes.checkingAuthorization(req, res, function () {
                stream();
            });
        });

        app.get('/api/video/library/filter/:search/:page', function (req, res) {
            logger.debug("Search filtering video library");

            var libraryDatas;
            if (req.params.page === "all"){
              libraryDatas = library.search(req.params.search, "video");
            } else {
              libraryDatas = library.searchPage(req.params.search, "video", req.params.page, 3);
            }

            middleware.json(req, res, libraryDatas);
        });

        app.get('/api/audio/library/filter/:search/:page', function (req, res) {
            logger.debug("Search filtering audio library");

            var groupby = req.session.groupby;
            groupby = ["artist", "albums"];

            var libraryDatas;
            if (req.params.page === "all"){
              libraryDatas = library.search(req.params.search, "audio", groupby);
            } else {
              libraryDatas = library.searchPage(req.params.search, "audio", req.params.page, 3, groupby);
            }

            middleware.json(req, res, libraryDatas);
        });

        app.get('/api/audio/library', function (req, res) {
            logger.debug("Get all audio library");
            var libraryDatas = library.getAudio();
            middleware.json(req, res, libraryDatas);
        });

        app.get('/api/audio/library/:page', function (req, res) {
            // load by page of 3 artists.

            logger.debug("Get all one page of library ".concat(req.params.page));
            var libraryDatas = null;
            if (req.params.page === "all"){
              libraryDatas = library.getAudio();
            } else {
              libraryDatas = library.getAudio(req.params.page, 3);
            }
            middleware.json(req, res, libraryDatas);
        });

        app.get('/api/video/library/:page', function (req, res) {
            // load by page of 3 artists.
            logger.debug("Get all one page of library ".concat(req.params.page));
            var libraryDatas = library.getVideo(req.params.page, 9);
            middleware.json(req, res, libraryDatas);
        });

        app.get('/api/video/library', function (req, res) {
            logger.debug("Get all video library");
            var libraryDatas = library.getVideo();
            middleware.json(req, res, libraryDatas);
        });

        app.get('/api/stream/:media', function (req, res) {
            var stream = function () {
                logger.debug("streaming audio");
                middleware.stream(req, res, req.params.media, "audio");
            };

            UsersRoutes.checkingAuthorization(req, res, function () {
                stream();
            });
        });

        app.get('/library', function (req, res){
          UsersRoutes.redirectIfNotAuthenticated(req, res, function () {
            var username = req.session.passport.user.username;

            userlib.get(username, function (err, uids){
              var libraryDatas = library.getAudioById(uids, 0, 3);
              middleware.render('userlist', req, res, {library: libraryDatas});
            });
          });
        });

        app.get('/api/user/:username/library/:page', function (req, res){
          var username = req.params.username;

          userlib.get(username, function (err, uids){
            var libraryDatas = null;
            if (req.params.page === "all"){
              libraryDatas = library.getAudioById(uids);
            } else {
              libraryDatas = library.getAudioById(uids, req.params.page, 3);
            }
            middleware.json(req, res, libraryDatas);
          });
        });

        app.get('/api/user/library/filter/:search', function (req, res) {
          logger.debug("Search filtering audio library");

          var username = req.session.passport.user.username;

          userlib.get(username, function (err, uids){
            var libraryDatas = library.getAudioFlattenById(uids);

            var filteredDatas = library.search(req.params.search, "audio", undefined, libraryDatas);
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

        app.get("/user/:username/edit", function (req, res){
          var username = req.params.username;

          if (username !== undefined) {
            logger.info("get user: ", username);
            user.getUserDataByUsername(username, function (err, userData){
              user.getGroupsByUsername(username, function (groups){
                userData = _.extend(userData, { groups: groups });
                logger.info("Check user: ", username, userData);
                middleware.render('user/edit', req, res, {user: userData});
              });
            });
          }
        });

        app.get("/user/:username/info", function (req, res){
          var username = req.params.username;

          if (username !== undefined) {
            logger.info("get user: ", username, req.url);
            user.getUserDataByUsername(username, function (err, userData){
              user.getGroupsByUsername(username, function (groups){
                userData = _.extend(userData, { groups: groups });
                logger.info("Check user: ", username, userData);
                middleware.render('user/info', req, res, {user: userData});
              });
            });
          }
        });

        app.get("/user/:username/avatar", function (req, res){
          var username = req.params.username,
            avatar = middleware.getAvatar(username);
          if (middleware.hasAvatar(username)) {
            logger.info("sending user avatar file: " + avatar);
            res.sendFile(avatar);
          } else {
            res.redirect(avatar);
          }
        });

        app.get("/user/:username/cover", function (req, res){
          var username = req.params.username,
            cover = middleware.getCover(username);
          if (middleware.hasCover(username)) {
            logger.info("sending user cover file: " + cover);
            res.sendFile(cover);
          } else {
            res.redirect(cover);
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

        app.get('/api/playlist', function (req, res) {
            logger.debug("get current playlist");
            res.send({all: req.session.playlist, name: req.session.playlistname});
        });

        // Posts

        app.post('/api/playlist/add/:uid', function (req, res) {
            // TODO save playlist
            var uidFile = req.params.uid,
                track = library.getByUid(uidFile);
            logger.debug("Add file to playlist", uidFile);
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
          logger.debug("append to user lib: ".concat(username).concat(" -> ").concat(uids));

          async.each(uids, function(uid, next){
            userlib.append(username, uid, function (){
              logger.debug("Appended to list: " + uid);
              next();
            });
          }, function(){
            logger.debug("All elements added");
          });
          res.send({message: "ok"});
        });

        app.post('/api/user/library/remove', function (req, res) {
          var username = req.session.passport.user.username,
            uids = req.body.elements;
          logger.debug("remove to user lib: ".concat(username).concat(" -> ").concat(uids));

          async.each(uids, function(uid, next){
            userlib.remove(username, uid, function (){
              logger.debug("Remove from list: " + uid);
              next();
            });
          }, function(){
            logger.debug("All elements removed");
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
            logger.debug("Remove file index to playlist: ", id);
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
            logger.debug("Remove file index to playlist: ", id);
            req.session.playlist = [];
            req.session.save(function () {
                res.setHeader('Access-Control-Allow-Credentials', 'true');
                res.send({all: req.session.playlist});
            });
        });
        app.post('/api/user/playlists/new', function(req, res){
          UsersRoutes.callIfAuthenticated(req, res, function(){
            req.session.playlistname = null;
            req.session.playlist = [];

            req.session.save(function () {
                res.setHeader('Access-Control-Allow-Credentials', 'true');
                res.send(new SuccessCall().json());
            });
          });
        });
        app.post('/api/playlist/save', function(req, res){
          UsersRoutes.callIfAuthenticated(req, res, function(){
            var username = req.session.passport.user.username;
            var newplaylistname = req.body.playlistname;

            var appendToPlaylist = function(){
              logger.info("Add all playlist tracks");
              playlist.push(username, newplaylistname, req.session.playlist, function(){
                req.session.playlistname = newplaylistname;

                playlist.exists(username, newplaylistname, function (err, exists){
                  if(!err && !exists){
                    playlist.create(username, newplaylistname, function (){
                      req.session.save(function () {
                          res.setHeader('Access-Control-Allow-Credentials', 'true');
                          res.send(new SuccessCall().json());
                      });
                    });
                  } else {
                    req.session.save(function () {
                        res.setHeader('Access-Control-Allow-Credentials', 'true');
                        res.send(new SuccessCall().json());
                    });
                  }
                });
              });
            };

            if (req.session.playlistname){
              if (newplaylistname){
                logger.info("rename playlist: ", newplaylistname);
              }

              logger.info("clearing playlist: ", username, req.session.playlistname);
              playlist.remove(username, req.session.playlistname, function (){
                appendToPlaylist();
              });
            } else {
              appendToPlaylist();
            }
          });
        });

        app.post('/api/metadata/set/:id', function (req, res) {
          var id = req.params.id;
          var metadata = req.body.metadatas;
        });

        app.get("/api/user/:username/playlists", function (req, res){
          var username = req.params.username;
          playlist.getPlaylists(username, function(err, playlists){
            res.json(playlists);
          });
        });

        app.get("/api/user/playlists", function (req, res){
          if (middleware.isAuthenticated(req)) {
            var username = req.session.passport.user.username;
            playlist.getPlaylists(username, function(err, playlists){
              res.json(playlists);
            });
          } else {
            return res.json();
          }
        });

        app.post("/api/user/playlists/load/:playlist", function (req, res){
          UsersRoutes.callIfAuthenticated(req, res, function(){
            var playlistname = req.params.playlist;
            var username = req.session.passport.user.username;
            req.session.playlistname = playlistname;

            playlist.getPlaylistContent(username, playlistname, function(err, playlistElements){
              var playlistObject = [];
              _.each(playlistElements, function(uidFile){
                var track = library.getByUid(uidFile);
                playlistObject.push(track);
              });

              req.session.playlist = playlistObject;

              req.session.save(function () {
                  res.setHeader('Access-Control-Allow-Credentials', 'true');
                  res.send(new SuccessCall().json());
              });
            });
          });
        });

        app.post("/api/user/playlists/delete/:playlist", function (req, res){
          UsersRoutes.callIfAuthenticated(req, res, function(){
            var playlistname = req.params.playlist;
            var username = req.session.passport.user.username;

            req.session.playlistname = null;
            req.session.playlist = [];

            playlist.remove(username, playlistname, function (){
              req.session.save(function () {
                  res.setHeader('Access-Control-Allow-Credentials', 'true');
                  res.send(new SuccessCall().json());
              });
            });
          });
        });

        app.get("/api/user/playlists/:playlist", function (req, res){
          UsersRoutes.callIfAuthenticated(req, res, function(){
            var username = req.session.passport.user.username;
            playlist.getPlaylistContent(username, req.params.playlist, function(err, playlistElements){
              var playlistObject = [];
              _.each(playlistElements, function(uidFile){
                var track = library.getByUid(uidFile);
                playlistObject.push(track);
              });
              res.json({all: playlistObject});
            });
          });
        });

        app.get("/api/users", function (req, res){
          res.json();
        });

    };
}(exports));
