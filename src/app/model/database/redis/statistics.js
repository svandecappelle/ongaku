/*jslint node: true */
'use strict';

var logger = require('log4js').getLogger('StatisticModel'),
    db = require('../index'),
    async = require('async');

class StatisticsRedisModel {

  set (name, id, value, callback){
    var hash = 'statistics:' + name;

    logger.debug("statistics edit: " + value);
    if (value === 'increment' || value === 'decrement') {
      this.getOne(name, id, (err, val) => {
        if (val) {
          val = parseInt(val);
          if (value === 'increment'){
            val += 1;
          } else {
            val -= 1;
          }
          this.set(name, id, val, callback);
        } else {
          this.set(name, id, 1, callback);
        }
      });
    } else {
      db.setObjectField(hash, id, value, callback);
    }
  };

  clear (name, callback){
    var hash = 'statistics:' + name;
    db.deleteObject(hash, (err) => {
        if (err) {
          logger.error(err);
          callback(err);
        } else {
          callback(null);
        }
    });
  };

  get (name, callback){
    var hash = 'statistics:' + name;
    db.getObject(hash, (err, set) => {
        if (err) {
          logger.error(err);
          callback(err);
        } else {
          callback(null, set);
        }
    });
  };

  getOne (name, id, callback){
    var hash = 'statistics:' + name;
    db.getObjectField(hash, id, callback);
  };

}

module.exports = StatisticsRedisModel;
