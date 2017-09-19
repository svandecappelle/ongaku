/*jslint node: true */
'use strict';

var async = require('async'),
    nconf = require('nconf'),
    logger = require('log4js').getLogger("User:email"),
    user = require('./../user'),
    utils = require('./../../../../utils'),
    db = require('./../../index'),
    emailer = require('./../emailer');

class UserEmailRedisModel {

    exists (email, callback) {
        user.getUidByEmail(email, (err, exists) => {
            callback(err, !!exists);
        });
    };

    available (email, callback) {
        db.isObjectField('email:uid', email, (err, exists) => {
            callback(err, !exists);
        });
    };

    verify (uid, email) {
        var confirm_code = utils.generateUUID(),
            confirm_link = nconf.get('url') + '/confirm/' + confirm_code;

        async.series([
            (next) => {
                db.setObject('confirm:' + confirm_code, {
                    email: email,
                    uid: uid
                }, next);
            },
            (next) => {
                db.expireAt('confirm:' + confirm_code, Math.floor(Date.now() / 1000 + 60 * 60 * 2), next);
            }
        ], (err) => {
            // Send intro email w/ confirm code
            user.getUserField(uid, 'username', (err, username) => {
                if (err) {
                    return logger.error(err.message);
                }

                //TODO meta is configurations in database.
                emailer.send('welcome', uid, {
                    site_title: ('Heimdall'),
                    username: username,
                    confirm_link: confirm_link,

                    subject: 'Welcome to ' + ('Heimdall') + '!',
                    template: 'welcome',
                    uid: uid
                });
            });
        });
    };

    confirm (code, callback) {
        db.getObject('confirm:' + code, (err, confirmObj) => {
            if (err) {
                return callback({
                    status: 'error'
                });
            }

            if (confirmObj && confirmObj.uid && confirmObj.email) {
                db.setObjectField('email:confirmed', confirmObj.email, '1', () => {
                    callback({
                        status: 'ok'
                    });
                });
            } else {
                callback({
                    status: 'not_ok'
                });
            }
        });
    };
}

module.exports = new UserEmailRedisModel();
