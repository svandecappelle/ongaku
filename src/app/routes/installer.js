/*jslint node: true */
var middleware = require("./../middleware/middleware");

(function (ErrorRoutes) {
    "use strict";

    ErrorRoutes.load = function (app) {
      app.get('/', function (req, res) {
        middleware.render('admin/installer', req, res);
      });

      app.get('/install', function (req, res) {
        middleware.render('admin/installer', req, res);
      });
    };

}(exports));
