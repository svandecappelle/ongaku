/*jslint node: true */
var middleware = require("./../middleware/middleware")
  nconf = require("nconf"),
  logger = require('log4js').getLogger('installer'),
  user = require("../model/user"),
  groups = require("../model/groups");

(function (InstallerRoutes) {
  "use strict";

  InstallerRoutes.installed = false;

  InstallerRoutes.onInstall = function(properties, callback){
    if ( properties.username === "" && properties.length < 6){
      return callback(new Error("Username choice invalid. Minimum length 6 characters"));
    }

    if (properties.password.length < 6){
      return callback(new Error("Password choice invalid. Minimum length 6 characters"));
    }

    if (properties.password !== properties["password-confirmation"]){
      return callback(new Error("Password doesn't match confirmation"));
    }
    groups.create("administrators", "Application administrators members", function(err){
      user.create(properties, function (err, uuid) {
        if (err) {
          logger.error("Error while create user: ", err);
          return callback(err)
        }

        logger.info("Success create user: " + uuid);

        logger.info("Checking user installed: " + uuid);
        user.getUsers([properties.email], function (err, data) {
          logger.info("Main admin user installed");
        });

        groups.join("administrators", properties.email, function(err){
          if (err){
            logger.error(err);
            return callback(err);
          }
          logger.info("User " + properties.username + " configured as administrator");
          callback();
        });
      });
    });
  };

  InstallerRoutes.load = function (app, afterInstall) {
    app.use(function (req, res, next) {
      if ( !InstallerRoutes.installed && req.url !== "/install" ){
        res.redirect("/install");
      } else {
        next();
      }
    });

    app.get('/install', function (req, res) {
      middleware.render('admin/installer', req, res, nconf.get());
    });

    app.post(['/', '/install'], function(req, res){
      InstallerRoutes.onInstall(req.body, (error) => {
        if (error){
          res.status(500).send({
            status: "error",
            error: error.message ? error.message : error
          });
        } else {
          logger.info('Application installed');
          afterInstall();
          InstallerRoutes.installed = true;
          res.send({
            status: "installed",
            redirectTo: "/"
          });
        }
      });
    });
  };
}(exports));
