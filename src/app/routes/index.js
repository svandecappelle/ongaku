
/*jslint node: true */
var users = require("./users"),
    admins = require("./admins"),
    errors = require("./errors"),
    authentication = require("./authentication");

(function (Routes) {
    "use strict";

    Routes.load = function (app) {
      authentication.initialize(app);
      authentication.load(app);

      // users routes
      users.load(app);

      // admins routes
      admins.load(app);

      // errors views
      errors.load(app);
    };

}(exports));
