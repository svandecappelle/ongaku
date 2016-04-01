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
    User.create = function (userData, callback) {
        var uid = userData.email,
            password = userData.password;
        this.exists(userData.username, function (err, exists) {
            if (exists) {
                logger.error("User: " + userData.username + " already exists");
                return callback("already exists usersname");
            }

            db.setObject('user:' + uid, userData, function (err) {

                if (err) {
                    return callback(err);
                }
                db.setObjectField('username:uid', userData.username, uid);

                if (userData.email !== undefined) {
                    db.setObjectField('email:uid', userData.email, uid);
                    if (parseInt(uid, 10) !== 1) {
                        User.email.verify(uid, userData.email);
                    }
                }
                db.incrObjectField('global', 'userCount');
                groups.join('registered-users', uid);

                if (password) {
                    User.hashPassword(password, function (err, hash) {
                        if (err) {
                            return callback(err);
                        }

                        User.setUserField(uid, 'password', hash);
                        callback(null, uid);
                    });
                } else {
                    callback(null, uid);
                }
            });
        });
    };
};
