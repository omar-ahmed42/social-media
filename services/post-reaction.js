const { Post, PostStatusEnum } = require('../models/post');
const { PostReaction } = require('../models/post-reaction');
const { GraphQLError } = require('graphql');

async function savePostReaction(userId, reactionId, postId) {
  let post = await Post.findByPk(postId);
  if (!post) {
    throw new GraphQLError('Post not found', {
      path: 'savePostReaction',
      extensions: {
        code: 'NOT_FOUND',
      },
    });
  }

  if (post.getDataValue('postStatus') == PostStatusEnum.draft) {
    throw new GraphQLError('Forbidden', {
      path: 'savePostReaction',
      extensions: {
        code: 'FORBIDDEN',
      },
    });
  }

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
