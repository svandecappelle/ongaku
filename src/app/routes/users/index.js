/*jslint node: true */
var logger = require('log4js').getLogger("UsersRoutes"),
  nconf = require("nconf"),
  passport = require("passport"),
  _ = require("underscore"),
  unzip = require("unzip"),
  path = require("path"),
  Busboy = require('busboy');

var library = require("./../../middleware/library"),
    middleware = require("./../../middleware/middleware"),
    exporter = require("./../../middleware/exporter"),
    meta = require("./../../meta"),
    chat = require("./../../chat"),
    user = require("./../../model/user"),
    userlib = require("./../../model/library"),
    playlist = require("./../../model/playlist"),
    statistics = require("./../../model/statistics"),
    mime = require("mime"),
    fs = require("fs"),
    translator = require("./../../middleware/translator"),
    async = require("async");
var DEFAULT_USER_IMAGE_DIRECTORY = __dirname + "/../../../../public/user/",
  DEFAULT_GROUP_BY = ['artist', 'album'],
  DEFAULT_SORT_BY = 'artist',
  userFilesOpts = {
    root: DEFAULT_USER_IMAGE_DIRECTORY,
   dotfiles: 'deny',
   headers: {
       'x-timestamp': Date.now(),
       'x-sent': true
   }
 };
logger.setLevel(nconf.get('logLevel'));

var rmdirAsync = function(path, callback) {
  fs.readdir(path, function(err, files) {
    if(err) {
      // Pass the error on to callback
      callback(err, []);
      return;
    }
    var wait = files.length,
      count = 0,
      folderDone = function(err) {
      count++;
      // If we cleaned out all the files, continue
      if( count >= wait || err) {
        fs.rmdir(path,callback);
      }
    };
    // Empty directory to bail early
    if(!wait) {
      folderDone();
      return;
    }
    
    // Remove one or more trailing slash to keep from doubling up
    path = path.replace(/\/+$/,"");
    files.forEach(function(file) {
      var curPath = path + "/" + file;
      fs.lstat(curPath, function(err, stats) {
        if( err ) {
          callback(err, []);
          return;
        }
        if( stats.isDirectory() ) {
          rmdirAsync(curPath, folderDone);
        } else {
          fs.unlink(curPath, folderDone);
        }
      });
    });
  });
};

