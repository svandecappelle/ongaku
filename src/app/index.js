const nconf = require("nconf");
const logger = require('log4js').getLogger('Server');
const async = require("async");

const middleware = require('./middleware/middleware');

const library = require("./middleware/library");
const communication = require('./communication');
const meta = require('./meta');

let instance = null;

class Application {
	constructor () {
		if( !instance ) {
			instance = this;
		}
		return instance;
	}

	load (app, callback, session) {
		meta.settings.merge();

		var routes = require('./routes');
		routes.load(app);
		
		this.app = app;
		this.served = this.app.listen(nconf.get('port'));
		communication.listen(this.served);

		var urlService = "http://".concat(nconf.get("hostname")).concat(":").concat(nconf.get("port"));
		logger.info("Service is ready and listening on: " + urlService);
		if (callback){
			callback(urlService);
		}
	}

	reload (callback) {
		library.scan(() => {
			library.scanProgress = false;
			logger.info("Library fully scanned");
			if (callback){
				callback();
			} else {
				this.emit('library:scanned', {message: "Library scanned"});
			}
		});
	}

	emit (event, params) {
		communication.emit(event, params);
	}

	start () {
		var q = async.queue((task, callback) => {
			logger.info("Launch task: ".concat(task.name));
			callback();
		});

		q.drain = () => {
			logger.info("All tasks have been processed.");
		};

		q.push({name: 'scan'}, (err) => {
			this.reload();
		});
	}
}

module.exports = new Application();
