var passport = require('passport'),
bcrypt = require('bcryptjs'),
path = require('path'),
_ = require('underscore'),
nconf = require('nconf'),
logger = require('log4js').getLogger("authority"),
async = require("async"),

middleware = require("./middleware"),
communication = require("./../communication"),
meta = require('./../meta'),
user = require('./../model/user'),
db = require('./../model/database'),
library = require('./library'),
security = require('./../model/security'),
utils = require('./../utils');


const USERS_IMAGE_DIRECTORY = path.join(__dirname, "/../../../public/user/");

class Authority {

    logout (req, res) {
      if (req.isAuthenticated()) {
        logger.info('[Auth] Session ' + req.sessionID + ' logout (uid: ' + req.session.passport.user + ')');
        req.session.locale = nconf.get("defaultLocale");

        setTimeout(() => {
          communication.emit(req.session.sessionID, "notification", { message: 'disconnected from application' });
        }, 1500);

        req.logout();
      }

      middleware.redirect('/', res);
    };

    authenticate (req, res, next) {
      if (meta.config.allowLocalLogin !== undefined && parseInt(meta.config.allowLocalLogin, 10) === 0) {
        return res.send(404);
      }
      passport.authenticate('local', (err, userData, info) => {
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
        logger.info("Connecting: " , userData);
        if (userData.settings){
          req.session = _.extend(req.session, userData.settings);
        }

        if (userData.settings && userData.settings.locale){
          req.session.locale = userData.settings.locale;
        } else {
          req.session.locale = nconf.get("defaultLocale");
        }

        user.isAdministrator(userData.uid, (err, admin) => {
          userData.administrator = admin;
          var userBean = {
            uid: userData.uid,
            username: req.body.username,
            tokenId: userData.security,
            administrator: userData.administrator
          };
          req.logIn(userBean, () => {
            if (userData.uid) {
              //user.logIP(userData.uid, req.ip);
              logger.info("user '" + userData.uid + "' connected on: " + req.ip);
              communication.setStatus(userBean.username, 'online');
              setTimeout(function(){
                communication.emit(req.session.sessionID, 'application:connected', req.sessionID);
              }, 1500);

            }

            var folderScanning = {
              private: true,
              path: USERS_IMAGE_DIRECTORY + userBean.username,
              username: userBean.username
            }

            library.addFolder(folderScanning, (scanResults) => {
              if ( scanResults.audio ) {
                req.session.library = scanResults;
                logger.info(scanResults);
                middleware.sessionSave(req);
              }
            });

            if (req.session.redirectTo !== undefined) {
              middleware.redirect(req.session.redirectTo, res);
              req.session.redirectTo = undefined;
            } else {
              middleware.redirect('/', res);
              req.session.redirectTo = undefined;
            }
          });
        });
      })(req, res, next);
    };

   register (req, res) {
    user.count((err, usercount) => {
      meta.settings.getOne("global", "allowRegisteration", (err, val) => {
        if (usercount < parseInt(val)){
          var userData = {
              username: req.body.username,
              password: req.body.password,
              email: req.body.email,
              ip: req.ip
          };

          user.create(userData, (err, uid) => {
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

  login (username, password, done) {
    if (!username || !password) {
      return done(new Error('[[error:invalid-user-data]]'));
    }

    var userslug = username;

    user.getUidByUsername(userslug, (err, uid) => {
      if (err) {
        return done(err);
      }

      if (!uid) {
        // To-do: Even if a user doesn't exist, compare passwords anyway, so we don't immediately return
        return done(null, false, '[[error:no-user]]');
      }

      user.auth.logAttempt(uid, (err) => {
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

        db.getObjectFields('user:' + uid, ['password', 'banned'], (err, userData) => {
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

          bcrypt.compare(password, userData.password, (err, res) => {
            if (err) {
              return done(new Error('bcrypt compare error'));
            }
            if (!res) {
              return done(null, false, {
                code: 401,
                message: '[[error:invalid-password]]'});
            }

            user.auth.clearLoginAttempts(uid);

            async.auto({
              settings: (next) => {
                user.getSettings(uid, next);
              },
              security: (next) => {
                security.getAccessId(uid, next);
              }
            }, (err, results) => {
              done(null, {
                uid: uid,
                settings: results.settings,
                security: results.security
              }, '[[success:authentication-successful]]');
            });

          });
        });
      });
    });
  };
}

module.exports = new Authority();
