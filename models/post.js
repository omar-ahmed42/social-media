const { sequelize } = require('../db/connect');
const { DataTypes } = require('sequelize');
const { User } = require('./user');
const { PostAttachment } = require('./post-attachment');
const { Comment } = require('./comment');

const PostStatusEnum = Object.freeze({
  draft: 'draft',
  published: 'published',
  archived: 'archived',
});

const Post = sequelize.define(
  'Post',
  {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true, // Will be replaced with snowflake UID,
      allowNull: false,
    },
    content: {
      type: DataTypes.STRING(50),
    },
    postStatus: {
      type: DataTypes.ENUM(
        PostStatusEnum.draft,
        PostStatusEnum.published,
        PostStatusEnum.archived
      ),
      allowNull: false,
    },
    userId: {
      type: DataTypes.BIGINT,
      allowNull: false,
      references: { model: User, key: 'id' },
    },
  },
  {
    tableName: 'post',
    underscored: true,
    createdAt: true,
    updatedAt: 'lastModifiedAt',
  }
);

Post.hasMany(PostAttachment, { foreignKey: 'postId' });
PostAttachment.belongsTo(Post, { foreignKey: 'postId' });

User.hasMany(Post, { foreignKey: 'userId' });
Post.belongsTo(User, { foreignKey: 'userId' });

Post.hasMany(Comment, { foreignKey: 'postId' });
Comment.belongsTo(Post, { foreignKey: 'postId' });

module.exports = {
  Post,
  PostStatusEnum,
};
