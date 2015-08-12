
/*jslint node: true */
var users = require("./users"),
    admins = require("./admins");

(function (Routes) {
    "use strict";

    Routes.load = function (app) {
        // users routes
        users.load(app);

        // admins routes
        admins.load(app);
    };

}(exports));