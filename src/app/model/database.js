/*jslint node: true */
"use strict";

var nconf = require('nconf'),
    primaryDBName = nconf.get('database'),
    secondaryDBName = nconf.get('secondary_database'),
    secondaryModules = nconf.get('secondary_db_modules'),
    logger = require('log4js').getLogger('database'),
    async = require('async'),

    ALLOWED_MODULES = ['hash', 'list', 'sets', 'sorted'];

if (!primaryDBName) {
    logger.info('Database type not set! Run node app --setup');
    process.exit();
}


var primaryDB = require('./database/' + primaryDBName);
primaryDB.init(function () {
    logger.info("well done configured database");
});

module.exports = primaryDB;