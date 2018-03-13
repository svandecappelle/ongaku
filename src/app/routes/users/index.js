/*jslint node: true */
const logger = require('log4js').getLogger("UsersRoutes");
const nconf = require("nconf");
const passport = require("passport");
const _ = require("underscore");
const unzip = require("node-unzip-2");
const path = require("path");
const Busboy = require('busboy');
const ffmetadata = require("ffmetadata");

const library = require("./../../middleware/library");
const middleware = require("./../../middleware/middleware");
const exporter = require("./../../middleware/exporter");
const meta = require("./../../meta");
const communication = require("./../../communication");
const user = require("./../../model/user");
const userlib = require("./../../model/library");
const playlist = require("./../../model/playlist");
const statistics = require("./../../model/statistics");
const security = require("./../../model/security");
const mime = require("mime");
const fs = require("fs");
const he = require('he');
const tinycolor = require("tinycolor2");
const translator = require("./../../middleware/translator");
const async = require("async");

try {
  const player = require("./../../middleware/desktop-player");
} catch (err) {
  logger.warn('Application cannot be used using desktop player.');
}

const  DEFAULT_USERS__DIRECTORY = path.join(__dirname, "/../../../../public/user/");
const DEFAULT_GROUP_BY = ['artist', 'album'];
const DEFAULT_SORT_BY = 'artist';
const userFilesOpts = {
  root: DEFAULT_USERS__DIRECTORY,
  dotfiles: 'deny',
  headers: {
    'x-timestamp': Date.now(),
    'x-sent': true
  }
};

const lights_themes = ["light"];

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

