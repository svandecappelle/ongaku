(function (Authority) {
    "use strict";

  var passport = require('passport'),
    bcrypt = require('bcryptjs'),
    nconf = require('nconf'),
    logger = require('log4js').getLogger("authority"),

    middleware = require("./middleware"),
    meta = require('./../meta'),
    user = require('./../model/user'),
    db = require('./../model/database'),
    utils = require('./../utils');

    Authority.logout = function (req, res) {
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
    };

    Authority.authenticate = function(req, res, next) {
      if (meta.config.allowLocalLogin !== undefined && parseInt(meta.config.allowLocalLogin, 10) === 0) {
        return res.send(404);
      }
      passport.authenticate('local', function (err, userData, info) {
        var duration;
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

        if (req.body.remember === 'on') {
          duration = 1000 * 60 * 60 * 24 * parseInt(meta.config.loginDays || 14, 10);
          req.session.cookie.maxAge = duration;
          logger.warn("Saving session for: " + duration + "ms");
        } else {
          duration = 1000 * 60 * 60;
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
    };

   Authority.register = function (req, res) {
    user.count(function(err, usercount){
      meta.settings.getOne("global", "allowRegisteration", function(err, val){
        if (usercount < val){
          var userData = {
              username: req.body.username,
              password: req.body.password,
              email: req.body.email,
              ip: req.ip
          };

          user.create(userData, function (err, uid) {
            if (err || !uid) {
              return res.redirect('/register');
            }

            req.login({
              uid: uid,
            }, function () {
              // TODO log conncetion on database
              //user.logIP(uid, req.ip);
              // for the connected users count
              //require('../socket.io').emitUserCount();
              req.user.username = userData.username;
              if (req.body.referrer) {
                res.redirect(req.body.referrer);
              } else {
                res.redirect('/');
              }
            });
          });
        } else {
          req.session.error = "Maximum user registered";
          res.redirect("/500");
        }
      });
    });
  };

  Authority.login = function (username, password, done) {
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
            });
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
}(exports));
