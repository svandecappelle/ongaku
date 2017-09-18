"use strict";

module.exports = function(sequelize, DataTypes) {
  var UserGroups = sequelize.define("UserGroups", {}, {
    underscored: true, // transform the columns camelCase into underscored table_name.
    tableName: 'user_groups',
    freezeTableName: true
  });
  return UserGroups;
};
