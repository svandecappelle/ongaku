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
            meta = require('./src/app/meta'),
            playlist = require('./src/app/model/playlist');

        meta.settings.setOne("global", "require-authentication", "true", function (err) {
            if (err) {
                logger.debug("userauth error initialising");
            }
            logger.info("Standard global settings initialised");
        });

        /*user.create({email: "admin@domain.fr", username: "admin", password: "admin"}, function (err, uuid) {
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
        });*/

/*
        playlist.create("admin", "oneplaylist", function(){
          logger.info("playlist created");
        });*/
        /*playlist.push("admin", "oneplaylist", ["asong"], function(){
          logger.info("added song to playlist");
        });*/
    };

    Installation.preload().install();
}(exports));
