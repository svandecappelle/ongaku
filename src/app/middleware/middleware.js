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
        gravatar = require("gravatar"),
        identicon;

    try {
        identicon = require('identicon');
    } catch (expect) {
        logger.warn("Not compatible optional extension: identicon.");
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

            logger.info(middlewareObject.objs.session);
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
        logger.info("start stream file: " + uuid);
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

            if (path.extname(src).replace(".", "") !== 'mp3' && type === 'audio'){
                var libraryEntry = library.getByUid(uuid),
                    audio = {
                        duration: libraryEntry.duration,
                        location: libraryEntry.file,
                        uid: libraryEntry.uid,
                        sessionId: req.sessionID
                    };
                logger.info(audio);
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
        logger.warn(middlewareObject.objs);

        var urlUser = '/img/anonymous.jpg',
            urlServer = null;

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
            datas: ["test", "test2"]
        };


        if (middlewareObject.req.isAuthenticated()) {
            urlUser = gravatar.url(middlewareObject.req.user.uid, {s: '200', r: 'pg', d: '404'});
            // generate a url through identicon if none found on gravatar
            if (urlUser.lastIndexOf("404") !== -1) {
                var avatarPathFile = __dirname + "/../../public" + nconf.get("upload_path") + '/users/icons/' + middlewareObject.req.user.username + '.png';
                if (!fs.existsSync(avatarPathFile)) {
                    if (identicon) {
                        identicon.generate(middlewareObject.req.user.uid, 150, function(err, buffer) {
                            if (err) throw err;
                            fs.writeFileSync(avatarPathFile, buffer);
                        });
                    }
                }
                urlUser = nconf.get("upload_path") + '/users/icons/' + middlewareObject.req.user.username + '.png';
            }
            middlewareObject.objs.session.user = middlewareObject.req.user;
            middlewareObject.objs.session.user.isAnonymous = false;

            // Retrieve role type
            next(null, middlewareObject);
        }else{
            logger.debug("return middleware: " + middlewareObject);
            next(null, middlewareObject);
        }

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

}(exports));