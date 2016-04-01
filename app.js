var application_root = __dirname,
    express = require('express'),
    path = require('path'),
    http = require('http'),
    log4js = require("log4js"),
    app = express(),
    fs = require('fs'),
    os = require('os'),
    logger = require('log4js').getLogger('Server'),
    path = require('path'),
    pkg = require('./package.json'),
    nconf = require('nconf');

/*jslint node: true */

process.title = "Ongaku";

if (process.argv[2] === "dev"){
  logger.info("entering dev mode");
  log4js.configure('logger-dev.json', {});

} else {
  log4js.configure('logger.json', {});
}

(function (ApplicationRoot) {
    "use strict";
    ApplicationRoot.preload = function () {
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
            process.exit(code = 0);
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

    ApplicationRoot.start = function (callback) {
        var bodyParser = require('body-parser'),
            session = require('express-session'),
            cookieParser = require('cookie-parser'),
            passport = require('passport'),
            morgan  = require('morgan');

        // public PATHS
        app.set('views', __dirname + '/src/views');
        app.set('view engine', 'jade');
        app.use(express.static(__dirname + '/public'));
        app.use(bodyParser());
        app.use(bodyParser.json());
        app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
          extended: true
        }));
        app.use(cookieParser()); // required before session.
        app.use(session({
            secret: 'keyboard cat',
            proxy: true // if you do SSL outside of node.
        }));
        app.use(passport.initialize());
        app.use(passport.session());
        var httplog = morgan(':req[X-Forwarded-For] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent"', {
          "stream": {
            write: function(str) {
              logger.debug(str.trim());
            }
          }
        });
        app.use(httplog);

        // ROUTES
        var application = require('./src/app/');
        application.load(app, callback);
        application.start();
    };

    if (process.window === undefined){
      ApplicationRoot.preload().start();
    }
}(exports));
