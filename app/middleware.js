/*jslint node: true */
"use strict";

var middleware = {},
	async = require('async'),
	nconf = require('nconf'),
	fs = require('fs'),
	logger = require('log4js').getLogger("Middleware");

/*
	Render a view. Control if rights are valid to access the view and if user is authenticated (if needed).
 */
middleware.render = function(view, req, res, objs){
	var viewParams = objs;
	if (viewParams === undefined){
		viewParams = {};
	}
	var middlewareObject = {
		req: req,
		res: res,
		view: view,
		objs: viewParams
	};

	var call = async.compose(this.session, this.meta);

	call(middlewareObject, function(err, middlewareObject){
		res.render(view, middlewareObject.objs);
	});
};

/*
	Send redirect to client.
 */
middleware.redirect = function(view, res){
	res.redirect(view);
};

middleware.getVideo = function(req, res, path){
	if (this.requireAuthentication(req)){
		// need an auth
		logger.info("Client not connected: cannot acces to video ["+req.ip+"]");
		req.session.redirectTo = req.originalUrl;
		res.json({error: 'Need privileges'});
		res.end();
	}else{
		logger.info("Stream video");
		var fs = require("fs");
		var src = path;

		var settings = {
			"mode": "development",
			"forceDownload": false,
			"random": false,
			"rootFolder": "./video",
			"rootPath": "video",
			"server": "VidStreamer.js/0.1.4"
		};

		var vidStreamer = require("vid-streamer").settings(settings);
		vidStreamer(req, res);
	}
};

/*
	Add session objs in view params
 */
middleware.session = function(middlewareObject, next){
	if (middlewareObject.req.isAuthenticated()){
		middlewareObject.objs.isAnonymous = false;
		next(null, middlewareObject);
	}else{
		middlewareObject.objs.isAnonymous = true;
		next(null, middlewareObject);
	}
};

/*
	Add meta config of user in view params
 */
middleware.meta = function(middlewareObject, next){
	middlewareObject.objs.meta = {};
	next(null, middlewareObject);
};


/*
	Post a method (test if user is authenticated)
 */
middleware.post = function(req, res, callback){
	if (!req.isAuthenticated()){
		res.send('403', 'You need to be logged');
	}else{
		callback();
	}
};

middleware.requireAuthentication = function(req){
	return !req.isAuthenticated();
};

module.exports = middleware;