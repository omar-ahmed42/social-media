const { sequelize } = require('../db/connect');
const { DataTypes } = require('sequelize');

const Attachment = sequelize.define(
  'Attachment',
  {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true, // Will be replaced with snowflake UID,
      allowNull: false,
    },
    name: {
      type: DataTypes.UUID,
    },
    url: {
      type: DataTypes.TEXT,
    },
    size: {
      type: DataTypes.BIGINT,
    },
    type: {
      type: DataTypes.CHAR(75),
    },
  },
  {
    tableName: 'attachment',
    underscored: true,
    createdAt: true,
    updatedAt: 'lastModifiedAt',
  }
);

module.exports = {
  Attachment,
};
