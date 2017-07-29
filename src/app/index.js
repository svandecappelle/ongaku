var nconf = require("nconf");
var logger = require('log4js').getLogger('Server');
var async = require("async");

var middleware = require('./middleware/middleware');
var routes = require('./routes');
var library = require("./middleware/library");
var chat = require('./chat');
var meta = require('./meta');


(function(Application) {
	Application.load = function (app, callback, session) {
		meta.settings.merge();
		routes.load(app);
		this.app = app;
		served = this.app.listen(nconf.get('port'));
		chat.load(served, session);
		var urlService = "http://".concat(nconf.get("hostname")).concat(":").concat(nconf.get("port"));
		logger.info("Service is ready and listening on: " + urlService);
		if (callback){
			callback(urlService);
		}
	};

	Application.reload = function(callback){
		var that = this;
		library.scan(function(){
			library.scanProgress = false;
			logger.info("Library fully scanned");
			if (callback){
				callback();
			} else {
				that.emit('library:scanned', {message: "Library scanned"});
			}
		});
	};

	Application.on = function(event, callback){
		chat.on(event, callback);
	};

	Application.emit = function(event, params){
		chat.emit(event, params);
	};

	Application.start = function (){
		var that = this;
		logger.info("Ready to serve on " + nconf.get('port') + " port");
		that.on('connection', function(socket){
			logger.debug("User connected to socket.io");
		});

		var q = async.queue(function (task, callback){
			logger.info("Launch task: ".concat(task.name));
			callback();
		});

		q.drain = function (){
			logger.info("All tasks have been processed.");
		};

		q.push({name: 'scan'}, function (err){
			that.reload();
		});


	};
})(exports);
