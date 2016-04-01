(function (Authenticator) {
    "use strict";

    var passport = require('passport'),
        LocalStrategy = require('passport-local').Strategy,
        nconf = require('nconf'),

        logger = require('log4js').getLogger("authenticate"),
        middleware = require('./../middleware/middleware'),
        authority = require('./../middleware/authority'),
        utils = require('./../utils');

    Authenticator.initialize = function (app) {
      app.use(passport.initialize());
      app.use(passport.session());
    };

    Authenticator.registerApp = function (app) {
      Authenticator.app = app;
    };

    Authenticator.load = function (app) {
      //app.get('/api/login', middleware.redirectToAccountIfLoggedIn, controllers.login);
      app.get('/logout', authority.logout);

      app.get('/login', function (req, res) {
        if (req.session === undefined  || req.session.redirectTo !== undefined) {
          req.session.redirectTo = "/";
        }
        middleware.render('middleware/login', req, res);
      });

      app.post('/logout', authority.logout);
      app.post('/register', authority.register);
      app.post('/login', function (req, res, next) {
        if (req.body.username && utils.isEmailValid(req.body.username)) {
          user.getUsernameByEmail(req.body.username, function (err, username) {
            if (err) {
              return next(err);
            }
            req.body.username = username ? username : req.body.username;
            authority.authenticate(req, res, next);
          });
        } else {
          authority.authenticate(req, res, next);
        }
      });
    };

    passport.use(new LocalStrategy(authority.login));

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
