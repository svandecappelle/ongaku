/*jslint node: true */
var middleware = require("./../middleware/middleware")
    logger = require('log4js').getLogger('installer');

(function (InstallerRoutes) {
    "use strict";

    InstallerRoutes.load = function (app, afterInstall) {
      app.get('/', function (req, res) {
        middleware.render('admin/installer', req, res);
      });

      app.get('/install', function (req, res) {
        middleware.render('admin/installer', req, res);
      });
      
      app.post('/', function(req, res){
        logger.info('Application installed');
        afterInstall();
        setTimeout(function(){
            res.redirect("/");
        }, 1000);
      });

      app.post('/install', function(req, res){
        logger.info('Application installed');
        afterInstall();
        setTimeout(function(){
            res.redirect("/");
        }, 1000);
      });
    };

}(exports));
