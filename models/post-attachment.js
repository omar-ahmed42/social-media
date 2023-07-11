const { DataTypes } = require('sequelize');
const { sequelize } = require('../db/connect');
const { Attachment } = require('./attachment');
const { Post } = require('./post');

const PostAttachment = sequelize.define(
  'PostAttachment',
  {
    attachmentId: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      references: { model: Attachment, key: 'id' },
      allowNull: false,
    },
    postId: {
      type: DataTypes.BIGINT,
      references: { model: Post, key: 'id' },
    }
  },
  {
    tableName: 'post_attachment',
    underscored: true,
    createdAt: true,
    updatedAt: 'last_modified_at',
  }
);

Attachment.hasOne(PostAttachment, {foreignKey: 'attachmentId'});
PostAttachment.belongsTo(Attachment, {foreignKey: 'attachmentId'});

module.exports = {
  PostAttachment,
};
