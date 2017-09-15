/*jslint node: true */
'use strict';

var logger = require('log4js').getLogger('LibraryModel'),
    db = require('../index');

(function (Library) {

  Library.get = function (username, callback){
    db.getSetMembers(username + ':library', function (err, uids) {
        if (err) {
            return callback(err);
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

  Library.getSharedFolders = function(callback){
    db.getSetMembers('users:shared-folders', callback);
  };

}(exports));
