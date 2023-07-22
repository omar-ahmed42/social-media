const { Post, PostStatusEnum } = require('../models/post');
const { PostAttachment } = require('../models/post-attachment');
const { isFriend } = require('./friend');
const Fanout = require('./fanout.js');
const { isBlank } = require('../utils/string-utils');
const { Attachment } = require('../models/attachment');
const { postCacheRepository } = require('../cache/models/post');
const { Comment } = require('../models/comment');
const { GraphQLError } = require('graphql');

async function deletePost(userId, postId) {
  return await Post.destroy({
    where: { id: postId, userId: userId },
  });
}

async function findPost(userId, postId) {
  const post = await Post.findByPk(postId, {
    include: { model: PostAttachment, include: Attachment },
  });
  if (post.userId === userId) return post.get();

  if (
    post.postStatus === PostStatusEnum.published &&
    (await isFriend(userId, post.userId))
  )
    return post.get();

  return null; // or Throw an exception
}

async function savePost(userId, postId, msg) {
  let post = null;
  switch (msg.postStatus) {
    case PostStatusEnum.archived:
      post = await archivePost(userId, postId, msg);
      break;
    case PostStatusEnum.draft:
      post = await savePostAsDraft(userId, postId, msg);
      break;
    case PostStatusEnum.published:
      post = await publishPost(userId, postId, msg);
      break;
  }

  return post.get();
}

async function archivePost(userId, postId, msg) {
  if (!postId) {
    throw new GraphQLError('No post id provided', {
      path: 'savePost',
      extensions: {
        code: 'BAD_USER_INPUT',
        argumentName: 'id',
      },
    });
  }

  let post = await Post.findByPk(postId);
  if (!post) {
    throw new GraphQLError('Post not found', {
      path: 'savePost',
      extensions: {
        code: 'NOT_FOUND',
      },
    });
  }
  if (post.getDataValue('postStatus') === PostStatusEnum.draft) {
    throw new GraphQLError('Cannot archive draft post', {
      path: 'savePost',
      extensions: {
        code: 'BAD_USER_INPUT',
      },
    });
  }
  post.content = msg.content; // TODO: If the content is empty, check if there are no attachments or not
  post.postStatus = PostStatusEnum.archived;
  return await post.save();
}

async function savePostAsDraft(userId, postId, msg) {
  if (!postId)
    return await Post.create({
      userId: userId,
      content: msg.content,
      postStatus: PostStatusEnum.draft,
    });

  let post = await Post.findByPk(postId);
  if (!post) {
    throw new GraphQLError('Post not found', {
      path: 'savePost',
      extensions: {
        code: 'NOT_FOUND',
      },
    });
  }
  if (post.getDataValue('postStatus') !== PostStatusEnum.draft) {
    throw new GraphQLError('Cannot publish a non-draft post', {
      path: 'savePost',
      extensions: {
        code: 'BAD_USER_INPUT',
      },
    });
  }

  post.content = msg.content;
  return await post.save();
}

async function publishPost(userId, postId, msg) {
  if (!postId) {
    if (!isBlank(msg.content)) {
      let post = await Post.create({
        content: msg.content,
        userId: userId,
        postStatus: PostStatusEnum.published,
      });
      Fanout.pushToNewsFeed(userId, post.getDataValue('id'));
      savePostModelToCache(post);
      return post;
    }

    throw new GraphQLError('Post content is empty', {
      path: 'savePost',
      extensions: {
        code: 'BAD_USER_INPUT',
        argumentName: 'content',
      },
    });
  } else {
    if (!isBlank(msg.content)) {
      const [affectRowCount] = await Post.update(
        { content: msg.content, postStatus: PostStatusEnum.published },
        { where: { id: postId, userId: userId } }
      );
      return affectRowCount > 0 ? await Post.findByPk(postId) : null;
    }

    let post = await Post.findByPk(postId, {
      include: [{ model: PostAttachment, include: Attachment }],
    });

    if (!post) {
      throw new GraphQLError('Post not found', {
        path: 'savePost',
        extensions: {
          code: 'NOT_FOUND',
        },
      });
    }
    if (post.getDataValue('userId') !== userId) {
      throw new GraphQLError('Forbidden', {
        path: 'savePost',
        extensions: {
          code: 'FORBIDDEN',
        },
      });
    }
    if (post.getDataValue('PostAttachments')?.length == 0) {
      throw new GraphQLError('No content nor attachments provided', {
        path: 'savePost',
        extensions: {
          code: 'BAD_USER_INPUT',
          argumentName: 'content',
        },
      });
    }

    const oldPostStatus = post.getDataValue('postStatus');
    post.set({ content: msg.content, postStatus: PostStatusEnum.published });
    const updatedPost = await post.save();
    if (oldPostStatus == PostStatusEnum.draft) {
      Fanout.pushToNewsFeed(userId, updatedPost.getDataValue('id'));
      savePostModelToCache(updatedPost);
    }
    return updatedPost;
  }
}

async function savePostModelToCache(post) {
  try {
    return await postCacheRepository.save(
      post.getDataValue('id').toString(),
      await transformToCacheablePost(post.get(), post.get().PostAttachments)
    );
  } catch (err) {
    console.err('An error has occurred while saving post model to cache:', err);
  }
}

async function transformToCacheablePost(post, postAttachments) {
  let cacheablePost = post;

  if (!postAttachments?.length) return cacheablePost;

  let attachmentURLs = [];
  for (const postAttachment of postAttachments) {
    const url = postAttachment.Attachment.getDataValue('url');
    attachmentURLs.push(url);
  }

  delete cacheablePost.PostAttachments;
  cacheablePost.postAttachments = attachmentURLs;
  return cacheablePost;
}

async function findPostByCommentId(commentId) {
  try {
    let comment = await Comment.findByPk(commentId, {
      include: {
        model: Post,
        attributes: ['id', 'content', 'createdAt', 'lastModifiedAt'],
        include: {
          model: PostAttachment,
          attributes: [],
          include: {
            model: Attachment,
            attributes: ['id', 'url'],
          },
        },
      },
      attributes: [],
    });
    return comment ? comment.get().Post : null;
  } catch (e) {
    console.error(e);
  }
}

async function findPostsByUserId(userId) {
  let posts = await Post.findAll({
    where: { userId: userId },
    attributes: ['id', 'content', 'postStatus', 'createdAt', 'lastModifiedAt'],
  });

  return posts.map((post) => post.get());
}

async function findPostByPostAttachmentId(postAttachmentId) {
  try {
    let postAttachment = await PostAttachment.findByPk(postAttachmentId, {
      include: {
        model: Post,
        attributes: ['id', 'content', 'createdAt', 'lastModifiedAt'],
      },
      attributes: [],
    });
    return postAttachment ? postAttachment.get().Post : null;
  } catch (e) {
    console.error(e);
  }
}

module.exports = {
  findPostByCommentId,
  savePost,
  archivePost,
  savePostAsDraft,
  publishPost,
  findPost,
  deletePost,
  findPostsByUserId,
  savePostModelToCache,
  findPostByPostAttachmentId,
};
