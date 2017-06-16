(function (Authenticator) {
    "use strict";

  var passport = require('passport'),
    LocalStrategy = require('passport-local').Strategy,
    nconf = require('nconf'),

    logger = require('log4js').getLogger("authenticate"),
    middleware = require('./../middleware/middleware'),
    authority = require('./../middleware/authority'),
    meta = require('./../meta'),
    utils = require('./../utils'),
    user = require('./../model/user');

  var view = {
    register : function(req, res, viewtype){

      user.count(function(err, usercount){
        meta.settings.getOne("global", "allowRegisteration", function(err, val){
          if (parseInt(val) > 0){
            if (viewtype){
              middleware.render("api/middleware/register", req, res, {
                registerLeft: parseInt(val) - usercount > 0 ? parseInt(val) - usercount: 0,
              });
            } else {
              middleware.render("middleware/register", req, res, {
                registerLeft: parseInt(val) - usercount > 0 ? parseInt(val) - usercount : 0,
              });
            }
          } else {
            if (viewtype){
              middleware.render("api/middleware/disabled", req, res);
            } else {
              middleware.render("middleware/disabled", req, res);
            }
          }
        });
      });
    },
    login: function (req, res, viewtype) {
      if (req.session === undefined  || req.session.redirectTo !== undefined) {
        req.session.redirectTo = "/";
      }
      if (viewtype){
        middleware.render('api/middleware/login', req, res);
      } else {
        middleware.render('middleware/login', req, res);
      }
    }
  }

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

    app.get('/register', function (req, res){
      view.register(req, res);
    });
    app.get('/api/view/register', function (req, res){
      view.register(req, res, true);
    });
    app.get('/api/view/login', function (req, res){
      view.login(req, res, true);
    });
    app.get('/login', function (req, res){
      view.login(req, res);
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
      username: user.username,
      administrator : user.administrator
    });
  });
}(exports));
