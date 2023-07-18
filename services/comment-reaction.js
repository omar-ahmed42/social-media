const { Comment, CommentStatusEnum } = require('../models/comment');
const { CommentReaction } = require('../models/comment-reaction');

async function saveCommentReaction(userId, reactionId, commentId) {
  let comment = await Comment.findByPk(commentId);
  if (!comment) return null; // TODO: throw an exception
  if (comment.getDataValue('commentStatus') == CommentStatusEnum.draft)
    return null; // TODO: throw an exception
  
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
