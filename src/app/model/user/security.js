/*jslint node: true */
'use strict';

var async = require('async'),
    nconf = require('nconf'),
    logger = require('log4js').getLogger("User:create"),
    user = require('./../user'),
    utils = require('./../../utils'),
    db = require('./../database'),
    groups = require('../groups'),
    emailer = require('./../emailer');

module.exports = function (User) {
    User.sshkeys = function (username, callback) {
        this.exists(username, function (err, exists) {
            if (!exists) {
                logger.error("User: " + username + " does not exist");
                return callback("Does not exists username");
            }
            db.getObject('ssh:' + username, function (err, obj) {
                if (err) {
                    callback(err, null);
                } else {
                    callback(null, obj);
                }
            });
        });
    };

    User.deleteSshkey = function (username, sshTitle, callback) {
        this.exists(username, function (err, exists) {
            if (!exists) {
                logger.error("User: " + username + " does not exist");
                return callback("Does not exists username");
            }

            db.deleteObjectField('ssh:' + username, sshTitle, function (err, obj) {
                if (err) {
                    callback(err, null);
                } else {
                    db.decrObjectField('global', 'keys_count');
                    callback(null, obj);
                }
            });

        });
    };

    User.addSshkey = function (username, sshTitle, sshkey, callback) {
        this.exists(username, function (err, exists) {
            if (!exists) {
                logger.error("User: " + username + " does not exist");
                return callback("Does not exists username");
            }

            db.setObjectField('ssh:' + username, sshTitle, sshkey, function (err, obj) {
                if (err) {
                    callback(err, null);
                } else {
                    db.incrObjectField('global', 'keys_count');
                    callback(null, obj);
                }
            });
        });
    };
    User.Keys = {};

    User.Keys.count = function (callback) {
        db.getObjectField('global', 'keys_count', callback);
    };
};
