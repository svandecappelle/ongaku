"use strict";

module.exports = function(sequelize, DataTypes) {
  var Pricing = sequelize.define("Installations", {
    version: {
      type: DataTypes.STRING,
      primaryKey: true
    }
  }, {
    tableName: 'installations',
    timestamps: true, // don't add the timestamp attributes (updatedAt, createdAt)
    underscored: true // transform the columns camelCase into underscored table_name.
  });

  return Pricing;
};