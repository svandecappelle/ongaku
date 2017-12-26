const nconf = require('nconf');
const fs = require('fs');
const path = require('path');
const yaml_config = require('node-yaml-config');
const log4js = require('log4js');
const logger = log4js.getLogger('CommandLineTools');

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

  unlock (userid) {
     var user = require('./src/app/model/user');
     console.log('Clear log attempts on user: ' + userid);
     user.auth.clearLoginAttempts(userid);
  }
}

new CommandLineUtils()
