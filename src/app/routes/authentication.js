const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const nconf = require('nconf');
const logger = require('log4js').getLogger("authenticate");
const middleware = require('./../middleware/middleware');
const authority = require('./../middleware/authority');
const meta = require('./../meta');
const utils = require('./../utils');
const user = require('./../model/user');

class Authenticator {

  constructor () {
    passport.use(new LocalStrategy(authority.login));

    passport.serializeUser((user, done) => {
      done(null, user);
    });

    passport.deserializeUser((user, done) => {
      done(null, {
        uid: user.uid,
        username: user.username,
        administrator : user.administrator
      });
    });
  }

  register (req, res, viewtype) {
    user.count(function(err, usercount){
      meta.settings.getOne("global", "allowRegisteration", (err, val) => {
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
  };

  login (req, res, viewtype) {
    if (req.session === undefined  || req.session.redirectTo !== undefined) {
      req.session.redirectTo = "/";
    }
    if (viewtype){
      middleware.render('api/middleware/login', req, res);
    } else {
      middleware.render('middleware/login', req, res);
    }
  }

  initialize (app) {
    app.use(passport.initialize());
    app.use(passport.session());
  };

  registerApp (app) {
    Authenticator.app = app;
  };

  load (app) {
    //app.get('/api/login', middleware.redirectToAccountIfLoggedIn, controllers.login);
    app.get('/logout', authority.logout);

    app.get('/register', (req, res) => {
      this.register(req, res);
    });
    app.get('/api/view/register', (req, res) => {
      this.register(req, res, true);
    });
    app.get('/api/view/login', (req, res) => {
      this.login(req, res, true);
    });
    app.get('/login', (req, res) => {
      this.login(req, res);
    });

    app.post('/logout', authority.logout);
    app.post('/register', authority.register);
    app.post('/login', (req, res, next) => {
      if (req.body.username && utils.isEmailValid(req.body.username)) {
        user.getUsernameByEmail(req.body.username, (err, username) => {
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
}

module.exports = new Authenticator();
