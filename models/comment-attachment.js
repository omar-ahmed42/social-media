const { DataTypes } = require('sequelize');
const { sequelize } = require('../db/connect');
const { Attachment } = require('./attachment');
const { Comment } = require('./comment');

const CommentAttachment = sequelize.define(
  'CommentAttachment',
  {
    attachmentId: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      references: { model: Attachment, key: 'id' },
      allowNull: false,
    },
    commentId: {
      type: DataTypes.BIGINT,
      references: { model: Comment, key: 'id' },
    }
  },
  {
    tableName: 'comment_attachment',
    underscored: true,
    createdAt: true,
    updatedAt: 'last_modified_at',
  }
);

Attachment.hasOne(CommentAttachment, {foreignKey: 'attachmentId'});
CommentAttachment.belongsTo(Attachment, {foreignKey: 'attachmentId'});

module.exports = {
  CommentAttachment,
};
