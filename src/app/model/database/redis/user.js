/*jslint node: true */
'use strict';
var bcrypt = require('bcryptjs'),
    async = require('async'),
    nconf = require('nconf'),
    logger = require('log4js').getLogger('User'),
    gravatar = require('gravatar'),
    S = require('string'),
    utils = require('./../../../utils'),
    db = require('../index'),
    groups = require('../../groups'),
    notifications,
    plugins;

var security = require('./user/security');

class UserRedisModel extends security {
    
    constructor () {
        super();
        this.email = require('./user/email');
        this.auth = require('./user/auth');
    }

    create (userData, callback) {
        var uid = userData.email,
            password = userData.password;
        this.exists(userData.username, (err, exists) => {
            if (exists) {
                logger.error("User: " + userData.username + " already exists");
                return callback("already exists username");
            }

            db.setObject('user:' + uid, userData, (err) => {

                if (err) {
                    return callback(err);
                }
                db.setObjectField('username:uid', userData.username, uid);

                if (userData.email !== undefined) {
                    db.setObjectField('email:uid', userData.email, uid);
                    if (parseInt(uid, 10) !== 1) {
                        this.email.verify(uid, userData.email);
                    }
                }
                db.incrObjectField('global', 'userCount');
                groups.join('registered-users', uid);

                if (password) {
                    this.hashPassword(password, (err, hash) => {
                        if (err) {
                            return callback(err);
                        }

                        this.setUserField(uid, 'password', hash);
                        callback(null, uid);
                    });
                } else {
                    callback(null, uid);
                }
            });
        });
    };

    count (callback) {
        db.getObjectField('global', 'userCount', callback);
    };

    getUserField (uid, field, callback) {
        db.getObjectField('user:' + uid, field, callback);
    };

    getUserFields (uid, fields, callback) {
        db.getObjectFields('user:' + uid, fields, callback);
    };

    isSharedFolder (uid, folder, callback){
      db.getObjectField('user:folders:' + uid, folder, callback);
    };

    setSharedFolder (uid, folder, isShared, callback){
      if (isShared){
        db.setAdd('users:shared-folders', uid + '[' + folder + ']', (err) =>{
          if (err){
            callback(err);
          } else {
            db.setObjectField('user:folders:' + uid, folder, isShared, callback);
          }
        });
      } else {
        db.setRemove('users:shared-folders', uid + '[' + folder + ']', (err) =>{
          if (err){
            callback(err);
          } else {
            db.setObjectField('user:folders:' + uid, folder, isShared, callback);
          }
        });
      }

    };

    getMultipleUserFields (uids, fields, callback) {

        if (!Array.isArray(uids) || !uids.length) {
            return callback(null, []);
        }

        var keys = uids.map( (uid) => {
            return 'user:' + uid;
        });

        db.getObjectsFields(keys, fields, callback);
    };

    getUserData (uid, callback) {
        this.getUsersData([uid], (err, users) => {
            callback(err, users ? users[0] : null);
        });
    };

    getUserDataByUsername (username, callback) {
        this.getUidByUsername(username, (err, uid) => {
            if (err) {
                return callback(err);
            }
            this.getUserData(uid, callback);
        });
    };

    getUsersData (uids, callback) {

        if (!Array.isArray(uids) || !uids.length) {
            return callback(null, []);
        }

        var keys = uids.map( (uid) => {
            return 'user:' + uid;
        });

        db.getObjects(keys, (err, users) => {
            if (err) {
                return callback(err);
            }

            users.forEach( (user) => {
                if (user) {
                    if (user.password) {
                        user.password = null;
                        user.hasPassword = true;
                    } else {
                        user.hasPassword = false;
                    }

                    if (user.picture === user.uploadedpicture) {
                        user.picture = nconf.get('relative_path') + user.picture;
                    }
                }
            });

            callback(null, users);
        });
    };

    updateLastOnlineTime (uid, callback) {
        this.getUserField(uid, 'status', (err, status) => {
            var cb = (err) => {
                if (typeof callback === 'function') {
                    callback(err);
                }
            }

            if (err || status === 'offline') {
                return cb(err);
            }

            this.setUserField(uid, 'lastonline', Date.now(), cb);
        });
    };

    setUserField (uid, field, value, callback) {
        if (plugins !== undefined) {
            plugins.fireHook('action:user.set', field, value, 'set');
        }
        db.setObjectField('user:' + uid, field, value, callback);
    };

    setUserFields (uid, data, callback) {
        var field;
        for (field in data) {
            if (data.hasOwnProperty(field)) {
                plugins.fireHook('action:user.set', field, data[field], 'set');
            }
        }

        db.setObject('user:' + uid, data, callback);
    };

