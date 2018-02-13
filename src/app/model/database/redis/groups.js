/*jslint node: true */

var async = require('async'),
logger = require('log4js').getLogger('Groups'),
user = require('./user'),
db = require('../index'),
utils = require('./../../../utils'),

filterGroups = function (groups, options) {
    // Remove system, hidden, or deleted groups from this list
    if (groups && !options.showAllGroups) {
        return groups.filter( (group) => {
            if (group.deleted || (group.hidden && !group.system) || (!options.showSystemGroups && group.system)) {
                return false;
            } else {
                return true;
            }
        });
    } else {
        return groups;
    }
};

class GroupsRedisModel {

    list (options, callback) {
        db.getSetMembers('groups', (err, groupNames) => {
            if (groupNames.length > 0) {
                async.map(groupNames, (groupName, next) => {
                    Groups.get(groupName, options, next);
                }, (err, groups) => {
                    callback(err, filterGroups(groups, options));
                });
            } else {
                callback(null, []);
            }
        });
    };

    getAllGroups (callback) {
        db.getSetMembers('groups', (err, groups) => {
            callback(err, filterGroups(groups, {showAllGroups: true}));
        });
    };

    get (groupName, options, callback) {
        var truncated = false,
            numUsers;

        async.parallel({
            base: (next) => {
                db.getObject('group:' + groupName, (err, groupObj) => {
                    if (err) {
                        next(err);
                    } else if (!groupObj) {
                        next('group-not-found');
                    } else {
                        next(err, groupObj);
                    }
                });
            },
            users: (next) => {
                db.getSetMembers('group:' + groupName + ':members', (err, uids) => {
                    if (err) {
                        return next(err);
                    }

                    if (options.truncateUserList) {
                        if (uids.length > 4) {
                            numUsers = uids.length;
                            uids.length = 4;
                            truncated = true;
                        }
                    }

                    if (options.expand) {
                        async.map(uids, user.getUserData, next);
                    } else {
                        next(err, uids);
                    }
                });
            },
            managers: (next) => {
                db.getSetMembers('group:' + groupName + ':managers', (err, uids) => {
                    if (err) {
                        return next(err);
                    }

                    if (options.truncateUserList) {
                        if (uids.length > 4) {
                            numUsers = uids.length;
                            uids.length = 4;
                            truncated = true;
                        }
                    }

                    if (options.expand) {
                        async.map(uids, user.getUserData, next);
                    } else {
                        next(err, uids);
                    }
                });
            }
        }, (err, results) => {
            if (err) {
                return callback(err);
            }

            // User counts
            results.base.count = numUsers || results.users.length;
            results.base.members = results.users;
            results.base.managers = results.managers;
            results.base.memberCount = numUsers || results.users.length;
            results.base.managersCount = numUsers || results.managers.length;

            results.base.deleted = !!parseInt(results.base.deleted, 10);
            results.base.hidden = !!parseInt(results.base.hidden, 10);
            results.base.system = !!parseInt(results.base.system, 10);
            results.base.deletable = !results.base.system;
            results.base.truncated = truncated;

            callback(err, results.base);
        });
    };

    search (query, options, callback) {
        if (query.length) {
            db.getSetMembers('groups', (err, groups) => {
                groups = groups.filter( (groupName) => {
                    return groupName.match(new RegExp(utils.escapeRegexChars(query), 'i'));
                });

                async.map(groups, (groupName, next) => {
                    Groups.get(groupName, options, next);
                }, (err, groups) => {
                    callback(err, filterGroups(groups, options));
                });
            });
        } else {
            callback(null, []);
        }
    };

    isMember (uid, groupName, callback) {
        this.isMemberAs(uid, groupName, 'members', callback);
    };

    isManager (uid, groupName, callback) {
        this.isMemberAs(uid, groupName, 'managers', callback);
    };

    isMemberAs (uid, groupName, role, callback) {
        db.isSetMember('group:' + groupName + ':' + role, uid, callback);
    };

