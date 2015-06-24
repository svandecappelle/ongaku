var users = require("./users"),
	admins = require("./admins");

(function(Routes) {
	Routes.load = function (app) {
		// users routes
		users.load(app);

		// admins routes
		admins.load(app)
	}
})(exports);