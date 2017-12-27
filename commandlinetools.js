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
    console.log("parse opts");
    this.parseOpts();
  }

  parseOpts() {
    process.argv.slice(2).forEach((command) => {
      command = command.split("=");
      if (command[0] === 'unlock') {
        this.unlock(command[1]);
      } else if (command[0] === "checkuser") {
        this.checkuser(command[1]);
      } else if (command[0] === "passwd") {
      	this.passwd(command[1]);
      }
    });
  }

  checkuser (userid) {
    var user = require('./src/app/model/user');
    var db = require('./src/app/model/database');
    db.get('lockout:'+userid, (err, value) => {
      logger.info(err, value);
    });
  }

  passwd (username) {
    var rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    rl.question('new passwd: ', (password) => {
      rl.close();
      
      var user = require('./src/app/model/user');
      user.hashPassword(password, (err, hash) => {
        if (err) {
           logger.error('Error generating hash password: ', error);
	   return;
        }
        user.getUidByUsername(username, (err, uid) => {
          if (err){
	    logger.error('username invalid');
            return;
          }
          user.setUserField(uid, 'password', hash, (error) => {
	    if (error){
	      logger.error('Error updating password: ', error);
	    }
	    logger.info('done');
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
