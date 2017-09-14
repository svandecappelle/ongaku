const logger = require('log4js').getLogger("AdministratorsRoutes");
const nconf = require("nconf");
const async = require('async');
const _ = require("underscore");
const middleware = require("./../../middleware/middleware");
const library = require("./../../middleware/library");

const meta = require("./../../meta");
const application = require("./../../index");
const communication = require("./../../communication");
const user = require("./../../model/user");
const statistics = require("./../../model/statistics");

class Administration {

	redirectIfNotAdministrator (req, res, callback) {
		if (middleware.isAuthenticated(req)) {
			user.isAdministrator(req.session.passport.user.uid, (err, administrator) => {
				if (administrator){
					callback();
				} else {
					middleware.render("api/middleware/403", req, res);
				}
			});
		} else {
			if (nconf.get('type') === "desktop") {
				logger.info("Desktop mode all access is granted.");
				callback();
			} else {
				logger.warn("Anonymous access forbidden: authentication required.");
				middleware.redirect('/login', res);
			}
		}
	};

	api (app) {
		app.get('/api/reload/audio/library', (req, res) => {
			logger.info("reload audio library");
			this.redirectIfNotAdministrator(req, res, () => {
				application.reload(() => {
					var libraryDatas = library.getAudio();
					middleware.json(req, res, libraryDatas);
				});
			});
		});

		app.get('/api/clear/statistics/:type', (req, res) => {
			this.redirectIfNotAdministrator(req, res, () => {
				statistics.clear(req.params.type, () => {
					middleware.redirect("/featured", res);
				});
			});
		});

		app.post('/api/admin/general', (req, res) => {
			this.redirectIfNotAdministrator(req, res, () => {
				var preferences = req.body;
				async.forEachOf(preferences, (value, key, callback) => {
					meta.settings.setOne("global", key, value, (err) => {
						if (err) {
							callback(err);
						}

						logger.info("Global parameter saved: ", key, value);
						callback();
					});
				}, () => {
					res.redirect("/admin");
				});
			});
		});
	};

	loadAdminScreen (req, res, apiView) {
		this.redirectIfNotAdministrator(req, res, () => {
			var properties = ["global"];
			logger.info("Client access to admin index [" + req.ip + "]");
			meta.settings.get(properties, (err, settings) => {
				if (apiView){
					middleware.render('api/admin/index', req, res, settings);
				} else {
					middleware.render('admin/index', req, res, settings);
				}
			});
		});
	}

	renderUserView (req, res, view) {
		user.getAllUsers(function (err, usersDatas){
			async.map(usersDatas.users, function (userData, next){
				userData.avatar = middleware.getAvatar(userData.username);
				userData.cover = middleware.getCover(userData.username);
				user.getGroupsByUsername(userData.username, function (groups){
					userData = _.extend(userData, {groups: groups});
					userData.status = communication.status(userData.username);
					next(null, userData);
				});
			}, function (err, usersDatas){
				middleware.render(view, req, res, {users: usersDatas, token: new Date().getTime()});
			});
		});
	};

	routes (app) {
		
		app.get('/admin/', (req, res) => {
			this.loadAdminScreen(req, res);
		});

		app.get('/api/view/admin', (req, res) => {
			this.loadAdminScreen(req, res, "api");
		});

		app.get("/api/view/users", (req, res) => {
			this.renderUserView(req, res, "api/users");
		});
		app.get("/users", (req, res) => {
			this.renderUserView(req, res, "admin/users");
		});

		app.get("/register", (req, res) => {
			middleware.render("admin/register");
		});
	};

	load (app) {
		this.api(app);
		this.routes(app);
	};
}

module.exports = new Administration();
