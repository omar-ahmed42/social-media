const { DataTypes } = require('sequelize');
const { sequelize } = require('../db/connect');

const Conversation = sequelize.define(
  'Conversation',
  {
    id: { type: DataTypes.BIGINT, primaryKey: true, allowNull: false },
    name: { type: DataTypes.STRING(75) },
    isGroup: { type: DataTypes.BOOLEAN },
  },
  {
    tableName: 'conversation',
    underscored: true,
    createdAt: true,
    updatedAt: 'lastModifiedAt',
  }
);

module.exports = {
  Conversation,
};
