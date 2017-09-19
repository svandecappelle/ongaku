/*jslint node: true */
'use strict';

var async = require('async'),
    nconf = require('nconf'),
    logger = require('log4js').getLogger("User:create"),
    user = require('./../user'),
    utils = require('./../../../../utils'),
    db = require('./../../index'),
    groups = require('../groups'),
    emailer = require('./../emailer');

class UserSecurityRedisModel {

    constructor () {
        
    }

    sshkeys (username, callback) {
        this.exists(username, (err, exists) => {
            if (!exists) {
                logger.error("User: " + username + " does not exist");
                return callback("Does not exists username");
            }
            db.getObject('ssh:' + username, (err, obj) => {
                if (err) {
                    callback(err, null);
                } else {
                    callback(null, obj);
                }
            });
        });
    };

    deleteSshkey (username, sshTitle, callback) {
        this.exists(username, (err, exists) => {
            if (!exists) {
                logger.error("User: " + username + " does not exist");
                return callback("Does not exists username");
            }

            db.deleteObjectField('ssh:' + username, sshTitle, (err, obj) => {
                if (err) {
                    callback(err, null);
                } else {
                    db.decrObjectField('global', 'keys_count');
                    callback(null, obj);
                }
            });

        });
    };

    addSshkey (username, sshTitle, sshkey, callback) {
        this.exists(username, (err, exists) => {
            if (!exists) {
                logger.error("User: " + username + " does not exist");
                return callback("Does not exists username");
            }

            db.setObjectField('ssh:' + username, sshTitle, sshkey, (err, obj) => {
                if (err) {
                    callback(err, null);
                } else {
                    db.incrObjectField('global', 'keys_count');
                    callback(null, obj);
                }
            });
        });
    };
    
    keycount (callback) {
        db.getObjectField('global', 'keys_count', callback);
    };
};

module.exports = UserSecurityRedisModel;