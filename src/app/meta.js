/*jslint node: true */
"use strict";

var fs = require('fs'),
    //path = require('path'),
    //async = require('async'),
    logger = require('log4js').getLogger("meta"),
    //nconf = require('nconf'),
    //_ = require('underscore'),
    //rimraf = require('rimraf'),
    //mkdirp = require('mkdirp'),

    utils = require('./../../public/utils'),
    //translator = require('./../public/translator'),
    db = require('./model/database'),
    user = require('./model/user');

(function (Meta) {
    Meta.restartRequired = false;
    Meta.config = {
        loginAttempts: 5,
        lockoutDuration: 60,
        loginDays: 14,
        allowLocalLogin: true
    };

    /* Settings */
    Meta.settings = {};
    Meta.settings.get = function (hash, callback) {
        hash = 'settings:' + hash;
        db.getObject(hash, function (err, settings) {
            if (err) {
                callback(err);
            } else {
                callback(null, settings || {});
            }
        });
    };

    Meta.settings.getOne = function (hash, field, callback) {
        hash = 'settings:' + hash;
        db.getObjectField(hash, field, callback);
    };

    Meta.settings.set = function (hash, values, callback) {
        hash = 'settings:' + hash;
        db.setObject(hash, values, callback);
    };

    Meta.settings.setOne = function (hash, field, value, callback) {
        hash = 'settings:' + hash;
        db.setObjectField(hash, field, value, callback);
    };

    Meta.settings.setOnEmpty = function (hash, field, value, callback) {
        Meta.settings.getOne(hash, field, function (err, curValue) {
            if (err) {
                return callback(err);
            }

            if (!curValue) {
                Meta.settings.setOne(hash, field, value, callback);
            } else {
                callback();
            }
        });
    };
}(exports));