const application = require('./app');

if (process.window === undefined){
    application.preload().start();
}