var application_root = __dirname,
        express = require('express'),
        path = require('path'),
        http = require('http');
log4js = require("log4js");
var app = express();

var fs = require('fs'),
    os = require('os'),
    logger = require('log4js').getLogger('Server'),
    path = require('path'),
    pkg = require('./package.json'),
    nconf = require('nconf'),
    library = require("./src/library"),
    async = require("async");

function preload(){
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
    }else{
        nconf.file({
            file: configFile
        });

        nconf.defaults({
            base_dir: __dirname,
            upload_url: '/uploads/'
        });
    }
    return configExists;
}

function start(){
    var bodyParser = require('body-parser');
    var session = require('express-session');
    var cookieParser = require('cookie-parser');
    var passport = require('passport');
    var morgan  = require('morgan');

    // public PATHS
    app.set('views', __dirname + '/src/views');
    app.set('view engine', 'jade');
    app.use(express.static(__dirname + '/public'));
    app.use(bodyParser());
    app.use(cookieParser()); // required before session.
    app.use(session({
        secret: 'keyboard cat',
        proxy: true // if you do SSL outside of node.
    }));
    app.use(passport.initialize());
    app.use(passport.session());
    app.use(morgan(':req[X-Forwarded-For] - - [:date] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent"'));


    // ROUTES
    var routes = require('./src/route')(app);
    
    var middleware = require("./src/middleware");

    logger.info("Please wait for scan library");
    async.parallel([
        function(){
             // LISTEN PORT APP
            var served = app.listen(nconf.get('port'));
            logger.info("Ready to serve on " + nconf.get('port') + " port");
        },
        function(){
            library.scan(function(){
               logger.info("Library scanned");
            });
        }
    ]);
    
}

var okToStart = preload();

if (okToStart){
    start();
}