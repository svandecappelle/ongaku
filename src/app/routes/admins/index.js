var logger = require('log4js').getLogger("AdministratorsRoutes"),
	nconf = require("nconf"),
	async = require('async'),
	_ = require("underscore"),
	middleware = require("./../../middleware/middleware"),
	library = require("./../../middleware/library"),
	meta = require("./../../meta"),
	application = require("./../../"),
	user = require("./../../model/user");

logger.setLevel(nconf.get('logLevel'));

(function(AdministratorsRoutes) {

	AdministratorsRoutes.redirectIfNotAdministrator = function (req, res, callback) {
		if (middleware.isAuthenticated(req)) {
			user.isAdministrator(req.session.passport.user.uid, function(err, administrator){
				if (administrator){
					callback();
				}else{
					middleware.redirect("/403", res);
				}
			});
		} else {
			logger.warn("Anonymous access forbidden: authentication required.");
			middleware.redirect('/login', res);
		}
	};

	AdministratorsRoutes.api = function(app){
		app.get('/api/reload/audio/library', function (req, res) {
			logger.info("reload audio library");
			application.reload(function(){
			var libraryDatas = library.getAudio();
			middleware.json(req, res, libraryDatas);
			});
		});

		app.post('/api/admin/general', function (req, res){
			AdministratorsRoutes.redirectIfNotAdministrator(req, res, function (){
				var preferences = req.body;
				async.forEachOf(preferences, function(value, key, callback){
					meta.settings.setOne("global", key, value, function (err) {
							if (err) {
									callback(err);
							}

							logger.info("Global parameter saved: ", key, value);
							callback();
					});
				}, function(){
					res.redirect("/admin");
				});
			});
		});
	};

	AdministratorsRoutes.routes = function (app){
		app.get('/admin/', function (req, res) {
			AdministratorsRoutes.redirectIfNotAdministrator(req, res, function (){
				var properties = ["global"];
				logger.info("Client access to admin index [" + req.ip + "]");
				meta.settings.get(properties, function (err, settings){
					middleware.render('admin/index', req, res, settings);
				});
			});
		});

		var renderUserView = function(req, res, view){
			user.getAllUsers(function (err, usersDatas){
				async.map(usersDatas.users, function (userData, next){
					user.getGroupsByUsername(userData.username, function (groups){
						userData = _.extend(userData, {groups: groups});
						next(null, userData);
					});
				}, function (err, usersDatas){
					middleware.render(view, req, res, {users: usersDatas});
				});
			});
		};

		app.get("/api/view/users", function (req, res){
			renderUserView(req, res, "api/users");
		});
		app.get("/users", function (req, res){
			renderUserView(req, res, "admin/users");
		});

		app.get("/register", function(req, res){
			middleware.render("admin/register");
		});
	};

	AdministratorsRoutes.load = function (app) {
		this.api(app);
		this.routes(app);
	};
})(exports);