var rmRecurse = function (path, callback) {
  fs.lstat(path, function(err, stats) {
    if ( stats.isDirectory() ) {
      rmdirAsync(path, callback);
    } else {
      fs.unlink(path, callback);
    }
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

      entries = _.sortBy(entries, (entry) => {
        return entry ? parseInt(entry[statistic.name]): -1;
      }).reverse();

      var lenght = 10;
      entries = _.first(_.compact(entries), lenght);
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

class SuccessCall {
  
  json () {
    return {
      code: 200, 
      message: "Success"
    };
  }

};

class Users {

    incrementPlays (mediauid, userSession) {
      mediauid = mediauid.replace(".mp3", '');
      statistics.set('plays', mediauid, 'increment', () => {
        logger.info(`set statistics: ${mediauid}`);
      });
      var media = library.getByUid(mediauid);
      logger.debug(media);
      var genre = media.metadatas.genre ? media.metadatas.genre : media.metadatas.GENRE;
      if (genre){
        statistics.set('plays-genre', genre, 'increment', () => {
          logger.debug("set statistics");
        });
      }
      // TODO communication change this.
      communication.emit(userSession, 'streaming-playing:started', {
        uuid: mediauid,
        encoding: library.getAudioById(mediauid).encoding
      });
    }

    redirectIfNotAuthenticated (req, res, callback) {
      if (middleware.isAuthenticated(req)) {
        callback();
      } else {
        logger.warn("Anonymous access forbidden: authentication required.");
        middleware.redirect('/login', res);
      }
    };

    callIfAuthenticated (req, res, callback) {
      if (middleware.isAuthenticated(req)) {
        callback();
      } else {
        logger.warn("Call with Anonymous access is forbidden: authentication required.");
        middleware.json(req, res, {error: "Authentication required", code: "403"});
      }
    };

    renderLibraryPage (username, req, res){
      userlib.get(username, function (err, uids) {
        var libraryDatas = null;
        if (req.params.page === "all"){
          libraryDatas = library.getUserLibrary(uids, null, null, username, req.params.search);
        } else {
          libraryDatas = library.getUserLibrary(uids, req.params.page, 3, username, req.params.search);
        }

        middleware.json(req, res, libraryDatas);
      });
    };

    checkingAuthorization (req, res, callback) {
      if (nconf.get('type') === 'desktop'){
        logger.info("desktop mode all access granted");
        callback();
      } else {
        meta.settings.getOne("global", "requireLogin", (err, curValue) => {
          if (err) {
            logger.debug("userauth error checking");
            middleware.redirect('/login', res);
          } else if (curValue === "true") {
            logger.debug("userauth is required to listen");
            if (middleware.isAuthenticated(req)) {
              callback();
            } else {
              if (req.query.key) {
                security.isAllowed(req.query.key, (err, access_ganted) => {
                  if (access_ganted) {
                    logger.info("access granted to stream");
                    callback();
                  } else {
                    logger.warn("Anonymous access forbidden: Using a wrong query access key");
                    middleware.redirect('/login', res);
                  }
                });
              } else {
                logger.warn("Anonymous access forbidden: authentication required to stream");
                middleware.redirect('/login', res);
              }
            }
          } else {
            logger.debug("userauth is not required to listen");
            callback();
          }
        });
      }
    };

  api (app) {
    app.get('/api/video/stream/:media', (req, res) => {
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

      meta.settings.getOne("global", "videoStream", (err, value) => {
        if (value === 'true') {
          this.checkingAuthorization(req, res, function () {
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

    app.get('/api/video/library/filter/:search/:page', (req, res) => {
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

    app.get('/api/audio/library/filter/:search/:page', (req, res) => {
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

    app.get('/api/audio/library', (req, res) => {
      logger.debug("Get all audio library");
      var groupby = req.session.groupby ? req.session.groupby : DEFAULT_GROUP_BY;
      var sortby = req.session.sortby ? req.session.sortby : DEFAULT_SORT_BY;

      var libraryDatas = library.getAudio(groupby, sortby);
      middleware.json(req, res, libraryDatas);
    });

    app.get('/api/audio/groupby/:groupby', (req, res) => {
      req.session.groupby = req.params.groupby.split(",");
      req.session.save(() => {

        logger.debug("changed groupby: ", req.session.groupby);

        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.json({status: "ok"});
      });
    });

    app.get('/api/audio/sortby/:sortby', (req, res) => {
      req.session.sortby = req.params.sortby;
      req.session.save(() => {

        logger.debug("changed sortby: ", req.session.sortby);

        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.json({status: "ok"});
      });
    });

    app.get('/api/audio/library/:page', (req, res) => {
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

    app.get('/api/video/library/:page', (req, res) => {
      // load by page of 3 artists.
      logger.debug("Get all one page of library ".concat(req.params.page));
      var libraryDatas = library.getVideo(req.params.page, 9);
      middleware.json(req, res, libraryDatas);
    });

    app.get('/api/video/library', (req, res) => {
      logger.debug("Get all video library");
      var libraryDatas = library.getVideo();
      middleware.json(req, res, libraryDatas);
    });

    app.get('/api/stream/:media', (req, res) => {
      var stream = function () {
        return new Promise((resolve, reject) => {
          logger.debug("streaming audio");
          middleware.stream(req, res, req.params.media, "audio");
          resolve(req.params.media);
        });
      };
      this.checkingAuthorization(req, res, () => {
        stream().then((mediauid) => {
          // TODO change the increment plays to get real play state.
          // streaming method is not good solution.
          // cause of this method is called each time the song is loaded and not played 
          this.incrementPlays(mediauid, req.session.sessionID);
        });
      });
    });

    /* ## Used to plays using speakers desktop mode (plays on server side) ## */
    app.get('/api/desktop-play/:media', (req, res) => {
      var play = function () {
        logger.debug("play desktop audio");

        player.desktop(req, res, library.getRelativePath(path.basename(req.params.media)));
      };
      this.checkingAuthorization(req, res, () => {
        play();
      });
    });
    app.get('/api/desktop-play/:media/stop', (req, res) => {
      var stop = function () {
        logger.debug("stop desktop audio");

        player.end(req, res);
      };
      this.checkingAuthorization(req, res, () => {
        stop();
      });
    });

    app.get('/api/desktop-play/:media/pause', (req, res) => {
      var pause = function () {
        logger.debug("stop desktop audio");

        player.pause(req, res);
      };
      this.checkingAuthorization(req, res, () => {
        pause();
      });
    });

    app.get('/api/desktop-play/:media/resume', (req, res) => {
      var resume = function () {
        logger.debug("stop desktop audio");

        player.resume(req, res);
      };
      this.checkingAuthorization(req, res, () => {
        resume();
      });
    });

    app.post('/api/statistics/:type/:media', (req, res) => {
      if (req.params.type === 'plays') {
        this.incrementPlays(req.params.media);
      }
      middleware.json(req, res, {status: "ok"});
    });

    app.get('/api/user/:username/library/:page', (req, res) => {
      var username = req.params.username;
      this.renderLibraryPage(username, req, res);
    });

    app.get('/api/user/:username/library/filter/:search/:page', (req, res) => {
      logger.debug("Search filtering audio library");
      var username = req.params.username;
      this.renderLibraryPage(username, req, res);
    });

    app.get('/api/playlist', (req, res) => {
      logger.debug("get current playlist");
      res.send({all: _.compact(req.session.playlist), name: req.session.playlistname});
    });

    app.post('/api/playlist/add/:uid', (req, res) => {
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

    app.post('/api/user/library/add', (req, res) => {
      var username = req.session.passport.user.username,
        uids = req.body.elements;
      logger.debug("append to user lib: ".concat(username).concat(" -> ").concat(uids));

      async.each(uids, (uid, next) => {
        userlib.append(username, uid, () => {
          logger.debug("Appended to list: " + uid);
          next();
        });
      }, () => {
        logger.debug("All elements added");
      });
      res.send({message: "ok"});
    });

    app.post('/api/user/library/remove', (req, res) => {
      var username = req.session.passport.user.username,
        uids = req.body.elements;
      logger.debug("remove to user lib: ".concat(username).concat(" -> ").concat(uids));

      async.each(uids, (uid, next) => {
        userlib.remove(username, uid, () => {
          logger.debug("Remove from list: " + uid);
          next();
        });
      }, () => {
        logger.debug("All elements removed");
      });
      res.send({message: "ok"});
    });

    app.post('/api/playlist/addgroup', (req, res) => {
      var firstTrack;
      logger.debug("Add group of file to playlist", req.body.elements);
      if (req.session.playlist === undefined) {
        req.session.playlist = [];
      }

      _.each(req.body.elements, (uid) => {
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

    app.post('/api/playlist/remove/:id', (req, res) => {
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

    app.post('/api/playlist/clear', (req, res) => {
      var id = req.params.id;
      // TODO remove on saved playlist
      logger.debug("Remove file index to playlist: ", id);
      req.session.playlist = [];
      req.session.save(function () {
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.send({all: req.session.playlist});
      });
    });
    app.post('/api/user/playlists/new', (req, res) => {
      this.callIfAuthenticated(req, res, () => {
        req.session.playlistname = null;
        req.session.playlist = [];

        req.session.save(function () {
          res.setHeader('Access-Control-Allow-Credentials', 'true');
          res.send(new SuccessCall().json());
        });
      });
    });
    app.post('/api/playlist/save', (req, res) => {
      this.callIfAuthenticated(req, res, () => {
        var username = req.session.passport.user.username;
        var newplaylistname = req.body.playlistname;

        var appendToPlaylist = function(){
          logger.debug("Add all playlist tracks");
          playlist.push(username, newplaylistname, req.session.playlist, () => {
            req.session.playlistname = newplaylistname;

            playlist.exists(username, newplaylistname, (err, exists) => {
              if(!err && !exists){
                playlist.create(username, newplaylistname, () => {
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
          playlist.remove(username, req.session.playlistname, () => {
            appendToPlaylist();
          });
        } else {
          appendToPlaylist();
        }
      });
    });

    app.post('/api/metadata/set/:id', (req, res) => {
      var id = req.params.id;
      var data = req.body;
      var metadata = req.body.metadatas;
      var filename = library.getFile(id);

      ffmetadata.write(filename, data, (err) => {
        if (err) {
          res.status(500).json('Error writing metadata');
          logger.error("Error writing metadata", err);
        } else {
          logger.info("Data written");
          res.status(200).json('Data written');
        }
      });

    });

    app.post('/api/metadata/selection/set/', (req, res) => {
      var ids = req.body.ids;
      var metadata = req.body.metadatas;
      
      logger.info("set metadata on ", ids, metadata);
      async.eachLimit(ids, 10, (id, next) => {
        var filename = library.getFile(id);
        ffmetadata.write(filename, metadata, (err) => {
          next(err);
        });
      }, (err) => {
        if (err) {
          res.status(500).json('Error writing metadata');
          logger.error("Error writing metadata", err);
        } else {
          logger.info("Data written");
          res.status(200).json('Data written');
        }
      });
    });

    app.get("/api/user/:username/playlists", (req, res) => {
      var username = req.params.username;
      playlist.getPlaylists(username, (err, playlists) => {
        res.json(playlists);
      });
    });

    app.get("/api/user/playlists", (req, res) => {
      if (middleware.isAuthenticated(req)) {
        var username = req.session.passport.user.username;
        playlist.getPlaylists(username, (err, playlists) => {
          res.json(playlists);
        });
      } else {
        return res.json();
      }
    });

    app.post("/api/user/playlists/load/:playlist", (req, res) => {
      this.callIfAuthenticated(req, res, () => {
        var playlistname = req.params.playlist;
        var username = req.session.passport.user.username;
        req.session.playlistname = playlistname;

        playlist.getPlaylistContent(username, playlistname, (err, playlistElements) => {
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

    app.post("/api/user/playlists/delete/:playlist", (req, res) => {
      this.callIfAuthenticated(req, res, () => {
        var playlistname = req.params.playlist;
        var username = req.session.passport.user.username;

        req.session.playlistname = null;
        req.session.playlist = [];

        playlist.remove(username, playlistname, () => {
          req.session.save(function () {
            res.setHeader('Access-Control-Allow-Credentials', 'true');
            res.send(new SuccessCall().json());
          });
        });
      });
    });

    app.get("/api/user/playlists/:playlist", (req, res) => {
      this.callIfAuthenticated(req, res, () => {
        var username = req.session.passport.user.username;
        playlist.getPlaylistContent(username, req.params.playlist, (err, playlistElements) => {
          var playlistObject = [];
          _.each(playlistElements, function(uidFile){
            var track = library.getByUid(uidFile);
            playlistObject.push(track);
          });
          res.json({all: playlistObject});
        });
      });
    });

    // TODO ?
    app.get("/api/users", (req, res) => {
      res.json();
    });

    app.get("/api/download/:search/:page", (req, res) => {
      this.callIfAuthenticated(req, res, () => {
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

        exporter.toZip(libraryDatas, username).then((filename) => {
          res.download(filename);
        });
      });
    });

    app.get("/api/album-download/:artist/:album", (req, res) => {

      var download = function(req, res){
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
        exporter.toZip(libraryDatas, zipName).then((filename) => {
          res.download(filename);
        });
      };

      if (req.query.key){
        security.isAllowed(req.query.key, (err, access_ganted) => {
          if (err){
            return res.json({});
          }

          if (access_ganted) {
            download(req, res);
          } else {
            res.status(403).json({message: 'access forbidden without a valid key'});
          }
        });

      } else {
        this.callIfAuthenticated(req, res, () => {
          download(req, res);
        });
      }

    });


    app.get("/api/track-download/:uid", (req, res) => {
      this.callIfAuthenticated(req, res, () => {
          res.download(library.getFile(req.params.uid));
      });
    });
  };

  routes (app) {
    app.get('/', (req, res) => {
      logger.info("Client access to index [" + req.ip + "]");
      // Get first datas fetch is defined into client side.
      var libraryDatas = library.getAudio(0, 3);
      logger.debug(libraryDatas);
      middleware.render('library/index', req, res, {library: libraryDatas});
    });

    app.get('/css/theme.css', (req, res) => {
      res.writeHead(200, {"Content-Type": "text/css"});
      function replaceAll(str, find, replace) {
        return str.replace(new RegExp(find, 'g'), replace);
      };

      var color = nconf.get("theme")['base-color'];

      if (req.query.color){
        color = req.query.color;
      }
      var text_shadow = color.replace(", 1)", ", 0.3)");

      var fileContent;
      if (!req.session.theme || !_.contains(lights_themes, req.session.theme)) {
        if (tinycolor(color).getBrightness() >= 70) {
          fileContent = fs.readFileSync(path.join(__dirname, "../../../../public/dark-theme.css"), 'utf-8');
        } else {
          fileContent = fs.readFileSync(path.join(__dirname, "../../../../public/light-theme.css"), 'utf-8');
        }
      } else {
        if (tinycolor(color).getBrightness() >= 70) {
          fileContent = fs.readFileSync(path.join(__dirname, "../../../../public/light-theme.css"), 'utf-8');
        } else {
          fileContent = fs.readFileSync(path.join(__dirname, "../../../../public/dark-theme.css"), 'utf-8');
        }
      }
      fileContent = replaceAll(fileContent, '#{main_color}', color);
      fileContent = replaceAll(fileContent, '#{text_shadow}', text_shadow);

      res.write(fileContent);
      res.end();
    });

    app.get('/audio', (req, res) => {
      logger.info("Client access to index [" + req.ip + "]");
      // Get first datas fetch is defined into client side.
      var libraryDatas = library.getAudio(0, 3);

      logger.debug(libraryDatas);
      middleware.render('library/index', req, res, {library: libraryDatas});
    });

    app.get("/api/view/audio", (req, res) => {
      logger.info("Client access to index [" + req.ip + "]");
      // Get first datas fetch is defined into client side.
      var libraryDatas = library.getAudio(0, 3);

      logger.debug(libraryDatas);
      middleware.render('api/audio', req, res, {library: libraryDatas});
    });

    app.get("/api/view/video", (req, res) => {
      meta.settings.getOne("global", "videoStream", (err, value) => {
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

    app.get('/video', (req, res) => {
      meta.settings.getOne("global", "videoStream", (err, value) => {
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

    app.get('/api/view/library', (req, res) => {
      this.redirectIfNotAuthenticated(req, res, () => {
        var username = req.session.passport.user.username;

        userlib.get(username, (err, uids) => {
          var libraryDatas = library.getAudioById(uids, 0, 3);
          middleware.render('api/library', req, res, {library: libraryDatas});
        });
      });
    });

    app.get('/library', (req, res) => {
      this.redirectIfNotAuthenticated(req, res, () => {
        var username = req.session.passport.user.username;

        userlib.get(username, (err, uids) => {
          var libraryDatas = library.getAudioById(uids, 0, 3);
          middleware.render('user/index', req, res, {library: libraryDatas});
        });
      });
    });

    app.get("/user/:username/edit", (req, res) => {
      var username = req.params.username;

      this.redirectIfNotAuthenticated(req, res, () => {
        user.isAdministrator(req.session.passport.user.uid, (err, isAdmin) => {
          if (isAdmin || username === req.session.passport.user.username){
            user.getUserDataByUsername(username, (err, userData) => {
              user.getGroupsByUsername(username, (groups) => {
                userData = _.extend(userData, { groups: groups });
                userData.status = communication.status(userData.username);
                var theme_path = path.resolve(__dirname, "../../../../public/themes");

                var files = fs.readdirSync(theme_path);
                var themes = _.filter(files, (file) => {
                  var stats = fs.lstatSync(path.resolve(theme_path, file));
                  return !stats.isDirectory() && path.extname(file) === '.css';
                });

                security.getAccessId(req.session.passport.user.uid, (err, key) => {
                  if (err){
                    logger.error(err);
                    return res.json(500, {error: 'Internal error'});
                  }

                  middleware.render('user/edit', req, res, {
                    user: userData,
                    token: new Date().getTime(),
                    key: key,
                    themes: themes.map(theme => path.basename(theme, '.css'))
                  });
                  // http://music.mizore.fr/api/album-download/Acus%20Vacuum/Tempus%20Consumens?key=TtMjOReVhJI8
                });
              });
            });
          } else {
            res.redirect("/403");
          }
        });
      });
    });

    app.post("/user/set-locale", (req, res) => {
      var lang = req.body.lang;
      req.session.locale = lang;
      req.session.save(function () {
        res.json({
          message: 'locale changed',
          status: 200
        });
      });
    });

    app.post("/user/:username/edit", (req, res) => {
      var lang = req.body.lang;
      req.session.locale = lang;
      req.session.theme = req.body.theme;

      // save settings to user settings db.
      if (lang){
        user.setSingleSetting(req.session.passport.user.uid, 'locale', lang, () => {
          logger.info("Setting locale saved to db");
        });
      }
      if (req.body.theme !== undefined) {
        user.setSingleSetting(req.session.passport.user.uid, 'theme', req.body.theme, () => {
          logger.info("Setting theme saved to db");
        });
      }
      logger.info(req.body.tokenid);
      if ( req.body.tokenid ) {
        security.set(req.session.passport.user.uid, req.body.tokenid, (err) => {
          if (err){
            return logger.error("Error adding grant access by key", err);
          }
          logger.info("security access granted");
        });
      }
      var busboy = new Busboy({ headers: req.headers });
      req.session.save(function () {
        res.setHeader('Access-Control-Allow-Credentials', 'true');

        busboy.on('file', (fieldname, file, filename, encoding, mimetype) => {
          if (!fs.existsSync(DEFAULT_USERS__DIRECTORY + req.params.username)){
            fs.mkdirSync(DEFAULT_USERS__DIRECTORY + req.params.username);
          }

          var saveTo = DEFAULT_USERS__DIRECTORY + req.params.username + "/" + fieldname;
          file.pipe(fs.createWriteStream(saveTo));
        });

        busboy.on('finish', () => {
          res.redirect("back");
        });

        req.pipe(busboy);
      });
    });

    app.post(["/user/:username/upload", "/user/:username/info/upload"], (req, res) => {
      var username = req.params.username;

      this.redirectIfNotAuthenticated(req, res, function () {
        user.isAdministrator(req.session.passport.user.uid, function (err, isAdmin){
          if (isAdmin || username === req.session.passport.user.username){
            var busboy = new Busboy({ headers: req.headers });
            req.session.save(function () {
              res.setHeader('Access-Control-Allow-Credentials', 'true');
              busboy.on('file', function(fieldname, file, filename, encoding, mimetype) {
                if (!fs.existsSync(DEFAULT_USERS__DIRECTORY + req.params.username)){
                  fs.mkdirSync(DEFAULT_USERS__DIRECTORY + req.params.username);
                }

                var saveTo = DEFAULT_USERS__DIRECTORY + req.params.username + "/" + fieldname;
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
        user.getUserDataByUsername(username, (err, userData) => {
          user.getGroupsByUsername(username, (groups) => {
            userData = _.extend(userData, { groups: groups });
            userData.status = communication.status(userData.username);
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
    app.get("/user/:username/info", (req, res) => {
      infoViewLoad(req, res);
    });

    app.get("/api/view/user/:username/info", (req, res) => {
      infoViewLoad(req, res, true)
    });

    app.post("/user/:username/change-password", (req, res) => {
      var password = req.body.password,
        confirmPassword = req.body['password-confirm'];
      if (password !== confirmPassword){
        return res.json({
          error: "password doesn't match"
        });
      }
      this.redirectIfNotAuthenticated(req, res, () => {
        user.isAdministrator(req.session.passport.user.uid, (err, isAdmin) => {
          if (isAdmin || req.params.username === req.session.passport.user.username){

            user.hashPassword(password, (err, hash) => {
              if (err) {
                res.json({
                  error: "error"
                });
              }
              user.getUidByUsername(req.params.username, (err, uid) => {
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

    app.get("/user/:username/avatar", (req, res) => {
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
        res.redirect(middleware.getImageFile(username, 'avatar'));
      }
    });

    app.get("/user/:username/background", (req, res) => {
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

    app.get("/user/:username/cover", (req, res) => {
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

    app.get("/song-image/:songid", (req, res) => {
      var albumart = library.getAlbumArtImage(req.params.songid);
      if (albumart){
        if (req.query.quality === 'best'){
          albumart = _.last(albumart);
        }

        res.redirect(albumart);
      } else {
        res.redirect("/img/album.jpg");
      }
    });

    var onUploadView = (req, res) => {
      if (nconf.get("allowUpload") === 'true') {
        this.redirectIfNotAuthenticated(req, res, () => {
          var username = req.session.passport.user.username;
          var folder = req.params.folder;

          if (fs.existsSync(DEFAULT_USERS__DIRECTORY + username + "/imported")) {
              var folderReading = DEFAULT_USERS__DIRECTORY + username + "/imported/";
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

    app.get('/api/view/upload', (req, res) => {
      onUploadView(req, res);
    });

    app.get("/upload", (req, res) => {
      onUploadView(req, res);
    });

    app.post('/upload/file', (req, res) => {
      if (nconf.get("allowUpload") === 'true') {
        var username = req.session.passport.user.username;

        var busboy = new Busboy({ headers: req.headers });
        req.session.save(function () {
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        busboy.on('file', (fieldname, file, filename, encoding, mimetype) => {
          if (!fs.existsSync(DEFAULT_USERS__DIRECTORY + username)){
            fs.mkdirSync(DEFAULT_USERS__DIRECTORY + username);
          }

          if (!fs.existsSync(DEFAULT_USERS__DIRECTORY + username + "/imported")) {
            fs.mkdirSync(DEFAULT_USERS__DIRECTORY + username + "/imported");
          }

          var saveTo = DEFAULT_USERS__DIRECTORY + username + "/imported/" + filename;
          file.pipe(fs.createWriteStream(saveTo));
          });

          busboy.on('finish', () => {
            middleware.redirect("/upload", res);
          });

          req.pipe(busboy);
        });
      } else {
        middleware.redirect('403', res);
      }
    });

    app.post('/user/:username/theme-upload', (req, res) => {
      var username = req.session.passport.user.username;

      var busboy = new Busboy({ headers: req.headers });
      req.session.save(function () {
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      busboy.on('file', (fieldname, file, filename, encoding, mimetype) => {
        if (!fs.existsSync(DEFAULT_USERS__DIRECTORY + username)){
          fs.mkdirSync(DEFAULT_USERS__DIRECTORY + username);
        }

        if (!fs.existsSync(DEFAULT_USERS__DIRECTORY + username + "/imported")) {
          fs.mkdirSync(DEFAULT_USERS__DIRECTORY + username + "/imported");
        }

        var saveTo = DEFAULT_USERS__DIRECTORY + username + "/imported/theme.css";
          file.pipe(fs.createWriteStream(saveTo));
        });

        busboy.on('finish', () => {
          middleware.redirect("/", res);
        });

        req.pipe(busboy);
      });
    });

    app.post("/api/files/set-properties/imported/:filename(*)", (req, res) => {
      if (nconf.get("allowUpload") === 'true') {
        this.redirectIfNotAuthenticated(req, res, () => {
          var username = req.session.passport.user.username;
          var file = req.params.filename;
          var isPublic = req.query.public === 'true';
          var folder = DEFAULT_USERS__DIRECTORY + username + "/imported/" + file;
          folder = he.decode(folder);
          logger.info("Set to public[" + isPublic + "] for user[" + username + "] folder: ", file);

          user.setSharedFolder(username, he.decode(file), isPublic, () => {
            if (isPublic){
              console.log("Folder " + folder + " scanning");
              var type = ['audio', 'video'];

              library.addFolder({
                path: folder,
                username: username
              }, (scanResult) => {
                console.log("Folder added");
                type = _.without(type, scanResult.type);
                if (type.lenght === 0){
                  res.send({
                    message: 'ok'
                  });
                }
              });
            } else {
              library.removeFolder({
                path: folder,
                username: username
              });
              res.send({
                message: 'ok'
              });
            }
          });
        });
      }
    });

    app.get("/upload/files/imported/:filename(*)", (req, res) => {
      if (nconf.get("allowUpload") === 'true') {
        this.redirectIfNotAuthenticated(req, res, () => {
          var username = req.session.passport.user.username;
          if (fs.existsSync(DEFAULT_USERS__DIRECTORY + username + "/imported")) {
            var isDirectory = fs.statSync(DEFAULT_USERS__DIRECTORY + username + "/imported/" + req.params.filename).isDirectory();
            if (isDirectory){
              var folder = he.decode(req.params.filename);
              user.isSharedFolder(username, folder, (err, isShared) => {
                logger.info("folder: " + folder, err, isShared);
                middleware.render('user/upload', req, res, {
                  files: fs.readdirSync(DEFAULT_USERS__DIRECTORY + username + "/imported/" + req.params.filename),
                  directory: isDirectory ? req.params.filename : false,
                  isShared: isShared
                });
              });
            } else {
              res.sendFile(req.params.filename, {
                root: DEFAULT_USERS__DIRECTORY + username + "/imported/",
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

    app.get("/upload/imported/:filename(*)/delete", (req, res) => {
      if (nconf.get("allowUpload") === 'true') {
        this.redirectIfNotAuthenticated(req, res, () => {
          var username = req.session.passport.user.username;
          if (fs.existsSync(DEFAULT_USERS__DIRECTORY + username + "/imported/" + req.params.filename)) {
            rmRecurse(DEFAULT_USERS__DIRECTORY + username + "/imported/" + req.params.filename, () => {
              middleware.redirect("/upload", res);
            });
          }
        });
      } else {
        middleware.redirect('403', res);
      }
    });

    app.get("/upload/imported/:filename(*)/extract", (req, res) => {
      if (nconf.get("allowUpload") === 'true') {
        this.redirectIfNotAuthenticated(req, res, () => {
          var username = req.session.passport.user.username;
          var file = DEFAULT_USERS__DIRECTORY + username + "/imported/" + req.params.filename,
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

    app.get("/featured", (req, res) => {
      logger.info("Client access to featured [" + req.ip + "]");
      middleware.render('user/featured', req, res);
    });


    app.get("/api/featured", (req, res) => {
      var stats = [{name: 'plays', type: 'track'},
        {name: 'plays-genre'}];
      getStatistics(stats, function(err, entries){
        middleware.json(req, res, {stats: entries});
      });
    });

    app.get("/api/view/featured", (req, res) => {
      logger.info("Client access to featured [" + req.ip + "]");
      middleware.render('api/featured', req, res);
    });

    app.post("/api/set-color-scheme", (req, res) => {
      this.callIfAuthenticated(req, res, () => {
        user.setSingleSetting(req.session.passport.user.uid, 'color-scheme', req.body.color, () => {
          req.session.user['color-scheme'] = req.body.color
          req.session.save(function () {
            logger.info(`Setting theme ${req.body.color} saved to db`);
            res.status(200).send("OK");    
          });  
        });
      });
    });

    app.get("/api/waveform/:uid", (req, res) => {
      try {
        var src = library.getRelativePath(path.basename(req.params.uid));
        var color = 'white';
        

        if (req.session.theme && _.contains(lights_themes, req.session.theme)) {
          color = '#929292';
        }
        
        if (req.query.color){
          color = req.query.color;
        }
        var options = {
            waveColor: color,
            backgroundColor: "rgba(0,0,0,0)"
        };
        var Waveform = require('node-wave');

        res.writeHead(200, {'Content-Type': 'image/png'});

        Waveform(src, options, (err , buffer) => {
          res.write(buffer);
          res.end();
        });
      } catch(error){
        res.status(500).send("");
        logger.warn("Not compatible canvas generation wave.");
      }
    });
  };

  load (app) {
    this.api(app);
    this.routes(app);
  };
}

module.exports = new Users();
