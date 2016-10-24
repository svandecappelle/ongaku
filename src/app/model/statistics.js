/*jslint node: true */
'use strict';

var logger = require('log4js').getLogger('StatisticModel'),
    db = require('./database'),
    async = require('async');

(function (Statistics) {

  Statistics.set = function(name, id, value, callback){
    var hash = 'statistics:' + name;

    logger.debug("statistics edit: " + value);
    if (value === 'increment' || value === 'decrement') {
      Statistics.getOne(name, id, function(err, val){
        if (val) {
          val = parseInt(val);
          if (value === 'increment'){
            val += 1;
          } else {
            val -= 1;
          }
          Statistics.set(name, id, val, callback);
        } else {
          Statistics.set(name, id, 1, callback);
        }
      });
    } else {
      db.setObjectField(hash, id, value, callback);
    }
  };

  Statistics.get = function(name, callback){
    var hash = 'statistics:' + name;
    db.getObject(hash, function (err, set) {
        if (err) {
          logger.error(err);
          callback(err);
        } else {
          callback(null, set);
        }
    });
  };

  Statistics.getOne = function(name, id, callback){
    var hash = 'statistics:' + name;
    db.getObjectField(hash, id, callback);
  };

}(exports));
