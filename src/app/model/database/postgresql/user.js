"use strict";

module.exports = function(sequelize, DataTypes) {
  var User = sequelize.define("User", {
    username: DataTypes.STRING,
    password: DataTypes.STRING
  }, {
    tableName: 'users',
    timestamps: true, // don't add the timestamp attributes (updatedAt, createdAt)
    underscored: true // transform the columns camelCase into underscored table_name.
  });

  User.associate = function(models) {
    User.belongsToMany(models.Group, { as: 'Group', through: models.UserGroups});
  };

  return User;
};
