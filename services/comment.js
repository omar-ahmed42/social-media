const { Comment, CommentStatusEnum } = require('../models/comment');
const { Post, PostStatusEnum } = require('../models/post');
const { isBlank } = require('../utils/string-utils');
const { GraphQLError } = require('graphql');

async function saveComment(userId, commentId, postId, msg) {
  if (!postId) {
    throw new GraphQLError('BAD_USER_INPUT', {
      path: 'saveComment',
      extensions: {
        code: 'BAD_USER_INPUT',
        argumentName: 'postId',
      },
    });
  }
  let post = await Post.findByPk(postId);
  if (!post) {
    throw new GraphQLError('Post not found', {
      path: 'saveComment',
      extensions: {
        code: 'NOT_FOUND',
      },
    });
  }
  if (post.getDataValue('postStatus') != PostStatusEnum.published) {
    throw new GraphQLError('Bad user input', {
      path: 'saveComment',
      extensions: {
        code: 'BAD_USER_INPUT',
        argumentName: 'postStatus',
      },
    });
  }

  let comment = null;
  switch (msg.commentStatus) {
    case CommentStatusEnum.draft:
      comment = await saveCommentAsDraft(userId, commentId, postId, msg);
      break;
    case CommentStatusEnum.published:
      comment = await publishComment(userId, commentId, postId, msg);
      break;
  }

  return comment.get();
}

async function saveCommentAsDraft(userId, commentId, postId, msg) {
  if (!commentId)
    return await Comment.create({
      postId: postId,
      userId: userId,
      content: msg.content,
      commentStatus: CommentStatusEnum.draft,
    });

  let comment = await Comment.findByPk(commentId);
  if (!comment) {
    throw new GraphQLError('Comment not found', {
      path: 'saveComment',
      extensions: {
        code: 'NOT_FOUND',
      },
    });
  }
  if (comment.getDataValue('postId') !== postId) {
    throw new GraphQLError('Incorrect provided post id', {
      path: 'saveComment',
      extensions: {
        code: 'BAD_USER_INPUT',
        argumentName: 'postId',
      },
    });
  }
  if (comment.getDataValue('commentStatus') !== CommentStatusEnum.draft) {
    throw new GraphQLError(
      'Cannot save a non-draft comment as a draft comment',
      {
        path: 'saveComment',
        extensions: {
          code: 'BAD_USER_INPUT',
          argumentName: 'commentStatus',
        },
      }
    );
  }

  comment.content = msg.content;
  return await comment.save();
}

async function publishComment(userId, commentId, postId, msg) {
  if (!commentId) {
    if (!isBlank(msg.content))
      return await Comment.create({
        content: msg.content,
        userId: userId,
        postId: postId,
        commentStatus: CommentStatusEnum.published,
      });

    throw new GraphQLError('Comment body is empty', {
      path: 'saveComment',
      extensions: {
        code: 'BAD_USER_INPUT',
        argumentName: 'content',
      },
    });
  } else {
    if (!isBlank(msg.content)) {
      const [affectRowCount] = await Comment.update(
        { content: msg.content, commentStatus: CommentStatusEnum.published },
        { where: { id: commentId, userId: userId, postId: postId } }
      );
      return affectRowCount > 0 ? await Comment.findByPk(commentId) : null;
    }

    let comment = await Comment.findByPk(commentId, {
      include: [{ model: CommentAttachment, include: Attachment }],
    });

    if (!comment) {
      throw new GraphQLError('Comment not found', {
        path: 'saveComment',
        extensions: {
          code: 'NOT_FOUND',
        },
      });
    }
    if (comment.getDataValue('userId') !== userId) {
      throw new GraphQLError('Forbidden', {
        path: 'saveComment',
        extensions: {
          code: 'FORBIDDEN',
        },
      });
    }
    if (comment.getDataValue('postId') !== postId) {
      throw new GraphQLError('Incorrect provided post id', {
        path: 'saveComment',
        extensions: {
          code: 'BAD_USER_INPUT',
          argumentName: 'postId',
        },
      });
    }
    if (comment.getDataValue('CommentAttachments')?.length == 0) {
      throw new GraphQLError('No body nor attachments provided', {
        path: 'saveCommentAttachment',
        extensions: {
          code: 'BAD_USER_INPUT',
          argumentName: 'content',
        },
      });
    }

    comment.set({
      content: msg.content,
      commentStatus: CommentStatusEnum.published,
    });
    const updatedComment = await comment.save();
    saveCommentModelToCache(updatedComment);
    return updatedComment;
  }
}

async function saveCommentModelToCache(comment) {
  try {
    return await commentCacheRepository.save(
      comment.getDataValue('id').toString(),
      await transformToCacheableComment(
        comment.get(),
        comment.get().CommentAttachments
      )
    );
  } catch (err) {
    console.err(
      'An error has occurred while saving comment model to cache:',
      err
    );
  }
}

async function transformToCacheableComment(comment, commentAttachments) {
  let cacheableComment = comment;

  if (!commentAttachments?.length) return cacheableComment;

  let attachmentURLs = [];
  for (const commentAttachment of commentAttachments) {
    const url = commentAttachment.Attachment.getDataValue('url');
    attachmentURLs.push(url);
  }

  delete cacheableComment.PostAttachments;
  cacheableComment.commentAttachments = attachmentURLs;
  return cacheableComment;
}

async function deleteComment(userId, commentId) {
  try {
    return await Comment.destroy({
      where: { id: commentId, userId: userId },
    });
  } catch (e) {
    console.error('ERROR: ' + e);
  }
}

async function findCommentById(commentId, userId) {
  try {
    let comment = await Comment.findByPk(commentId);
    if (!comment) return null;
    if (
      comment.getDataValue('commentStatus') == CommentStatusEnum.draft &&
      userId !== comment.getDataValue('userId')
    ) {
      {
        throw new GraphQLError('Forbidden', {
          path: 'saveComment',
          extensions: {
            code: 'FORBIDDEN',
          },
        });
      }
    }
    return comment.get();
  } catch (e) {
    console.error('ERROR: ' + e);
  }
}

async function findCommentsByPostId(postId) {
  try {
    let comments = await Comment.findAll({ where: { postId: postId } });
    return comments.map((comment) => comment.get());
  } catch (e) {
    console.error('ERROR:', e);
  }
}

async function findCommentByCommentAttachmentId(commentAttachmentId) {
  try {
    let commentAttachment = await PostAttachment.findByPk(commentAttachmentId, {
      include: {
        model: Comment,
        attributes: ['id', 'content', 'createdAt', 'lastModifiedAt'],
      },
      attributes: [],
    });
    return commentAttachment ? commentAttachment.get().Comment : null;
  } catch (e) {
    console.error(e);
  }
}

module.exports = {
  deleteComment,
  findCommentById,
  saveComment,
  findCommentsByPostId,
  findCommentByCommentAttachmentId,
};
