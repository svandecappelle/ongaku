/*jslint node: true */
'use strict';

var logger = require('log4js').getLogger('LibraryModel'),
    db = require('./database'),
    _ = require("underscore");

(function (Security) {


  Security.getAccessId = function (username, callback){
    var hash = 'security:accesses';
    db.getObjectField(hash, username, function (err, access) {
        if (err) {
          logger.error(err);
          callback(err);
        } else {
          callback(null, access);
        }
    });
  };

  Security.set = function (username, access_id, callback){
    var hash = 'security:accesses';
    db.setObjectField(hash, username, access_id, callback);
  };

  Security.isAllowed = function (access_id, callback) {
    var hash = 'security:accesses';
    db.getObject(hash, function (err, accesses) {
        if (err) {
          logger.error(err);
          callback(err);
        } else {
          logger.info(accesses);
          var granted = _.reduce(accesses, function (memo, access_id_allowed) {
            return memo || access_id_allowed === access_id;
          });

          callback(null, granted);
        }
    });
  };

}(exports));
