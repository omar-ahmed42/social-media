const { DataTypes } = require('sequelize');
const { sequelize } = require('../db/connect');

const Reaction = sequelize.define(
  'Reaction',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    name: { type: DataTypes.STRING(50), allowNull: false, unique: true },
  },
  {
    tableName: 'reaction',
    underscored: true,
    createdAt: true,
    updatedAt: 'lastModifiedAt',
  }
);

module.exports = {
  Reaction,
};
