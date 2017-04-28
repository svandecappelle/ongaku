
/*jslint node: true */
var users = require("./users"),
    admins = require("./admins"),
    installer = require("./installer"),
    errors = require("./errors"),
    authentication = require("./authentication"),
    group = require("./../model/groups"),
    logger = require('log4js').getLogger('routes');

(function (Routes) {
    "use strict";

    Routes.load = function (app) {
      authentication.initialize(app);
      authentication.load(app);

      group.get("administrators", {truncateUserList: true}, function(err, admin_group){
        if (!admin_group || !admin_group.members || admin_group.members.length === 0){
          logger.info("Not installed");
          installer.load(app, function(){
            Routes.load(app);
          });
        } else {
          // users routes
          users.load(app);

          // admins routes
          admins.load(app);
         }

        // errors views
        errors.load(app);

      });
    };

}(exports));
