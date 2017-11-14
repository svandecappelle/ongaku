/*jslint node: true */
const users = require("./users");
const admins = require("./admins");
const installer = require("./installer");
const errors = require("./errors");
const authentication = require("./authentication");
const group = require("./../model/groups");
const logger = require('log4js').getLogger('routes');

class Routes {

  testingInstallFromSql(){
    // 
    const version = require("../utils/version");
    version.check().then((version) => {
      console.log(version);

      if ( !version.installed ){
        var prompt = require('prompt');
        prompt.start();
        
        prompt.get({
          type: "string",
          pattern: /Y|n/,
          message: 'do you want to install application ? Y/n',
          name: "install"
        }, function (err, result) {
          if (err) { return console.error(err); }
          console.log('Command-line input received:');
          console.log('  Username: ' + result.install);
          if (result.install === 'Y') {
            var install = require("../model/database/postgresql/install");
            install.install();
          }
        });
      }
    });
  }

  load (app) {
    // this.testingInstallFromSql();

    authentication.initialize(app);
    authentication.load(app);

    group.get("administrators", {truncateUserList: true}, function(err, admin_group){
      if (!admin_group || !admin_group.members || admin_group.members.length === 0){
        logger.info("Not installed");
        installer.load(app, function(){
          // users routes
          users.load(app);

          // admins routes
          admins.load(app);
        });
      } else {
        logger.info("Application already installed");
        // users routes
        users.load(app);

        // admins routes
        admins.load(app);
       }

      // errors views
      errors.load(app);
    });
  }

}

module.exports = new Routes();
