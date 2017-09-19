"use strict";

module.exports = function(sequelize, DataTypes) {
  var Group = sequelize.define("Group", {
    name: DataTypes.STRING
  }, {
    underscored: true, // transform the columns camelCase into underscored table_name.
    tableName: 'groups'
  });

  Group.associate = function(models) {
    Group.belongsToMany(models.User, { as: 'Users', through: models.UserGroups} );
  }

  return Group;
};
