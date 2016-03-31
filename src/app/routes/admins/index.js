var logger = require('log4js').getLogger("AdministratorsRoutes"),
	nconf = require("nconf"),
	middleware = require("./../../middleware/middleware"),
	library = require("./../../middleware/library"),
	meta = require("./../../meta");
	application = require("./../../");

logger.setLevel(nconf.get('logLevel'));

(function(AdministratorsRoutes) {

	AdministratorsRoutes.load = function (app) {
		app.get('/admin/', function (req, res) {
			var properties = ["global"];
			logger.info("Client access to admin index [" + req.ip + "]");
			meta.settings.get(properties, function (err, settings){
				logger.info("settings: ", settings);
					middleware.render('admin/index', req, res, settings);
			});
		});

		app.get('/api/reload/audio/library', function (req, res) {
				logger.info("reload audio library");
				application.reload(function(){
					var libraryDatas = library.getAudio();
					middleware.json(req, res, libraryDatas);
				});
		});
	};
})(exports);
