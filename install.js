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
        var user = require("./src/app/model/user");

        user.create({email: "admin@domain.fr", username: "admin", password: "admin"}, function (err, uuid) {
            if (err) {
                logger.error("Error while create user: " + err);
                process.exit(1);
            } else {
                logger.info("Success create user: " + uuid);
                user.getUsers(["admin@heimdall.fr"], function (err, data) {
                    logger.info("Installed");
                    process.exit(0);
                });
            }
        });
    };

    Installation.preload().install();
}(exports));