    getSingleSetting (uid, field, callback) {
        db.getObjectField('settings:' + uid, field, callback);
    };

    getSettings (uid, callback) {
        var field;
        db.getObject('settings:' + uid, callback);
    };

    setSingleSetting (uid, field, value, callback) {
        db.setObjectField('settings:' + uid, field, value, callback);
    };

    setSettings (uid, data, callback) {
        var field;
        db.setObject('settings:' + uid, data, callback);
    };

    getUsersFromSet (set, start, stop, callback) {
        async.waterfall([
            (next) => {
                db.getSortedSetRevRange(set, start, stop, next);
            },
            (uids, next) => {
                this.getUsers(uids, next);
            }
        ], callback);
    };

    getAllUsers (callback) {
        this.search("", callback);
    };

    search (filter, callback) {
        var start = process.hrtime(),
            i;
        db.getObject('username:uid', (err, usernamesHash) => {
            if (err) {
                return callback(null, {timing: 0, users: []});
            }

            filter = filter.toLowerCase();

            var usernames = Object.keys(usernamesHash),
                uids = [];

            for (i = 0; i < usernames.length; ++i) {
                if (usernames[i].toLowerCase().indexOf(filter) === 0) {
                    uids.push(usernames[i]);
                }
            }

            uids = uids.slice(0, 10)
                .sort( (a, b) => {
                    return a > b;
                })
                .map( (username) => {
                    return usernamesHash[username];
                });

            this.getUsers(uids, (err, userdata) => {
                if (err) {
                    return callback(err);
                }

                var diff = process.hrtime(start),
                    timing = (diff[0] * 1e3 + diff[1] / 1e6).toFixed(1);
                callback(null, {timing: timing, users: userdata});
            });
        });
    };

    loadUserInfo (user, callback) {
        let self = this;
        if (!user) {
            return callback(null, user);
        }
        async.waterfall([
            (next) => {
                self.isAdministrator(user.uid, next);
            },
            (isAdmin, next) => {
                user.status = !user.status ? 'online' : user.status;
                user.administrator = isAdmin ? '1' : '0';
                db.isSortedSetMember('users:online', user.uid, next);
            },
            (isMember, next) => {
                if (!isMember) {
                    user.status = 'offline';
                }
                next(null, user);
            },
            (user, next) => {
                self.getSettings(user.uid, (err, settings) => {
                    if (err){
                        logger.error(err);
                    }
                    user.settings = settings;
                    next(null, user);
                });
            },
        ], callback);
    }

    getUsers (uids, callback) {
        
        this.getMultipleUserFields(uids, ['uid', 'username', 'userslug', 'status'], (err, usersData) => {
            if (err) {
                return callback(err);
            }
            async.map(usersData, (user, next) => {
                this.loadUserInfo(user, next);
            }, callback);
        });
    };

    hashPassword (password, callback) {
        if (!password) {
            return callback(null, password);
        }

        bcrypt.genSalt(nconf.get('bcrypt_rounds'), (err, salt) => {
            if (err) {
                return callback(err);
            }
            bcrypt.hash(password, salt, callback);
        });
    };

    exists (username, callback) {
        this.getUidByUsername(username, (err, exists) => {
            return callback(err, exists);
        });
    };

    getUidByUsername (username, callback) {
        db.getObjectField('username:uid', username, callback);
    };

    getUsernameByEmail (email, callback) {
        db.getObjectField('email:uid', email, (err, uid) => {
            if (err) {
                return callback(err);
            }
            this.getUserField(uid, 'username', callback);
        });
    };

    isManager (uid, group, callback) {
        groups.isManager(uid, group, callback);
    };

    isAdministrator (uid, callback) {
        groups.isMember(uid, 'administrators', callback);
    };

    getGroups (uid, callback) {
        var userGroups = [];
        groups.getAllGroups( (err, data) => {
            async.each(data, (item, next) => {
                groups.isMember(uid, item, (err, isMember) => {
                    // console.log(uid + " is member of " + item + ": " + isMember);
                    if (!err && isMember) {
                        userGroups.push(item);
                    }
                    next();
                });
            }, () => {
                // console.log("everything finished");
                return callback(userGroups);
            });
        });
    }

    getGroupsByUsername (username, callback) {
        var userslug = utils.slugify(username);

        this.getUidByUsername(userslug, (err, uid) => {
            if (err) {
                return console.log(err);
            }

            this.getGroups(uid, callback);
        });
    }

}

module.exports = UserRedisModel;