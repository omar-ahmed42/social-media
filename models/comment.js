const { DataTypes } = require('sequelize');
const { sequelize } = require('../db/connect');
const { Post } = require('./post');
const { User } = require('./user');
const { CommentAttachment } = require('./comment-attachment');

const CommentStatusEnum = Object.freeze({
  draft: 'draft',
  published: 'published',
});

const Comment = sequelize.define(
  'Comment',
  {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    content: { type: DataTypes.TEXT },
    commentStatus: {
      type: DataTypes.ENUM(
        CommentStatusEnum.published,
        CommentStatusEnum.draft
      ),
    },
    postId: {
      type: DataTypes.BIGINT,
      references: { model: Post, key: 'id' },
      allowNull: false,
    },
    userId: {
      type: DataTypes.BIGINT,
      references: { model: User, key: 'id' },
      allowNull: false,
    },
  },
  {
    tableName: 'comment',
    underscored: true,
    createdAt: true,
    updatedAt: 'lastModifiedAt',
  }
);

User.hasMany(Comment, { foreignKey: 'userId' });
Comment.belongsTo(User, { foreignKey: 'userId' });


Comment.hasMany(CommentAttachment, { foreignKey: 'commentId' });
CommentAttachment.belongsTo(Comment, { foreignKey: 'commentId' });

module.exports = {
  CommentStatusEnum,
  Comment,
};
