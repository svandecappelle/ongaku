(function(Auth) {
	"use strict";

	var passport = require('passport'),
		LocalStrategy = require('passport-local').Strategy,
		nconf = require('nconf'),
		logger = require('log4js').getLogger("authenticate"),
		middleware = require('./middleware');


	function logout(req, res) {
		if (req.isAuthenticated()) {
			logger.info('[Auth] Session ' + req.sessionID + ' logout (uid: ' + req.session.passport.user + ')');

			// use it for alert disconnect of other sessions (and users)
			/*
				var ws = require('../socket.io');
				ws.logoutUser(req.user.uid);
			*/
			req.logout();
		}

		middleware.redirect('/', res);
	}

	function login(req, res, next) {
		passport.authenticate('local', function(err, userData, info) {
			if (err) {
				return next(err);
			}

			if (!userData) {
				return res.json(403, info);
			}

			// Alter user cookie depending on passed-in option
			if (req.body.remember === 'true') {
				var duration = 1000*60*60*24*parseInt(meta.configs.loginDays || 14, 10);
				req.session.cookie.maxAge = duration;
				req.session.cookie.expires = new Date(Date.now() + duration);
			} else {
				req.session.cookie.maxAge = false;
				req.session.cookie.expires = false;
			}
			req.logIn({
				uid: userData.uid,
				username: req.body.username
			}, function() {
				if (userData.uid) {
					//user.logIP(userData.uid, req.ip);
					logger.info("user '"+userData.uid+"' connected on: " + req.ip);
				}
				if(req.session.redirectTo !== undefined){
					middleware.redirect(req.session.redirectTo, res);
					req.session.redirectTo = undefined;
				}else{
					middleware.redirect('/#demoreel', res);
					req.session.redirectTo = undefined;
				}
			});
		})(req, res, next);
	}

	Auth.initialize = function(app) {
		app.use(passport.initialize());
		app.use(passport.session());
	};

	Auth.registerApp = function(app) {
		Auth.app = app;
	};

	Auth.createRoutes = function(app) {
		
		//app.get('/api/login', middleware.redirectToAccountIfLoggedIn, controllers.login);
		app.get('/logout', logout);

		app.post('/logout', logout);
		
		app.post('/login', function(req, res, next) {
			login(req, res, next);
		});

		app.get('/login', function(req, res, next) {
			middleware.render('login', req, res);
		});
	};

	Auth.login = function(username, password, done) {
		if (!username || !password) {
			return done(new Error('[[error:invalid-user-data]]'));
		}

		if (!password) {
			return done(new Error('[[error:invalid-user-data]]'));
		}

		if (password === nconf.get("access-passwd")){
			done(null, {
				uid: username
			}, '[[success:authentication-successful]]');
		}else{
			return done(null, false, '[[error:invalid-password]]');
		}
	};

	passport.use(new LocalStrategy(Auth.login));

	passport.serializeUser(function(user, done) {
		done(null, user);
	});

	passport.deserializeUser(function(user, done) {
		done(null, {
			uid: user.uid,
			username: user.username
		});
	});
}(exports));