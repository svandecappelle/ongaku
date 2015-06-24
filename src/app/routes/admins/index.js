var logger = require('log4js').getLogger("AdministratorsRoutes")
var nconf = require("nconf");

var middleware = require("./../../middleware/middleware");

logger.setLevel(nconf.get('logLevel'));

(function(AdministratorsRoutes) {

	AdministratorsRoutes.load = function (app) {
		app.get('/admin/', function (req, res) {
			logger.info("Client access to admin index ["+req.ip+"]");
			middleware.render('admin/index', req, res, {});
		});
	}
})(exports);