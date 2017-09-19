var db = require('../../index'),
    meta = require('../../../../meta');

class UserAuthRediisModel {
    logAttempt (uid, callback) {
        db.exists('lockout:' + uid, (err, exists) => {
            if (!exists) {
                db.increment('loginAttempts:' + uid, (err, attempts) => {
                    if ((meta.config.loginAttempts || 5) < attempts) {
                        // Lock out the account
                        db.set('lockout:' + uid, '', (err) => {
                            db.delete('loginAttempts:' + uid);
                            db.pexpire('lockout:' + uid, 1000 * 60 * (meta.config.lockoutDuration || 60));
                            callback(new Error('account-locked'));
                        });
                    } else {
                        db.pexpire('loginAttempts:' + uid, 1000 * 60 * 60);
                        callback();
                    }
                });
            } else {
                callback(new Error('[[error:account-locked]]'));
            }
        });
    };

    clearLoginAttempts (uid) {
        db.delete('loginAttempts:' + uid);
    };
}


module.exports = new UserAuthRediisModel();