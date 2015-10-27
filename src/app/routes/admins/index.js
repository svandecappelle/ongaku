var logger = require('log4js').getLogger("AdministratorsRoutes")
var nconf = require("nconf");

var middleware = require("./../../middleware/middleware"),
	library = require("./../../middleware/library");
	application = require("./../../");

logger.setLevel(nconf.get('logLevel'));

(function(AdministratorsRoutes) {

	AdministratorsRoutes.load = function (app) {
		app.get('/admin/', function (req, res) {
			logger.info("Client access to admin index ["+req.ip+"]");
			middleware.render('admin/index', req, res, {});
		});


		app.get('/api/reload/audio/library', function (req, res) {
				logger.info("reload audio library");
				application.reload(function(){
					var libraryDatas = library.getAudio();
					middleware.json(req, res, libraryDatas);
				});
		});

	}
})(exports);
