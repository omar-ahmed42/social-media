const { sequelize } = require('../db/connect');
const { User } = require('./user');
const { DataTypes } = require('sequelize');

const Role = sequelize.define(
  'Role',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true
    },
  },
  {
    tableName: 'role',
    underscored: true,
    createdAt: true,
    updatedAt: 'last_modified_at',
  }
);

const UserRole = sequelize.define(
  'UserRole',
  {
    userId: {
      type: DataTypes.BIGINT,
      allowNull: false,
      references: { model: User, key: 'id' },
    },
    roleId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: Role, key: 'id' },
    },
  },
  {
    tableName: 'user_role',
    underscored: true,
    createdAt: true,
    updatedAt: 'last_modified_at',
  }
);

User.belongsToMany(Role, { through: UserRole });
Role.belongsToMany(User, { through: UserRole });

module.exports = {
  Role,
  UserRole,
};
