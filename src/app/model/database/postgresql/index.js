"use strict";

var fs        = require("fs");
var path      = require("path");
var nconf = require("nconf");
var Sequelize = require("sequelize");
var env       = process.env.NODE_ENV || "development";
var config    = nconf.get('postgres');
var sequelize = new Sequelize(config.database, config.username, config.password, config);
var db        = {};

fs
  .readdirSync(__dirname)
  .filter(function(file) {
    return (file.indexOf(".") !== -1) && (file.indexOf(".") !== 0) && (file !== "index.js");
  })
  .forEach(function(file) {
    console.log(path.join(__dirname, file));
    var model = sequelize.import(path.join(__dirname, file));
    db[model.name] = model;
  });

Object.keys(db).forEach(function(modelName) {
  if ("associate" in db[modelName]) {
    db[modelName].associate(db);
  }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
