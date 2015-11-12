(function (Auth) {
    "use strict";

    var passport = require('passport'),
        LocalStrategy = require('passport-local').Strategy,
        nconf = require('nconf'),
        bcrypt = require('bcryptjs'),
        logger = require('log4js').getLogger("authenticate"),
        meta = require('./../meta'),
        user = require('./../model/user'),
        db = require('../model/database'),
        utils = require('./../../../public/lib/utils'),
        middleware = require('./../middleware/middleware');


    function logout(req, res) {
        if (req.isAuthenticated()) {
            logger.info('[Auth] Session ' + req.sessionID + ' logout (uid: ' + req.session.passport.user + ')');

            // use it for alert disconnect of other sessions (and users)
            /*
                var ws = require('../socket.io');
                ws.logoutUser(req.user.uid);
            */
            // chat.disconnect(req.user);
            req.logout();
        }

        middleware.redirect('/', res);
    }

    function login(req, res, next) {
        if (meta.config.allowLocalLogin !== undefined && parseInt(meta.config.allowLocalLogin, 10) === 0) {
            return res.send(404);
        }
        passport.authenticate('local', function (err, userData, info) {
            if (err) {
                return next(err);
            }

            if (!userData) {
              logger.warn("login attempt fails: ", info);
              middleware.redirect('/login?error='.concat(info.code), res);
              // return res.json(403, info);
              return;
            }

            // Alter user cookie depending on passed-in option
            if (req.body.remember === 'true') {
                var duration = 1000 * 60 * 60 * 24 * parseInt(meta.configs.loginDays || 14, 10);
                req.session.cookie.maxAge = duration;
            } else {
                var duration = 1000 * 60 * 60;
                req.session.cookie.maxAge = duration;
            }
            req.logIn({
                uid: userData.uid,
                username: req.body.username
            }, function () {
                if (userData.uid) {
                    //user.logIP(userData.uid, req.ip);
                    logger.info("user '" + userData.uid + "' connected on: " + req.ip);
                }
                if (req.session.redirectTo !== undefined) {
                    middleware.redirect(req.session.redirectTo, res);
                    req.session.redirectTo = undefined;
                } else {
                    middleware.redirect('/', res);
                    req.session.redirectTo = undefined;
                }
            });

        })(req, res, next);
    }

    function register(req, res) {
        if (meta.config.allowRegistration !== undefined && parseInt(meta.config.allowRegistration, 10) === 0) {
            return res.send(403);
        }

        var userData = {
            username: req.body.username,
            password: req.body.password,
            email: req.body.email,
            ip: req.ip
        };

        plugins.fireHook('filter:register.check', userData, function(err, userData) {
            if (err) {
                return res.redirect(nconf.get('relative_path') + '/register');
            }

            user.create(userData, function (err, uid) {
                if (err || !uid) {
                    return res.redirect(nconf.get('relative_path') + '/register');
                }

                req.login({
                    uid: uid
                }, function () {
                    user.logIP(uid, req.ip);

                    require('../socket.io').emitUserCount();

                    if (req.body.referrer) {
                        res.redirect(req.body.referrer);
                    } else {
                        res.redirect(nconf.get('relative_path') + '/');
                    }
                });
            });
        });
    }

    Auth.initialize = function (app) {
        app.use(passport.initialize());
        app.use(passport.session());
    };

    Auth.registerApp = function (app) {
        Auth.app = app;
    };

    Auth.createRoutes = function (app) {
        //app.get('/api/login', middleware.redirectToAccountIfLoggedIn, controllers.login);
        app.get('/logout', logout);

        app.get('/login', function (req, res) {
            if (req.session === undefined  || req.session.redirectTo !== undefined) {
                req.session.redirectTo = "/";
            }
            middleware.render('login', req, res);
        });

        app.post('/logout', logout);
        app.post('/register', register);
        app.post('/login', function (req, res, next) {
            if (req.body.username && utils.isEmailValid(req.body.username)) {
                user.getUsernameByEmail(req.body.username, function (err, username) {
                    if (err) {
                        return next(err);
                    }
                    req.body.username = username ? username : req.body.username;
                    login(req, res, next);
                });
            } else {
                login(req, res, next);
            }
        });
    };

    Auth.login = function (username, password, done) {
        if (!username || !password) {
            return done(new Error('[[error:invalid-user-data]]'));
        }

        var userslug = utils.slugify(username);

        user.getUidByUsername(userslug, function (err, uid) {
            if (err) {
                return done(err);
            }

            if (!uid) {
                // To-do: Even if a user doesn't exist, compare passwords anyway, so we don't immediately return
                return done(null, false, '[[error:no-user]]');
            }

            user.auth.logAttempt(uid, function (err) {
                if (err) {
                  if ("[[error:account-locked]]" === err.message){
                    return done(null, false, {
                      code: '417',
                      message: err.message
                    })
                  } else {
                    return done(null, false, err.message);
                  }
                }

                db.getObjectFields('user:' + uid, ['password', 'banned'], function (err, userData) {
                    if (err) {
                        return done(err);
                    }

                    if (!userData || !userData.password) {
                        return done(new Error('[[error:invalid-user-data]]'));
                    }

                    if (userData.banned && parseInt(userData.banned, 10) === 1) {
                        return done(null, false, {
                          code: 403,
                          message: '[[error:user-banned]]'
                        });
                    }

                    bcrypt.compare(password, userData.password, function (err, res) {
                        if (err) {
                            return done(new Error('bcrypt compare error'));
                        }
                        if (!res) {
                            return done(null, false, {
                              code: 401,
                              message: '[[error:invalid-password]]'});
                        }

                        user.auth.clearLoginAttempts(uid);

                        done(null, {
                            uid: uid
                        }, '[[success:authentication-successful]]');
                    });
                });
            });
        });
    };

    passport.use(new LocalStrategy(Auth.login));

    passport.serializeUser(function (user, done) {
        done(null, user);
    });

    passport.deserializeUser(function (user, done) {
        done(null, {
            uid: user.uid,
            username: user.username
        });
    });
}(exports));
