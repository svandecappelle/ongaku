const nconf = require('nconf');
const fs = require('fs');
const path = require('path');
const yaml_config = require('node-yaml-config');
const log4js = require('log4js');
const logger = log4js.getLogger('CommandLineTools');
const readline = require('readline');

class CommandLineUtils {

  constructor () {
    var logOptions = yaml_config.load(path.resolve(__dirname, './logger.yml'));
    log4js.configure(logOptions);
    nconf.argv().env();
    // Alternate configuration file support
    var configFile = __dirname + '/config.yml',
      configExists;
    if (nconf.get('config')) {
      configFile = path.resolve(__dirname, nconf.get('config'));
    }
    configExists = fs.existsSync(configFile);

    if (!configExists){
      logger.error("configuration file doesn't exists", configFile);
      process.exit(0);
    } else {
      nconf.file({
          file: configFile,
	  format: require('nconf-yaml')
      });
      nconf.defaults({
          base_dir: __dirname,
          upload_url: '/uploads/'
      });
    }
    this.parseOpts();
  }

  parseOpts() {
    process.argv.slice(2).forEach((command) => {
      command = command.split("=");
      if ( typeof this[command[0]] === 'function') {
        this[command[0]](command[1]).then(() => {
	  process.exit();
	}).catch((error) => {
	  logger.error(error);
	  process.exit(1);
	});
      } else {
      	logger.error(`Cannot found command ${command[0]}`);
      }
    });
  }

  check (userid) {
    var user = require('./src/app/model/user');
    var db = require('./src/app/model/database');
    return new Promise((resolve, reject) => {
        user.getUserData(userid, (err, data) => {
	if (err){
	  return reject(err);
	}
	logger.info(data);
        db.get('lockout:'+userid, (err, value) => {
	  if (err){
	    return reject(err);
	  }
	  logger.info(`User: ${userid} locked:`, value != null);
	  resolve();
        });
      });
    });
  }
  list () {
    var user = require('./src/app/model/user');
    return new Promise((resolve, reject) => {
       user.search("", (err, users) => {
         if (err){
           return reject(err);
         }
         if (users){
           users.users.forEach((info) => {
	     logger.info(info);
	   });
         }
	 resolve();
      });
    });
  }

  passwd (username) {
    var rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    return new Promise((resolve, reject) => {
      rl.question('new passwd: ', (password) => {
        rl.close();
      
        var user = require('./src/app/model/user');
        user.hashPassword(password, (err, hash) => {
          if (err) {
             return reject('Error generating hash password: ', error);
          }
          user.getUidByUsername(username, (err, uid) => {
            if (err){
	      return reject('username invalid');
            }
	    logger.info(uid);
            user.setUserField(username, 'password', hash, (error) => {
	      if (error){
	        return reject('Error updating password: ', error);
	      }
	      logger.info(`Password for ${username} updated`);
	      resolve();
	    });
	  });
        });
      });
    });
  }

  unlock (userid) {
     var user = require('./src/app/model/user');
     console.log('Clear log attempts on user: ' + userid);
     user.auth.clearLoginAttempts(userid);
  }
}

new CommandLineUtils()