var getStatistics = function(name, callback){
  var statisticsValues = {};
  async.each(name, function (statistic, next){
    statistics.get(statistic.name, function(err, values){
      if (err){
        next(err);
      }
      var entries = _.pairs(values);

      entries = _.map(entries, function(element){
        if (statistic.type === 'track'){
          var track = library.getByUid(element[0]);
          if (track) {
            track.plays = parseInt(element[1]);
          }
          return track;
        } else {
          return {title: element[0], 'plays-genre': parseInt(element[1])};
        }
      });

      entries = _.sortBy(entries, statistic.name).reverse();
      var lenght = 10;
      entries = _.first(_.rest(entries, 0 * lenght), lenght);
      statisticsValues[statistic.name] = entries;

      next();
    });
  }, function(err){
    if (err){
      callback(err, null);
    } else {
      callback(null, statisticsValues);
    }
  });
};

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

    UsersRoutes.renderLibraryPage = function (username, req, res){
      userlib.get(username, function (err, uids){
        var libraryDatas = null;
        if (req.params.page === "all"){
          libraryDatas = library.getAudioById(uids);
        } else {
          libraryDatas = library.getAudioById(uids, req.params.page, 3);
        }
        middleware.json(req, res, libraryDatas);
      });
    };

    UsersRoutes.checkingAuthorization = function (req, res, callback) {
      meta.settings.getOne("global", "requireLogin", function (err, curValue) {
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

    UsersRoutes.api = function (app){
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

        meta.settings.getOne("global", "videoStream", function(err, value){
          if (value === 'true') {
            UsersRoutes.checkingAuthorization(req, res, function () {
              stream();
            });
          } else {
            res.json({
              error: 'Operation not allowed',
              code: 403
            });
          }
        });
      });

      app.get('/api/video/library/filter/:search/:page', function (req, res) {
        logger.debug("Search filtering video library");
        var groupby = req.session.groupby ? req.session.groupby : DEFAULT_GROUP_BY;

        var libraryDatas;
        var opts = {
          filter: req.params.search,
          type: 'video',
          groupby: groupby
        };
        if (req.params.page === "all"){
          libraryDatas = library.search(opts);
        } else {
          opts.page = req.params.page;
          opts.lenght = 3;
          libraryDatas = library.searchPage(opts);
        }

        middleware.json(req, res, libraryDatas);
      });

      app.get('/api/audio/library/filter/:search/:page', function (req, res) {
        logger.debug("Search filtering audio library");

        var groupby = req.session.groupby ? req.session.groupby : DEFAULT_GROUP_BY;
        var sortby = req.session.sortby ? req.session.sortby : DEFAULT_SORT_BY;

        var libraryDatas;
        var opts = {
          filter: req.params.search,
          type: 'audio',
          groupby: groupby,
          sortby: sortby
        };
        if (req.params.page === "all"){
          libraryDatas = library.search(opts);
        } else {
          opts.page = req.params.page;
          opts.lenght= 3;
          libraryDatas = library.searchPage(opts);
        }

        middleware.json(req, res, libraryDatas);
      });

      app.get('/api/audio/library', function (req, res) {
        logger.debug("Get all audio library");
        var groupby = req.session.groupby ? req.session.groupby : DEFAULT_GROUP_BY;
        var sortby = req.session.sortby ? req.session.sortby : DEFAULT_SORT_BY;

        var libraryDatas = library.getAudio(groupby, sortby);
        middleware.json(req, res, libraryDatas);
      });

      app.get('/api/audio/groupby/:groupby', function(req, res){
        req.session.groupby = req.params.groupby.split(",");
        req.session.save(function () {

          logger.debug("changed groupby: ", req.session.groupby);

          res.setHeader('Access-Control-Allow-Credentials', 'true');
          res.json({status: "ok"});
        });
      });

      app.get('/api/audio/sortby/:sortby', function(req, res){
        req.session.sortby = req.params.sortby;
        req.session.save(function () {

          logger.debug("changed sortby: ", req.session.sortby);

          res.setHeader('Access-Control-Allow-Credentials', 'true');
          res.json({status: "ok"});
        });
      });

      app.get('/api/audio/library/:page', function (req, res) {
        // load by page of 3 artists.
        var groupby = req.session.groupby ? req.session.groupby : DEFAULT_GROUP_BY;
        var sortby = req.session.sortby ? req.session.sortby : DEFAULT_SORT_BY;

        logger.debug("Get all one page of library ".concat(req.params.page));
        var libraryDatas = null;
        
        if (req.params.page === "all"){
          libraryDatas = library.getAudio(groupby, sortby);
        } else {
          libraryDatas = library.getAudio(req.params.page, 3, groupby, sortby);
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

      app.post('/api/statistics/:type/:media', function(req, res){
        if (req.params.type === 'plays'){
          statistics.set('plays', req.params.media, 'increment', function(){
              logger.debug("set statistics");
          });
          var media = library.getByUid(req.params.media);
          logger.debug(media);
          var genre = media.metadatas.genre ? media.metadatas.genre : media.metadatas.GENRE;
          if (genre){
            statistics.set('plays-genre', genre, 'increment', function(){
                logger.debug("set statistics");
            });
          }
        }
        middleware.json(req, res, {status: "ok"});
      });

      app.get('/api/user/:username/library/:page', function (req, res){
        var username = req.params.username;
        UsersRoutes.renderLibraryPage(username, req, res);
      });

      app.get('/api/user/library/filter/:search', function (req, res) {
        logger.debug("Search filtering audio library");

        var username = req.session.passport.user.username;

        userlib.get(username, function (err, uids){
          var libraryDatas = library.getAudioFlattenById(uids);
          var sortby = req.session.sortby ? req.session.sortby : DEFAULT_SORT_BY;

          var filteredDatas = library.search({
            filter: req.params.search, 
            type: "audio", 
            groupby: undefined,
            sortby: sortby
          }, libraryDatas);
          middleware.json(req, res, filteredDatas);
        });
      });

      app.get('/api/playlist', function (req, res) {
        logger.debug("get current playlist");
        res.send({all: _.compact(req.session.playlist), name: req.session.playlistname});
      });

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
        logger.debug("Add group of file to playlist", req.body.elements);
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
            logger.debug("Add all playlist tracks");
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
              logger.debug("rename playlist: ", newplaylistname);
            }

            logger.debug("clearing playlist: ", username, req.session.playlistname);
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

      app.get("/api/download/:search/:page", function(req, res){
        UsersRoutes.callIfAuthenticated(req, res, function(){
          var groupby = req.session.groupby;
          var username = req.session.passport.user.username;

          groupby = ["artist", "album"];

          var libraryDatas;
          var opts = {
            filter: req.params.search,
            type: 'audio',
            groupby: groupby
          };
          if (req.params.page === "all"){
            libraryDatas = library.search(opts);
          } else {
            opts.page = req.params.page;
            opts.lenght = 3;
            libraryDatas = library.searchPage(opts);
          }

          exporter.toZip(libraryDatas, username, function(filename){
            res.download(filename);
          });
        });
      });

      app.get("/api/album-download/:artist/:album", function(req, res){
        UsersRoutes.callIfAuthenticated(req, res, function(){
          var groupby = req.session.groupby;
          //var username = req.session.passport.user.username;

          groupby = ["artist", "album"];

          var libraryDatas,
            zipName = req.params.artist;
          if (req.params.album === "all"){
            libraryDatas = library.getAlbums(req.params.artist);
          } else {
            zipName += " - ".concat(req.params.album);
            libraryDatas = library.getAlbum(req.params.artist, req.params.album);
          }
          exporter.toZip(libraryDatas, zipName, function(filename){
            res.download(filename);
          });
        });
      });


      app.get("/api/track-download/:uid", function(req, res){
        UsersRoutes.callIfAuthenticated(req, res, function(){
            res.download(library.getFile(req.params.uid));
        });
      });
    };

    UsersRoutes.routes = function (app){
      app.get('/', function (req, res) {
        logger.info("Client access to index [" + req.ip + "]");
        // Get first datas fetch is defined into client side.
        var libraryDatas = library.getAudio(0, 3);

        logger.debug(libraryDatas);
        middleware.render('library/index', req, res, {library: libraryDatas});
      });

      app.get('/audio', function (req, res) {
        logger.info("Client access to index [" + req.ip + "]");
        // Get first datas fetch is defined into client side.
        var libraryDatas = library.getAudio(0, 3);

        logger.debug(libraryDatas);
        middleware.render('library/index', req, res, {library: libraryDatas});
      });

      app.get("/api/view/audio", function(req, res){
        logger.info("Client access to index [" + req.ip + "]");
        // Get first datas fetch is defined into client side.
        var libraryDatas = library.getAudio(0, 3);

        logger.debug(libraryDatas);
        middleware.render('api/audio', req, res, {library: libraryDatas});
      });

      app.get("/api/view/video", function(req, res){
        meta.settings.getOne("global", "videoStream", function(err, value){
          if (value === 'true') {
            logger.debug("Client access to videos api renderer [" + req.ip + "]");
            middleware.render('api/videos', req, res);
          } else {
            res.json({
              error: 'Operation not allowed',
              code: 403
            });
          }
        });
      });

      app.get('/video', function (req, res) {
        meta.settings.getOne("global", "videoStream", function(err, value){
          if (value === 'true') {
            logger.debug("Client access to videos [" + req.ip + "]");
            middleware.render('library/videos', req, res);
          } else {
            res.json({
              error: 'Operation not allowed',
              code: 403
            });
          }
        });
      });

      app.get('/api/view/library', function (req, res){
        UsersRoutes.redirectIfNotAuthenticated(req, res, function () {
          var username = req.session.passport.user.username;

          userlib.get(username, function (err, uids){
            var libraryDatas = library.getAudioById(uids, 0, 3);
            middleware.render('api/library', req, res, {library: libraryDatas});
          });
        });
      });

      app.get('/library', function (req, res){
        UsersRoutes.redirectIfNotAuthenticated(req, res, function () {
          var username = req.session.passport.user.username;

          userlib.get(username, function (err, uids){
            var libraryDatas = library.getAudioById(uids, 0, 3);
            middleware.render('user/index', req, res, {library: libraryDatas});
          });
        });
      });

      app.get("/user/:username/edit", function (req, res){
        var username = req.params.username;

        UsersRoutes.redirectIfNotAuthenticated(req, res, function () {
          user.isAdministrator(req.session.passport.user.uid, function (err, isAdmin){
            if (isAdmin || username === req.session.passport.user.username){
              user.getUserDataByUsername(username, function (err, userData){
                user.getGroupsByUsername(username, function (groups){
                  userData = _.extend(userData, { groups: groups });
                  userData.status = chat.status(userData.username);
                  middleware.render('user/edit', req, res, {
                    user: userData,
                    token: new Date().getTime()
                  });
                });
              });
            } else {
              res.redirect("/403");
            }
          });
        });
      });

      app.post("/user/:username/edit", function (req, res){
        var lang = req.body.lang;
        req.session.locale = lang;

        var busboy = new Busboy({ headers: req.headers });
        req.session.save(function () {
          res.setHeader('Access-Control-Allow-Credentials', 'true');
          busboy.on('file', function(fieldname, file, filename, encoding, mimetype) {
            if (!fs.existsSync(DEFAULT_USER_IMAGE_DIRECTORY + req.params.username)){
              fs.mkdirSync(DEFAULT_USER_IMAGE_DIRECTORY + req.params.username);
            }

            var saveTo = DEFAULT_USER_IMAGE_DIRECTORY + req.params.username + "/" + fieldname;
            file.pipe(fs.createWriteStream(saveTo));
            });
          busboy.on('finish', function() {
            res.redirect("back");
          });

          req.pipe(busboy);
        });
      });

      app.post("/user/:username/upload", function (req, res){
        var username = req.params.username;

        UsersRoutes.redirectIfNotAuthenticated(req, res, function () {
          user.isAdministrator(req.session.passport.user.uid, function (err, isAdmin){
            if (isAdmin || username === req.session.passport.user.username){
              var busboy = new Busboy({ headers: req.headers });
              req.session.save(function () {
                res.setHeader('Access-Control-Allow-Credentials', 'true');
                busboy.on('file', function(fieldname, file, filename, encoding, mimetype) {
                  if (!fs.existsSync(DEFAULT_USER_IMAGE_DIRECTORY + req.params.username)){
                    fs.mkdirSync(DEFAULT_USER_IMAGE_DIRECTORY + req.params.username);
                  }

                  var saveTo = DEFAULT_USER_IMAGE_DIRECTORY + req.params.username + "/" + fieldname;
                  file.pipe(fs.createWriteStream(saveTo));
                  });
                busboy.on('finish', function() {
                  res.json("ok upload");
                });

                req.pipe(busboy);
              });
            } else {
              res.json({error: "403, not authorized"})
            }
          });
        });
      });

      var infoViewLoad = function(req, res, apiView){
        var username = req.params.username;

        if (username !== undefined) {
          logger.debug("get user: ", username, req.url);
          user.getUserDataByUsername(username, function (err, userData){
            user.getGroupsByUsername(username, function (groups){
              userData = _.extend(userData, { groups: groups });
              userData.status = chat.status(userData.username);
              logger.debug("Check user: ", username, userData);
              if (apiView) {
                middleware.render('api/user/info', req, res, {user: userData, token: new Date().getTime()});
              } else {
                middleware.render('user/info', req, res, {user: userData, token: new Date().getTime()});
              }
            });
          });
        }
      }
      app.get("/user/:username/info", function (req, res){
        infoViewLoad(req, res);
      });

      app.get("/api/view/user/:username/info", function (req, res){
        infoViewLoad(req, res, true)
      });

      app.post("/user/:username/change-password", function (req, res){
        var password = req.body.password,
          confirmPassword = req.body['password-confirm'];
        if (password !== confirmPassword){
          return res.json({
            error: "password doesn't match"
          });
        }
        UsersRoutes.redirectIfNotAuthenticated(req, res, function () {
          user.isAdministrator(req.session.passport.user.uid, function (err, isAdmin){
            if (isAdmin || req.params.username === req.session.passport.user.username){

              user.hashPassword(password, function (err, hash) {
                if (err) {
                  res.json({
                    error: "error"
                  });
                }
                user.getUidByUsername(req.params.username, function(err, uid){
                  if (err){
                    return res.json({
                      error: "username not valid"
                    })
                  }
                  user.setUserField(uid, 'password', hash);
                  res.json({
                    status: "ok"
                  });
                })
              });

            } else {
              res.json({
                error: "not authorized"
              });
            }
          });
        });
      });

      app.get("/user/:username/avatar", function (req, res){
        var username = req.params.username,
          avatar = username + "/avatar";

        res.setHeader("Pragma-directive", "no-cache");
        res.setHeader("Cache-directive", "no-cache");
        res.setHeader("Cache-control", "no-cache");
        res.setHeader("Pragma", "no-cache");
        res.setHeader("Expires", "0");

        if (middleware.hasAvatar(username)) {
          res.sendFile(avatar, userFilesOpts);
        } else {
          res.redirect(avatar);
        }
      });

      app.get("/user/:username/background", function (req, res){
        res.setHeader("Pragma-directive", "no-cache");
        res.setHeader("Cache-directive", "no-cache");
        res.setHeader("Cache-control", "no-cache");
        res.setHeader("Pragma", "no-cache");
        res.setHeader("Expires", "0");

        var username = req.params.username,
          background = username + "/background";
          if (!middleware.hasImageFile(username, "background")){
            background = "background.jpg";
          }

          res.sendFile(background, userFilesOpts);
      });

      app.get("/user/:username/cover", function (req, res){
        res.setHeader("Pragma-directive", "no-cache");
        res.setHeader("Cache-directive", "no-cache");
        res.setHeader("Cache-control", "no-cache");
        res.setHeader("Pragma", "no-cache");
        res.setHeader("Expires", "0");

        var username = req.params.username,
          cover = username + "/cover";
        if (middleware.hasCover(username)) {
          res.sendFile(cover, userFilesOpts);
        } else {
          res.redirect(cover);
        }
      });

      app.get("/song-image/:songid", function(req, res){
        var albumart = library.getAlbumArtImage(req.params.songid);
        if (albumart){
          res.redirect(albumart);          
        } else {
          res.redirect("/img/album.jpg");
        }
      });

      var onUploadView = function(req, res){
        if (nconf.get("allowUpload") === 'true') {
          UsersRoutes.redirectIfNotAuthenticated(req, res, function () {
            var username = req.session.passport.user.username;
            var folder = req.params.folder;

            if (fs.existsSync(DEFAULT_USER_IMAGE_DIRECTORY + username + "/imported")) {
                var folderReading = DEFAULT_USER_IMAGE_DIRECTORY + username + "/imported/";
                if (folder){
                  folderReading += folder + "/";
                }

                middleware.render('user/upload', req, res, {
                  files: fs.readdirSync(folderReading)
                });
            } else {
                middleware.render('user/upload', req, res);
            }
          });
        } else {
          middleware.redirect('403', res);
        }
      };

      app.get('/api/view/upload', function (req, res) {
        onUploadView(req, res);
      });

      app.get("/upload", function(req, res){
        onUploadView(req, res);
      });

      app.post('/upload/file', function (req, res) {
        if (nconf.get("allowUpload") === 'true') { 
          var username = req.session.passport.user.username;

          var busboy = new Busboy({ headers: req.headers });
          req.session.save(function () {
          res.setHeader('Access-Control-Allow-Credentials', 'true');
          busboy.on('file', function(fieldname, file, filename, encoding, mimetype) {
            if (!fs.existsSync(DEFAULT_USER_IMAGE_DIRECTORY + username)){
              fs.mkdirSync(DEFAULT_USER_IMAGE_DIRECTORY + username);
            }
            
            if (!fs.existsSync(DEFAULT_USER_IMAGE_DIRECTORY + username + "/imported")) {
              fs.mkdirSync(DEFAULT_USER_IMAGE_DIRECTORY + username + "/imported");
            }

            var saveTo = DEFAULT_USER_IMAGE_DIRECTORY + username + "/imported/" + filename;
            file.pipe(fs.createWriteStream(saveTo));
            });
            
            busboy.on('finish', function() {
              middleware.redirect("/upload", res);
            });

            req.pipe(busboy);
          });
        } else {
          middleware.redirect('403', res);
        }
      });

      app.post("/api/files/set-properties/imported/:filename(*)", function(req, res){
        if (nconf.get("allowUpload") === 'true') { 
          UsersRoutes.redirectIfNotAuthenticated(req, res, function () {
            var username = req.session.passport.user.username;
            var file = req.params.filename;
            var isPublic = req.query.public;
            var folder = DEFAULT_USER_IMAGE_DIRECTORY + username + "/imported/" + file;

            logger.info("Set to public[" + isPublic + "] for user[" + username + "] folder: ", file);
            console.log("Folder " + folder + " scanning");
            var type = ['audio', 'video'];
            library.addFolder(folder, function(scanResult){
              console.log("Folder added");
              type = _.without(type, scanResult.type);
              if (type.lenght === 0){
                res.send({
                  message: 'ok'
                });
              }              
            });
          });
        }
      });

      app.get("/upload/files/imported/:filename(*)", function(req, res){
        if (nconf.get("allowUpload") === 'true') { 
          UsersRoutes.redirectIfNotAuthenticated(req, res, function () {
            var username = req.session.passport.user.username;
            if (fs.existsSync(DEFAULT_USER_IMAGE_DIRECTORY + username + "/imported")) {
              var isDirectory = fs.statSync(DEFAULT_USER_IMAGE_DIRECTORY + username + "/imported/" + req.params.filename).isDirectory();
              if (isDirectory){
                middleware.render('user/upload', req, res, {
                  files: fs.readdirSync(DEFAULT_USER_IMAGE_DIRECTORY + username + "/imported/" + req.params.filename),
                  directory: isDirectory ? req.params.filename : false
                });
              } else {
                res.sendFile(req.params.filename, {
                  root: DEFAULT_USER_IMAGE_DIRECTORY + username + "/imported/",
                  dotfiles: 'deny',
                  headers: {
                    'x-timestamp': Date.now(),
                    'x-sent': true
                  }
                });
              }
            }
          });
        } else {
          middleware.redirect('403', res);
        }
      });

      app.get("/upload/imported/:filename(*)/delete", function(req, res){  
        if (nconf.get("allowUpload") === 'true') { 
          UsersRoutes.redirectIfNotAuthenticated(req, res, function () {
            var username = req.session.passport.user.username;
            if (fs.existsSync(DEFAULT_USER_IMAGE_DIRECTORY + username + "/imported/" + req.params.filename)) {
              rmdirAsync(DEFAULT_USER_IMAGE_DIRECTORY + username + "/imported/" + req.params.filename, function(){
                middleware.redirect("/upload", res);  
              });
            }
          });
        } else {
          middleware.redirect('403', res);
        }
      });
      
      app.get("/upload/imported/:filename(*)/extract", function(req, res){  
        if (nconf.get("allowUpload") === 'true') { 
          UsersRoutes.redirectIfNotAuthenticated(req, res, function () {
            var username = req.session.passport.user.username;
            var file = DEFAULT_USER_IMAGE_DIRECTORY + username + "/imported/" + req.params.filename,
              folderExtract = 'public/user/' + username + "/imported/" + path.basename(req.params.filename, path.extname(req.params.filename));

            if (fs.existsSync(file)) {
              logger.info("extract zip to: ", folderExtract);
              fs.createReadStream(file).pipe(unzip.Extract({ path: folderExtract}));
              middleware.redirect("/upload", res);
            }
          });
        } else {
          middleware.redirect('403', res);
        }
      });

      app.get("/featured", function(req, res){
        logger.info("Client access to featured [" + req.ip + "]");
        middleware.render('user/featured', req, res);
      });


      app.get("/api/featured", function(req, res){
        var stats = [{name: 'plays', type: 'track'},
                    {name: 'plays-genre'}];
        getStatistics(stats, function(err, entries){
          middleware.json(req, res, {stats: entries});
        });
      });

      app.get("/api/view/featured", function(req, res){
        logger.info("Client access to featured [" + req.ip + "]");
        middleware.render('api/featured', req, res);
      });
    };

    UsersRoutes.load = function (app) {
      this.api(app);
      this.routes(app);
    };
}(exports));
