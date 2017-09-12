/*jslint node: true */
const middleware = require("./../middleware/middleware");

class Error {

  load (app) {
    app.get('/403', (req, res) => {
      middleware.render('middleware/403', req, res);
    });

    app.get('/404', (req, res) => {
      middleware.render('middleware/404', req, res);
    });

    app.get('/api/view/500', (req, res) => {
      middleware.render('api/middleware/500', req, res, {
        err: req.session.error
      });
      req.session.error = null;
    });
    app.get('/500', (req, res) => {
      middleware.render('middleware/500', req, res, {
        err: req.session.error
      });
      req.session.error = null;
    });
  };
}

module.exports = new Error();
