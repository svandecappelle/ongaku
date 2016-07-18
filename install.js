/*jslint node: true */
var logger = require('log4js').getLogger('Installer'),
    fs = require('fs'),
    nconf = require('nconf');

(function (Installation) {
    "use strict";

    Installation.preload = function () {
        nconf.argv().env();

        // Alternate configuration file support
        var configFile = __dirname + '/config.json',
            configExists;
        if (nconf.get('config')) {
            configFile = path.resolve(__dirname, nconf.get('config'));
        }
        configExists = fs.existsSync(configFile);

        if (!configExists){
            logger.error("configuration file doesn't exists");
            process.exit(0);
        } else {
            nconf.file({
                file: configFile
            });

            nconf.defaults({
                base_dir: __dirname,
                upload_url: '/uploads/'
            });
        }

        return this;
    };

    Installation.install = function () {
        logger.info("Installing");
        var user = require("./src/app/model/user"),
          groups = require("./src/app/model/groups"),
          meta = require('./src/app/meta'),
          playlist = require('./src/app/model/playlist');

        meta.settings.setOne("global", "requireLogin", "true", function (err) {
          if (err) {
            logger.debug("userauth error initialising");
          }
          logger.info("Standard global settings initialised");
        });


        user.create({email: "admin@domain.fr", username: "admin", password: "admin"}, function (err, uuid) {
          if (err) {
            logger.error("Error while create user: " + err);
          } else {
            logger.info("Success create user: " + uuid);
            user.getUsers(["admin@domain.fr"], function (err, data) {
              logger.info("Installed");
            });

            groups.join("administrators", "admin@domain.fr", function(err){
              if (err){
                logger.error(err);
              }
              logger.info("User admin configured as administrator");
            });
          }
        });

        user.create({email: "demo@domain.fr", username: "demo", password: "demo"}, function (err, uuid) {
          if (err) {
            logger.error("Error while create user: " + err);
          } else {
            logger.info("Success create user: " + uuid);
            user.getUsers(["admin@domain.fr"], function (err, data) {
              logger.info("Installed");
            });
          }
        });

    };

    Installation.preload().install();
}(exports));
