/*jslint node: true */
'use strict';

var logger = require('log4js').getLogger('LibraryModel'),
    db = require('../index'),
    _ = require("underscore");

class SecurityRedisModel {

  getAccessId (username, callback){
    var hash = 'security:accesses';
    db.getObjectField(hash, username, callback);
  };

  set (username, access_id, callback){
    var hash = 'security:accesses';
    db.setObjectField(hash, username, access_id, callback);
  };

  isAllowed  (access_id, callback) {
    var hash = 'security:accesses';
    db.getObject(hash, (err, accesses) => {
        if (err) {
          logger.error(err);
          callback(err);
        } else {
          logger.info(accesses);
          var granted = _.reduce(accesses, (memo, access_id_allowed) => {
            return memo || access_id_allowed === access_id;
          });

          callback(null, granted);
        }
    });
  };

}

module.exports = SecurityRedisModel;
