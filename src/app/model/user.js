/*jslint node: true */
'use strict';

var bcrypt = require('bcryptjs'),
    async = require('async'),
    nconf = require('nconf'),
    logger = require('log4js').getLogger('User'),
    gravatar = require('gravatar'),
    S = require('string'),
    utils = require('./../utils'),
    db = require('./database'),
    groups = require('./groups'),
    notifications,
    plugins;

(function (User) {
    User.email = require('./user/email');
    require('./user/auth')(User);
    require('./user/create')(User);
    require('./user/security')(User);

    User.count = function (callback) {
        db.getObjectField('global', 'userCount', callback);
    };

    User.getUserField = function (uid, field, callback) {
        db.getObjectField('user:' + uid, field, callback);
    };

    User.getUserFields = function (uid, fields, callback) {
        db.getObjectFields('user:' + uid, fields, callback);
    };

    User.getMultipleUserFields = function (uids, fields, callback) {

        if (!Array.isArray(uids) || !uids.length) {
            return callback(null, []);
        }

        var keys = uids.map(function (uid) {
            return 'user:' + uid;
        });

        db.getObjectsFields(keys, fields, callback);
    };

    User.getUserData = function (uid, callback) {
        User.getUsersData([uid], function (err, users) {
            callback(err, users ? users[0] : null);
        });
    };

    User.getUserDataByUsername = function (username, callback) {
        var self = this;
        self.getUidByUsername(username, function (err, uid) {
            if (err) {
                return callback(err);
            }
            self.getUserData(uid, callback);
        });
    };

    User.getUsersData = function (uids, callback) {

        if (!Array.isArray(uids) || !uids.length) {
            return callback(null, []);
        }

        var keys = uids.map(function (uid) {
            return 'user:' + uid;
        });

        db.getObjects(keys, function (err, users) {
            if (err) {
                return callback(err);
            }

            users.forEach(function (user) {
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

    User.updateLastOnlineTime = function (uid, callback) {
        User.getUserField(uid, 'status', function (err, status) {
            function cb(err) {
                if (typeof callback === 'function') {
                    callback(err);
                }
            }

            if (err || status === 'offline') {
                return cb(err);
            }

            User.setUserField(uid, 'lastonline', Date.now(), cb);
        });
    };

    User.setUserField = function (uid, field, value, callback) {
        if (plugins !== undefined) {
            plugins.fireHook('action:user.set', field, value, 'set');
        }
        db.setObjectField('user:' + uid, field, value, callback);
    };

    User.setUserFields = function (uid, data, callback) {
        var field;
        for (field in data) {
            if (data.hasOwnProperty(field)) {
                plugins.fireHook('action:user.set', field, data[field], 'set');
            }
        }

        db.setObject('user:' + uid, data, callback);
    };

    User.getSingleSetting = function (uid, field, callback) {
        db.getObjectField('settings:' + uid, field, callback);
    };

    User.getSettings = function (uid, callback) {
        var field;
        db.getObject('settings:' + uid, callback);
    };

    User.setSingleSetting = function (uid, field, value, callback) {
        db.setObjectField('settings:' + uid, field, value, callback);
    };

    User.setSettings = function (uid, data, callback) {
        var field;
        db.setObject('settings:' + uid, data, callback);
    };

    User.getUsersFromSet = function (set, start, stop, callback) {
        async.waterfall([
            function (next) {
                db.getSortedSetRevRange(set, start, stop, next);
            },
            function (uids, next) {
                User.getUsers(uids, next);
            }
        ], callback);
    };

    User.getAllUsers = function (callback) {
        this.search("", callback);
    };

    User.search = function (filter, callback) {
        var start = process.hrtime(),
            i;
        db.getObject('username:uid', function (err, usernamesHash) {
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
                .sort(function (a, b) {
                    return a > b;
                })
                .map(function (username) {
                    return usernamesHash[username];
                });

            User.getUsers(uids, function (err, userdata) {
                if (err) {
                    return callback(err);
                }

                var diff = process.hrtime(start),
                    timing = (diff[0] * 1e3 + diff[1] / 1e6).toFixed(1);
                callback(null, {timing: timing, users: userdata});
            });
        });
    };


    User.getUsers = function (uids, callback) {
        function loadUserInfo(user, callback) {
            if (!user) {
                return callback(null, user);
            }

            async.waterfall([
                function (next) {
                    User.isAdministrator(user.uid, next);
                },
                function (isAdmin, next) {
                    user.status = !user.status ? 'online' : user.status;
                    user.administrator = isAdmin ? '1' : '0';
                    db.isSortedSetMember('users:online', user.uid, next);
                },
                function (isMember, next) {
                    if (!isMember) {
                        user.status = 'offline';
                    }
                    next(null, user);
                },
                function (user, next){
                    User.getSettings(user.uid, function(err, settings){
                        if (err){
                            logger.error(err);
                        }
                        user.settings = settings;
                        next(null, user);
                    });
                },
            ], callback);
        }

        User.getMultipleUserFields(uids, ['uid', 'username', 'userslug', 'status'], function (err, usersData) {
            if (err) {
                return callback(err);
            }
            async.map(usersData, loadUserInfo, callback);
        });
    };

    User.hashPassword = function (password, callback) {
        if (!password) {
            return callback(null, password);
        }

        bcrypt.genSalt(nconf.get('bcrypt_rounds'), function (err, salt) {
            if (err) {
                return callback(err);
            }
            bcrypt.hash(password, salt, callback);
        });
    };

    User.exists = function (username, callback) {
        User.getUidByUsername(username, function (err, exists) {
            return callback(err, exists);
        });
    };

    User.getUidByUsername = function (username, callback) {
        db.getObjectField('username:uid', username, callback);
    };

    User.getUsernameByEmail = function (email, callback) {
        db.getObjectField('email:uid', email, function (err, uid) {
            if (err) {
                return callback(err);
            }
            User.getUserField(uid, 'username', callback);
        });
    };

    User.isManager = function (uid, group, callback) {
        groups.isManager(uid, group, callback);
    };

    User.isAdministrator = function (uid, callback) {
        groups.isMember(uid, 'administrators', callback);
    };

    User.getGroups = function (uid, callback) {
        var userGroups = [];
        groups.getAllGroups(function (err, data) {
            async.each(data, function (item, next) {
                groups.isMember(uid, item, function (err, isMember) {
                    // console.log(uid + " is member of " + item + ": " + isMember);
                    if (!err && isMember) {
                        userGroups.push(item);
                    }
                    next();
                });
            }, function () {
                // console.log("everything finished");
                return callback(userGroups);
            });
        });
    };

    User.getGroupsByUsername = function (username, callback) {
        var userslug = utils.slugify(username);

        User.getUidByUsername(userslug, function (err, uid) {
            if (err) {
                return console.log(err);
            }

            User.getGroups(uid, callback);
        });
    };

}(exports));
