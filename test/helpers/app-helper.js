process.NODE_ENV='TEST';

const log4js = require('log4js');
const application = require('../../app');

application.preload()

log4js.configure({
    appenders: { console: { type: 'console' } },
    categories: { default: { appenders: ['console'], level: 'error' } }  
});

module.exports = application