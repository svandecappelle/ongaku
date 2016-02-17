/*jslint node: true */
(function (Middleware) {
    "use strict";

    var middleware = {},
        async = require('async'),
        nconf = require('nconf'),
        fs = require('fs'),
        _ = require("underscore"),
        path = require("path"),
        logger = require('log4js').getLogger("Middleware"),
        library = require("./library"),
        transcoder = require("./transcoder"),
        meta = require("./../meta"),
        gravatar = require("gravatar"),
        identicon;

    logger.setLevel(nconf.get("logLevel"));
    var allowedStreamingAudioTypes = ["mp3", "ogg"];

    try {
        identicon = require('identicon');
    } catch (expect) {
        logger.warn("Not installed optional extension: identicon it will not be used.");
    }

    /*
     * Render a view. Control if rights are valid to access the view and if user is authenticated (if needed).
     */
    Middleware.render = function (view, req, res, objs) {
        var viewParams = objs,
            middlewareObject = {
                req: req,
                res: res,
                view: view,
                objs: viewParams
            },
            call = async.compose(this.session, this.meta);

        if (viewParams === undefined) {
            viewParams = {};
        }

        if (middlewareObject.objs === undefined) {
            middlewareObject.objs = {};
        }

        if (middlewareObject.objs.session === undefined) {
            middlewareObject.objs.session = {};
        }

        call(middlewareObject, function (err, middlewareObject) {

            var play = null,
                message = null;

            if (req.session.playlist) {
                play = _.first(req.session.playlist);
            }

            if (library.scanning()) {
                message = "Scanning library";
            }

            _.extend(middlewareObject.objs, {
                data: {
                    playing: play,
                    playlist: req.session.playlist ? req.session.playlist : [],
                    message: message
                }
            });

            logger.debug(middlewareObject.objs.session);
            res.render(view, middlewareObject.objs);
        });
    };

    Middleware.json = function (req, res, json) {
        res.json(json);
    };

    /*
     * Send redirect to client.
     */
    Middleware.redirect = function (view, res) {
        res.redirect(view);
    };

    Middleware.stream = function (req, res, uuid, type) {
        logger.debug("start stream file: " + uuid);
        if (this.requireAuthentication(req)) {
            // need an auth
            logger.info("Client not connected: cannot acces to audio / video [" + req.ip + "]");
            req.session.redirectTo = req.originalUrl;
            res.json({error: 'Need privileges'});
            res.end();
        } else {
            logger.info("Stream " + type);
            var fs = require("fs"),
                src = library.getRelativePath(path.basename(uuid));
            // logger.info("streaming type: "+ path.extname(src).replace(".", ""));
            if (type === 'audio' && !_.contains(allowedStreamingAudioTypes, path.extname(src).replace(".", ""))){
                var libraryEntry = library.getByUid(uuid),
                    audio = {
                        duration: libraryEntry.duration,
                        location: libraryEntry.file,
                        uid: libraryEntry.uid,
                        sessionId: req.sessionID
                    };
                logger.debug(audio);
                transcoder.transcode(audio, req, res);
            } else {
                logger.debug(src);
                var reqStreaming = _.clone(req),
                    settings = {
                        "mode": "development",
                        "forceDownload": false,
                        "random": false,
                        "rootFolder": nconf.get("library"),
                        "rootPath": "stream",
                        "server": "VidStreamer.js/0.1.4"
                    },
                    vidStreamer = require("vid-streamer").settings(settings);
                reqStreaming.url = "/stream/" + src;
                vidStreamer(reqStreaming, res);
            }
        }
    };

    /*
     * Add session objs in view params
     */
    Middleware.session = function (middlewareObject, next) {
        logger.debug(middlewareObject.objs);

        var urlServer = null;

        if (middlewareObject.req.headers.host.lastIndexOf(":" + nconf.get("port")) != -1){
            urlServer = middlewareObject.req.headers.host.substring(0, middlewareObject.req.headers.host.length - (nconf.get("port").length + 1));
        } else {
            urlServer = middlewareObject.req.headers.host;
        }

        var serverConfig = {
            serverurl: urlServer,
            serverport: nconf.get("port")
        };

        // that's ok
        if (middlewareObject.objs === undefined) {
            middlewareObject.objs = {
                session: {}
            };
        } else if (middlewareObject.objs.session === undefined) {
            middlewareObject.objs.session = {};
        }

        _.extend(middlewareObject.objs, serverConfig);
        middlewareObject.objs.session.user = {
            isAnonymous: true,
        };

        if (middlewareObject.req.session.chats === undefined) {
            middlewareObject.req.session.chats = [];
        }
        middlewareObject.objs.session.chats = middlewareObject.req.session.chats;

        middlewareObject.objs.session.notifications = {
            count: 2,
            datas: ["Application is still in beta access.", "Songs rights are free licenced."]
        };

        // config
        middlewareObject.objs.meta = {
            requireAuthentication: false
        };

        meta.settings.getOne("global", "require-authentication", function (err, curValue) {
            if (err) {
                logger.debug("userauth error checking");
            } else if (curValue === "true") {
                middlewareObject.objs.meta.requireAuthentication = true;
            }

            if (middlewareObject.req.isAuthenticated()) {
                middlewareObject.objs.session.user = middlewareObject.req.user;

                middlewareObject.objs.session.user.avatar = Middleware.getAvatar(middlewareObject.req.user.username);
                middlewareObject.objs.session.user.isAnonymous = false;

                // Retrieve role type
                next(null, middlewareObject);
            } else {
                logger.debug("return middleware: " + middlewareObject);
                next(null, middlewareObject);
            }
        });

        middlewareObject.objs.session.hostname = nconf.get("hostname");
        middlewareObject.objs.session.host = nconf.get("hostname").concat(":").concat(nconf.get("port"));
    };

    /**
    * Checking user file served or not depending of the file type [cover/avatar...].
    */
    Middleware.hasImageFile = function (username, type){
      var imageDirectory = __dirname + "/../../../users/",
          imageFile = imageDirectory + username + "/" + type;
      if (!fs.existsSync(imageDirectory)) {
          fs.mkdirSync(imageDirectory);
          logger.info("folder user not exists. Create one.");
      }
      return fs.existsSync(imageFile);
    };

    /**
    * Check if user has a served avatar.
    */
    Middleware.hasAvatar = function (username){
      return this.hasImageFile(username, "avatar");
    };
    /**
    * Check if user has a served cover.
    */
    Middleware.hasCover = function (username){
      return this.hasImageFile(username, "cover");
    };

    /**
    * Get generic file location depending of the type.
    */
    Middleware.getImageFile = function (username, type){
      var urlUser = null;

      if (this.hasImageFile(username, type)){
        var imageDirectory = __dirname + "/../../../users/",
            imageFile = imageDirectory + username + "/" + type;
        urlUser = path.resolve(imageFile);
      }
      return urlUser;
    };

    /**
    * Get the avatar file location of a user for serving.
    */
    Middleware.getAvatar = function (username) {
      var urlUser = this.getImageFile(username, "avatar");
      var imageDirectory = __dirname + "/../../../users/",
          imageFile = imageDirectory + username + "/avatar";
      if (imageFile === null){
        if (!nconf.get("gravatar")) {
          if (identicon) {
              identicon.generate(username, 150, function (err, buffer) {
                  if (err) {
                      throw err;
                  }

                  fs.writeFileSync(imageFile, buffer);
              });
              urlUser = path.resolve(imageFile);
          }
        } else {
            urlUser = gravatar.url(username, {s: '200', r: 'pg', d: 'identicon'});
        }
      }
      return urlUser;
    };

    /**
    * Get the cover file of a user.
    */
    Middleware.getCover = function (username) {
      return this.getImageFile(username, "cover");
    };

    /*
     * Add meta config of user in view params
     */
    Middleware.meta = function (middlewareObject, next) {
        if (middlewareObject.objs !== undefined) {
            middlewareObject.objs.meta = {};
        } else {
            middlewareObject.objs = {
                meta: {}
            };
        }
        next(null, middlewareObject);
    };


    /*
     * Post a method (test if user is authenticated)
     */
    Middleware.post = function (req, res, callback) {
        if (!req.isAuthenticated()) {
            res.send('403', 'You need to be logged');
        } else {
            callback();
        }
    };

    Middleware.requireAuthentication = function (req) {
        return false;
        //return !req.isAuthenticated();
    };

    Middleware.isAuthenticated = function (req) {
        return req.isAuthenticated();
    };


}(exports));
