
/*jslint node: true */
var middleware = require("./../middleware/middleware");

(function (ErrorRoutes) {
    "use strict";

    ErrorRoutes.load = function (app) {
      app.get('/403', function (req, res) {
        middleware.render('middleware/403', req, res);
      });

      app.get('/404', function (req, res) {
        middleware.render('middleware/404', req, res);
      });

      app.get('/500', function (req, res) {
        middleware.render('middleware/500', req, res);
      });
    };

}(exports));
