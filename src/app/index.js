var nconf = require("nconf");
var socketio = require('socket.io');
var logger = require('log4js').getLogger('Server');
var async = require("async");

var middleware = require('./middleware/middleware');
var routes = require('./routes');
var library = require("./middleware/library");

logger.setLevel(nconf.get('logLevel'));

(function(Application) {
	Application.load = function (app) {
		routes.load(app);
		this.app = app;
		served = this.app.listen(nconf.get('port'));
		this.io = socketio(served);
	};

	Application.reload = function(callback){
		var that = this;
		library.scan(function(){
			library.scanProgress = false;
			logger.info("Library scanned");
			if (callback){
				callback();
			} else {
				that.emit('library:scanned', {message: "Library scanned"});
			}
		});
	};

	Application.on = function(event, callback){
		this.io.on(event, callback);
	};

	Application.emit = function(event, params){
		this.io.emit(event, params);
	};

	Application.start = function (){
		var that = this;

		async.parallel([
			function(){
				// LISTEN PORT APP

				logger.info("Ready to serve on " + nconf.get('port') + " port");
				that.on('connection', function(socket){
					logger.info("User connected to socket.io");
				});
			},
			function(){
				logger.info("Please wait for scan library");
				that.reload();
			}
		]);
	};
})(exports);
