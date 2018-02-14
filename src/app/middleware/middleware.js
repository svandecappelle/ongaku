/*jslint node: true */
const async = require('async');
const nconf = require('nconf');
const fs = require('fs');
const _ = require("underscore");
const path = require("path");
const logger = require('log4js').getLogger("Middleware");
const scanner = require("./scanner");
const library = require("./library");
const transcoder = require("./transcoder");
const meta = require("./../meta");
const translator = require("./translator");
const streamer = require("./streamer");


const gravatar = require("gravatar");
var identicon;
try {
    identicon = require("identicon");
} catch (err){
  logger.warn("identicon disabled");
}

var allowedStreamingAudioTypes = ["mp3", "ogg"];

var USERS_IMAGE_DIRECTORY = path.join(__dirname, "/../../../public/user/");
if (!fs.existsSync(USERS_IMAGE_DIRECTORY)) {
    fs.mkdirSync(USERS_IMAGE_DIRECTORY);
    logger.info("User folder not exists. Create one.");
}

new translator.preload();
try {
    identicon = require('identicon');
} catch (expect) {
    logger.warn("Not installed optional extension: identicon it will not be used.");
}


class Middleware {

    /*
     * Render a view. Control if rights are valid to access the view and if user is authenticated (if needed).
     */
    render (view, req, res, objs) {
        var viewParams = objs,
            middlewareObject = {
                req: req,
                res: res,
                view: view,
                objs: viewParams
            },
            call = async.compose((middlewareObject, next) => {
                if (middlewareObject.req.isAuthenticated()) {
                    middlewareObject.objs.session.user.avatar = this.getAvatar(middlewareObject.req.user.username);
                    middlewareObject.objs.session.user.cover = this.getCover(middlewareObject.req.user.username);
                }
                next(null, middlewareObject);
            }, this.session, this.meta, this.translate);

        if (viewParams === undefined) {
            viewParams = {};
        }

        if (middlewareObject.objs === undefined) {
            middlewareObject.objs = {};
        }

        if (middlewareObject.objs.session === undefined) {
            middlewareObject.objs.session = {};
        }
        middlewareObject.objs.theme = nconf.get("theme");
        middlewareObject.objs.languages = translator.getAvailableLanguages();

        call(middlewareObject, (err, middlewareObject) => {

            var play = null,
                message = null;

            if (req.session.playlist) {
                play = _.first(req.session.playlist);
            }

            _.extend(middlewareObject.objs, {
                data: {
                    playing: play,
                    playlist: req.session.playlist ? req.session.playlist : [],
                    message: message
                }
            });

            logger.debug(middlewareObject.objs.session);
            logger.debug("meta: ", middlewareObject.objs.meta);
            res.render(view, middlewareObject.objs);
        });
    };

    json (req, res, json) {
        res.json(json);
    };

    /*
     * Send redirect to client.
     */
    redirect (view, res) {
        res.redirect(view);
    };

