/*jslint node: true */
'use strict';

var async = require('async'),
    nconf = require('nconf'),
    logger = require('log4js').getLogger("User:email"),
    user = require('./../user'),
    utils = require('./../../../../public/lib/utils'),
    db = require('./../database'),
    emailer = require('./../emailer');

(function (UserEmail) {

    UserEmail.exists = function (email, callback) {
        user.getUidByEmail(email, function (err, exists) {
            callback(err, !!exists);
        });
    };

    UserEmail.available = function (email, callback) {
        db.isObjectField('email:uid', email, function (err, exists) {
            callback(err, !exists);
        });
    };

    UserEmail.verify = function (uid, email) {
        var confirm_code = utils.generateUUID(),
            confirm_link = nconf.get('url') + '/confirm/' + confirm_code;

        async.series([
            function (next) {
                db.setObject('confirm:' + confirm_code, {
                    email: email,
                    uid: uid
                }, next);
            },
            function (next) {
                db.expireAt('confirm:' + confirm_code, Math.floor(Date.now() / 1000 + 60 * 60 * 2), next);
            }
        ], function (err) {
            // Send intro email w/ confirm code
            user.getUserField(uid, 'username', function (err, username) {
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

    UserEmail.confirm = function (code, callback) {
        db.getObject('confirm:' + code, function (err, confirmObj) {
            if (err) {
                return callback({
                    status: 'error'
                });
            }

            if (confirmObj && confirmObj.uid && confirmObj.email) {
                db.setObjectField('email:confirmed', confirmObj.email, '1', function () {
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

}(exports));
