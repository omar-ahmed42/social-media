const { sequelize } = require('../db/connect');
const { DataTypes } = require('sequelize');

const AttachmentStatusEnum = Object.freeze({
  uploading: 'uploading',
  completed: 'completed',
  failed: 'failed',
});

const AttachmentTypeEnum = Object.freeze({
  image: 'image',
  video: 'video',
});

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
      type: DataTypes.STRING(50),
    },
    url: {
      type: DataTypes.TEXT,
    },
    size: {
      type: DataTypes.BIGINT,
    },
    type: {
      type: DataTypes.ENUM(AttachmentTypeEnum.image, AttachmentTypeEnum.video),
    },
    extension: {
      type: DataTypes.CHAR(25),
    },
    status: {
      type: DataTypes.ENUM(
        AttachmentStatusEnum.uploading,
        AttachmentStatusEnum.completed,
        AttachmentStatusEnum.failed
      ),
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
  AttachmentStatusEnum,
};
