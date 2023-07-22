const { GraphQLError } = require('graphql');
const { Comment, CommentStatusEnum } = require('../models/comment');
const { CommentReaction } = require('../models/comment-reaction');

async function saveCommentReaction(userId, reactionId, commentId) {
  let comment = await Comment.findByPk(commentId);
  if (!comment) {
    throw new GraphQLError('Comment not found', {
      path: 'saveCommentReaction',
      extensions: {
        code: 'NOT_FOUND',
        argumentName: 'commentId',
      },
    });
  }
  
  if (comment.getDataValue('commentStatus') == CommentStatusEnum.draft) {
    throw new GraphQLError('Bad user input', {
      path: 'saveCommentReaction',
      extensions: {
        code: 'BAD_USER_INPUT',
        argumentName: 'commentId',
      },
    });
  }
  
  let commentReaction = await CommentReaction.findOne({
    where: {
      userId: userId,
      commentId: commentId,
    },
  });
  if (!commentReaction) {
    return await CommentReaction.create({
      commentId: commentId,
      userId: userId,
      reactionId: reactionId,
    });
  } else {
    return await commentReaction.update(
      { commentId: commentId, userId: userId, reactionId: reactionId },
      { where: { userId: userId, commentId: commentId } }
    );
  }
}

module.exports = {
  saveCommentReaction,
};
