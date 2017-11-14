/*jslint node: true */
const middleware = require("./../middleware/middleware");
const nconf = require("nconf");
const logger = require('log4js').getLogger('installer');
const user = require("../model/user");
const groups = require("../model/groups");

class Installer {

  constructor(){
    this.installed = false;
  }

  onInstall (properties, callback) {
    if ( properties.username === "" && properties.length < 6){
      return callback(new Error("Username choice invalid. Minimum length 6 characters"));
    }

    if (properties.password.length < 6){
      return callback(new Error("Password choice invalid. Minimum length 6 characters"));
    }

    if (properties.password !== properties["password-confirmation"]){
      return callback(new Error("Password doesn't match confirmation"));
    }
    groups.create("administrators", "Application administrators members", (err) => {
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

        groups.join("administrators", properties.email, (err) => {
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

  load (app, afterInstall) {
    app.use((req, res, next) => {
      if ( !this.installed && req.url !== "/install" ){
        res.redirect("/install");
      } else {
        next();
      }
    });

    app.get('/install', (req, res) => {
      middleware.render('admin/installer', req, res, nconf.get());
    });

    app.post(['/', '/install'], (req, res) => {
      this.onInstall(req.body, (error) => {
        if (error){
          res.status(500).send({
            status: "error",
            error: error.message ? error.message : error
          });
        } else {
          logger.info('Application installed');
          afterInstall();
          this.installed = true;
          res.send({
            status: "installed",
            redirectTo: "/"
          });
        }
      });
    });
  }
}

module.exports = new Installer();