    stream (req, res, uuid, type) {
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
                src = library.getRelativePath(path.basename(uuid)),
                extension =  path.extname(src).replace(".", "");
            if (type === 'audio' && !_.contains(allowedStreamingAudioTypes, extension)){
                logger.info(src, "type: " + type, path.extname(src).replace(".", ""), "not in allowed direct streaming type need to convert: ", allowedStreamingAudioTypes);
                var libraryEntry = library.getByUid(uuid),
                    audio = {
                        duration: libraryEntry.duration,
                        location: libraryEntry.file,
                        uid: libraryEntry.uid,
                        sessionId: req.sessionID,
                        extname: extension
                    };
                logger.debug(audio);
                transcoder.transcode(audio, req, res);
            } else {
                var reqStreaming = _.clone(req),
                    settings = {
                        "mode": "development",
                        "forceDownload": false,
                        "insertContentDisposition": false,
                        "random": false,
                        "rootFolder": "/",
                        "rootPath": "stream"
                    };
                //if (nconf.get("ostype") == 'windows'){
                //  logger.info('os is windows');
                // Windows doesn't have save same rootPatht definitions that unix / linux
                if (process.platform.indexOf('win') !== -1){
                  src = src.replace("C:\\", "");
                  settings.rootFolder = "C:\\";
                }
                streamer.settings(settings);
                reqStreaming.url = "/stream/" + src;
                streamer.call(reqStreaming, res);
            }
        }
    };

    /*
     * Add session objs in view params
     */
    session (middlewareObject, next) {
        logger.debug(middlewareObject.objs);
        middlewareObject.objs.session = middlewareObject.req.session;

        var urlServer = null;

        if (middlewareObject.req.headers.host.lastIndexOf(":" + nconf.get("port")) != -1){
            urlServer = middlewareObject.req.headers.host.substring(0, middlewareObject.req.headers.host.length - (nconf.get("port").length + 1));
        } else {
            urlServer = middlewareObject.req.headers.host;
        }

        var serverConfig = {
            serverurl: urlServer,
            serverport: nconf.get("port"),
            configuration: {
              allowUpload: nconf.get("allowUpload")
            }
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

        middlewareObject.objs.session.sessionID = middlewareObject.req.sessionID;

        middlewareObject.objs.session.chats = middlewareObject.req.session.chats;

        meta.settings.getOne("global", "notifications", (err, curValue) => {
          if (!err && curValue){
            middlewareObject.objs.session.notifications = {
              count: curValue.split(";").length,
              datas: curValue.split(";")
            };
          } else {
            middlewareObject.objs.session.notifications = {
              count: 0,
              datas: []
            };
          }

          // config
          middlewareObject.objs.meta.requireAuthentication = false;

          meta.settings.getOne("global", "requireLogin", (err, curValue) => {
              if (err) {
                  logger.debug("userauth error checking");
              } else if (curValue === "true") {
                  middlewareObject.objs.meta.requireAuthentication = true;
              }

              if (middlewareObject.req.isAuthenticated()) {
                  middlewareObject.objs.session.user = middlewareObject.req.user;

                  middlewareObject.objs.session.user.isAnonymous = false;

                  if (middlewareObject.objs.session.passport.user.tokenId) {
                    middlewareObject.objs.session.user.tokenId = middlewareObject.objs.session.passport.user.tokenId;
                  }
                  // Retrieve role type
                  next(null, middlewareObject);
              } else {
                  logger.debug("return middleware: " + middlewareObject);
                  next(null, middlewareObject);
              }
          });

          middlewareObject.objs.session.hostname = nconf.get("hostname");
          middlewareObject.objs.session.host = nconf.get("hostname").concat(":").concat(nconf.get("port"));

        });
    };

    /**
    * Checking user file served or not depending of the file type [cover/avatar...].
    */
    hasImageFile (username, type){
      var imageFile = USERS_IMAGE_DIRECTORY + username + "/" + type;
      return fs.existsSync(imageFile);
    };

    /**
    * Check if user has a served avatar.
    */
    hasAvatar (username){
      return this.hasImageFile(username, "avatar");
    };
    /**
    * Check if user has a served cover.
    */
    hasCover (username){
      return this.hasImageFile(username, "cover");
    };

    /**
    * Get generic file location depending of the type.
    */
    getImageFile (username, type){
      var urlUser = null;
      var imageFile = "/user/" + username + "/" + type;
      urlUser = path.resolve(imageFile);

      if (!this.hasImageFile(username, type)){
        if (identicon) {
          if (!fs.existsSync(USERS_IMAGE_DIRECTORY + username)){
            fs.mkdirSync(USERS_IMAGE_DIRECTORY + username);
          }
          identicon.generate(type === "avatar" ? username : username + "-" + type, type === "avatar" ? 150 : 600, function (err, buffer) {
            if (err) {
              throw err;
            }
            fs.writeFileSync(USERS_IMAGE_DIRECTORY + username + "/" + type, buffer);
          });
        }
      }

      return urlUser;
    };

    /**
    * Get the avatar file location of a user for serving.
    */
    getAvatar (username) {
      var urlUser = this.getImageFile(username, "avatar");
      var imageFile = "/user/" + username + "/avatar";
      if (urlUser === null){
        if (!nconf.get("gravatar")) {
          if (identicon) {
            if (!fs.existsSync(USERS_IMAGE_DIRECTORY + username)){
              fs.mkdirSync(USERS_IMAGE_DIRECTORY + username);
            }
            identicon.generate(username, 150, function (err, buffer) {
                if (err) {
                    throw err;
                }
                fs.writeFileSync(USERS_IMAGE_DIRECTORY + username + "/avatar", buffer);
            });
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
    getCover (username) {
      return this.getImageFile(username, "cover");
    };

    /**
    * Get the cover file of a user.
    */
    getBackground (username) {
      return this.getImageFile(username, "background");
    };

    /*
     * Add meta config of user in view params
     */
    meta (middlewareObject, next) {
        if (middlewareObject.objs !== undefined) {
            middlewareObject.objs.meta = {};
        } else {
            middlewareObject.objs = {
                meta: {}
            };
        }

        meta.settings.get(["global"], function (err, allvalues) {
          if (!err && allvalues){
            allvalues.database = "******";
            allvalues.redis = "******";
            allvalues.secret = "******";
            middlewareObject.objs.meta = allvalues;
          }
          next(null, middlewareObject);
        });


    };

    sessionSave (req, callback) {
      req.session.save(function () {
        if (callback) {
          callback();
        }
      });
    }
    /*
     * Post a method (test if user is authenticated)
     */
    post (req, res, callback) {
        if (!req.isAuthenticated()) {
            res.send('403', 'You need to be logged');
        } else {
            callback();
        }
    };

    requireAuthentication (req) {
        return false;
        //return !req.isAuthenticated();
    };

    isAuthenticated (req) {
        return req.isAuthenticated();
    };

    /*
     * Translate view
     */
    translate (middlewareObject, next) {
    	// Add I18n values
    	var locale = nconf.get('defaultLanguage');

    	if (middlewareObject.req && middlewareObject.req.session && middlewareObject.req.session.locale){
    		locale = middlewareObject.req.session.locale;
    	}

    	var i18nValues = new translator.Language(locale);
    	_.extend(middlewareObject.objs, {i18n: i18nValues.get(middlewareObject.view)});
    	next(null, middlewareObject);
    };
}

module.exports = new Middleware();
