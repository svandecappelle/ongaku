/*jslint node: true */
'use strict';

var bcrypt = require('bcryptjs'),
    async = require('async'),
    nconf = require('nconf'),
    logger = require('log4js').getLogger('LibraryModel'),
    gravatar = require('gravatar'),
    S = require('string'),
    utils = require('./../../../public/lib/utils'),
    db = require('./database');

(function (Library) {

  Library.get = function (username, callback){
    db.getSetMembers(username + ':library', function (err, uids) {
        if (err) {
            return callback(err);
        }

        for (var i = 0; i < uids.length; i++) {
          logger.info("lib entry: ", uids[i]);
        }
        callback(null, uids);
    });
  };

  Library.append = function (username, uid, callback){
    db.setAdd(username + ':library', uid, callback);
  };

  Library.remove = function (username, uid, callback){
    db.setRemove(username + ':library', uid, callback);
  };

}(exports));
