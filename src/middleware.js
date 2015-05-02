/*jslint node: true */
"use strict";

var middleware = {},
	async = require('async'),
	nconf = require('nconf'),
	fs = require('fs'),
	logger = require('log4js').getLogger("Middleware"),
	_ = require("underscore"),
	library = require("./library"),
	path = require("path"),
	transcoder = require("./transcoder");

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

		//logger.info("Test with first entry of library", _.first(_.first(library.flatten).track));
		_.extend(middlewareObject.objs, {
			data: {
				// TODO for the test get the first entry of library
				playing: _.first(_.first(library.flatten).track),
				//playing: null,
				playlist: req.session.playlist ? req.session.playlist : []
			}
		});

		res.render(view, middlewareObject.objs);
	});
};

/*
	Send redirect to client.
 */
middleware.redirect = function(view, res){
	res.redirect(view);
};

middleware.stream = function(req, res, uuid){
	logger.info("start stream file: " + uuid);
	if (this.requireAuthentication(req)){
		// need an auth
		logger.info("Client not connected: cannot acces to video ["+req.ip+"]");
		req.session.redirectTo = req.originalUrl;
		res.json({error: 'Need privileges'});
		res.end();
	}else{
		logger.info("Stream video");
		var fs = require("fs");
		var src = library.getRelativePath(uuid);

		if (path.extname(src).replace(".", "") !== 'mp3'){
			var libraryEntry = library.getByUid(uuid);
			var audio = {
				duration: libraryEntry.duration,
				location: libraryEntry.file,
				uid: libraryEntry.uid,
				sessionId: req.sessionID
			};
			logger.info(audio);
			transcoder.transcode(audio, req, res);
		}else{
			logger.debug(src);
			var reqStreaming = _.clone(req);
			reqStreaming.url = "/stream/" + src;

			var settings = {
				"mode": "development",
				"forceDownload": false,
				"random": false,
				"rootFolder": nconf.get("library"),
				"rootPath": "stream",
				"server": "VidStreamer.js/0.1.4"
			};

			var vidStreamer = require("vid-streamer").settings(settings);
			vidStreamer(reqStreaming, res);
		}
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
	return false;
	//return !req.isAuthenticated();
};

module.exports = middleware;