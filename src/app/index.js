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
	};

	Application.start = function (){
		var served = this.app.listen(nconf.get('port'));
		var io = socketio(served);

		async.parallel([
			function(){
				// LISTEN PORT APP

				logger.info("Ready to serve on " + nconf.get('port') + " port");
				io.on('connection', function(socket){
					logger.info("User connected to socket.io");
				});
			},
			function(){
				logger.info("Please wait for scan library");
				library.scan(function(){
					library.scanProgress = false;
					logger.info("Library scanned");
					io.emit('library:scanned', {message: "Library scanned"});
				});
			}
		]);
	};
})(exports);