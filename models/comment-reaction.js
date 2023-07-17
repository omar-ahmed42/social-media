const { DataTypes } = require('sequelize');
const { sequelize } = require('../db/connect');
const { Comment } = require('./comment');
const { Reaction } = require('./reaction');
const { User } = require('./user');

const CommentReaction = sequelize.define(
  'CommentReaction',
  {
    reactionId: {
      type: DataTypes.INTEGER,
      references: { model: Reaction, key: 'id' },
    },
    commentId: {
      type: DataTypes.BIGINT,
      references: { model: Comment, key: 'id' },
      primaryKey: true,
    },
    userId: {
      type: DataTypes.BIGINT,
      references: { model: User, key: 'id' },
      primaryKey: true,
    },
  },
  {
    tableName: 'comment_reaction',
    underscored: true,
    createdAt: true,
    updatedAt: 'lastModifiedAt',
  }
);

Reaction.hasMany(CommentReaction, { foreignKey: 'reactionId' });
CommentReaction.belongsTo(Reaction, { foreignKey: 'reactionId' });

User.hasMany(CommentReaction, { foreignKey: 'userId' });
CommentReaction.hasMany(User, { foreignKey: 'userId' });

Comment.hasMany(CommentReaction, {foreignKey: 'commentId'});
CommentReaction.belongsTo(Comment, {foreignKey: 'commentId'});

module.exports = {
  CommentReaction,
};
