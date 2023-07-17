const { Post, PostStatusEnum } = require('../models/post');
const { PostReaction } = require('../models/post-reaction');

async function savePostReaction(userId, reactionId, postId) {
  let post = await Post.findByPk(postId);
  if (!post) return null; // TODO: throw an exception
  if (post.getDataValue('postStatus') == PostStatusEnum.draft) return null; // TODO: throw an exception

  let postReaction = await PostReaction.findOne({
    where: {
      userId: userId,
      postId: postId,
    },
  });
  if (!postReaction) {
    return await PostReaction.create({
      postId: postId,
      userId: userId,
      reactionId: reactionId,
    });
  } else {
    return await postReaction.update(
      { postId: postId, userId: userId, reactionId: reactionId },
      { where: { userId: userId, postId: postId } }
    );
  }
}

module.exports = {
  savePostReaction,
};
