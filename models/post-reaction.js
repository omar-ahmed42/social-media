const { DataTypes } = require('sequelize');
const { sequelize } = require('../db/connect');
const { Post } = require('./post');
const { Reaction } = require('./reaction');
const { User } = require('./user');

const PostReaction = sequelize.define(
  'PostReaction',
  {
    reactionId: {
      type: DataTypes.INTEGER,
      references: { model: Reaction, key: 'id' },
    },
    postId: {
      type: DataTypes.BIGINT,
      references: { model: Post, key: 'id' },
      primaryKey: true,
    },
    userId: {
      type: DataTypes.BIGINT,
      references: { model: User, key: 'id' },
      primaryKey: true,
    },
  },
  {
    tableName: 'post_reaction',
    underscored: true,
    createdAt: true,
    updatedAt: 'lastModifiedAt',
  }
);

Reaction.hasMany(PostReaction, { foreignKey: 'reactionId' });
PostReaction.belongsTo(Reaction, { foreignKey: 'reactionId' });

User.hasMany(PostReaction, { foreignKey: 'userId' });
PostReaction.hasMany(User, { foreignKey: 'userId' });


Post.hasMany(PostReaction, {foreignKey: 'postId'});
PostReaction.belongsTo(Post, {foreignKey: 'postId'});


module.exports = {
  PostReaction,
};