    isMemberOfGroupList (uid, groupListKey, callback) {
        db.getSetMembers('group:' + groupListKey + ':members', (err, gids) => {
            async.some(gids, (gid, next) => {
                this.isMember(uid, gid, (err, isMember) => {
                    if (!err && isMember) {
                        next(true);
                    } else {
                        next(false);
                    }
                });
            }, (result) => {
                callback(null, result);
            });
        });
    };

    exists (name, callback) {
        db.isSetMember('groups', name, callback);
    };

    create (name, description, callback) {
        if (name.length === 0) {
            return callback(new Error('[[error:group-name-too-short]]'));
        }

        if (name === 'administrators' || name === 'registered-users') {
            var system = true;
        }

        this.exists(name, (err, exists) => {
            if (err) {
                return callback(err);
            }

            if (exists) {
                return callback(new Error('[[error:group-already-exists]]'));
            }

            var groupData = {
                name: name,
                description: description,
                deleted: '0',
                hidden: '0',
                system: system ? '1' : '0'
            };

            async.parallel([
                (next) => {
                    db.setAdd('groups', name, next);
                },
                (next) => {
                    db.setObject('group:' + name, groupData, (err) => {
                        this.get(name, {}, next);
                    });
                }
            ], callback);
        });
    };

    update (groupName, values, callback) {
        db.exists('group:' + groupName, (err, exists) => {
            if (!err && exists) {
                // If the group was renamed, check for dupes
                if (!values.name) {
                    db.setObject('group:' + groupName, values, callback);
                } else {
                    if (callback) {
                        callback(new Error('[[error:group-name-change-not-allowed]]'));
                    }
                }
            } else {
                if (callback) {
                    callback(new Error('[[error:no-group]]'));
                }
            }
        });
    };

    destroy (groupName, callback) {
        async.parallel([
            (next) => {
                db.delete('group:' + groupName, next);
            },
            (next) => {
                db.setRemove('groups', groupName, next);
            },
            (next) => {
                db.delete('group:' + groupName + ':members', next);
            }
        ], callback);
    };

    join (groupName, uid, callback) {
        this.joinAs(groupName, uid, 'members', callback);
    };

    addManager (groupName, uid, callback) {
        this.joinAs(groupName, uid, 'managers', callback);
    };

    joinAs (groupName, uid, role, callback) {
        this.exists(groupName, (err, exists) => {
            if (exists) {
                this.isMemberAs(uid, groupName, role, (err, isMember) => {
                    if (!isMember) {
                        db.setAdd('group:' + groupName + ':' + role, uid, callback);
                    } else {
                        logger.warn(uid + " is already member of group: " + groupName);
                    }
                });
            } else {
                this.create(groupName, '', (err) => {
                    if (err) {
                        logger.error('[groups.joinAs] Could not create new group: ' + err.message);
                        return callback(err);
                    }
                    this.joinAs(groupName, uid, role, callback);
                });
            }
        });
    };

    leave (groupName, uid, callback) {
        this.leaveAs(groupName, uid, 'members', callback);
    };

    leaveAs (groupName, uid, role, callback) {
        db.setRemove('group:' + groupName + ':' + role, uid, (err) => {
            if (err) {
                return callback(err);
            }

            // If this is a hidden group, and it is now empty, delete it
            this.get(groupName, {}, (err, group) => {
                if (err) {
                    return callback(err);
                }

                if (group.hidden && group.memberCount === 0) {
                    this.destroy(groupName, callback);
                } else {
                    return callback();
                }
            });
        });
    };

    leaveAsManager (groupName, uid, callback) {
        this.leaveAs(groupName, uid, 'managers', callback);
    };

    leaveAllGroups (uid, callback) {
        db.getSetMembers('groups', (err, groups) => {
            async.each(groups, (groupName, next) => {
                this.isMember(uid, groupName, (err, isMember) => {
                    if (!err && isMember) {
                        this.leave(groupName, uid, next);
                    } else {
                        next();
                    }
                });
            }, callback);
        });
    };
}

module.exports = GroupsRedisModel;
