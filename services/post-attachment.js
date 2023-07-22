const { sequelize } = require('../db/connect');
const { Attachment, AttachmentStatusEnum } = require('../models/attachment');
const { Post } = require('../models/post');
const { PostAttachment } = require('../models/post-attachment');
const {
  isValidImage,
  isValidVideo,
} = require('../utils/validators/attachment');
const path = require('path');
const fs = require('fs');
const { v4 } = require('uuid');
const { storeFile, DEFAULT_UPLOADS_PATH } = require('./attachment');
const { GraphQLError } = require('graphql');

async function savePostAttachment(file, userId, postId) {
  let attachment = await saveAttachment(file, userId);
  await addPostAttachment(userId, postId, attachment.id);
  attachment.postId = postId;
  return attachment;
}

async function saveAttachment(file, userId) {
  const { createReadStream, filename } = await file;
  const fileExtension = path.extname(filename)?.toLowerCase();

  let name = v4() + fileExtension;
  const USER_UPLOADS_DIR = path.join(
    __dirname,
    DEFAULT_UPLOADS_PATH,
    'users',
    userId.toString()
  );
  const attachmentUrl = path.join(USER_UPLOADS_DIR, name);

  if (!fs.existsSync(USER_UPLOADS_DIR))
    fs.mkdirSync(USER_UPLOADS_DIR, { recursive: true });

  if (!isValidPostAttachmentExtension(fileExtension)) {
    throw new GraphQLError('Unsupported media type', {
      extensions: {
        code: 'UNSUPPORTED_MEDIA_TYPE',
        argumentName: 'attachment',
      },
    });
  }

  const attachmentType = getAttachmentTypeFromExtension(fileExtension);
  let attachment = await Attachment.create({
    name: name,
    url: attachmentUrl,
    extension: fileExtension,
    type: attachmentType,
    status: AttachmentStatusEnum.uploading,
  });

  try {
    await storeFile(createReadStream, attachmentUrl);
    let size = fs.statSync(attachmentUrl).size;
    (await Promise.resolve(attachment)).update({
      size: size,
      status: AttachmentStatusEnum.completed,
    });

    return attachment.get();
  } catch (err) {
    console.error(`Error while uploading an attachment: ${err}`);
    return (await Promise.resolve(attachment)).update({
      status: AttachmentStatusEnum.failed,
    });
  }
}

function isValidPostAttachmentExtension(fileExtension) {
  return isValidVideo(fileExtension) || isValidImage(fileExtension);
}

function getAttachmentTypeFromExtension(fileExtension) {
  if (isValidImage(fileExtension)) return 'image';
  else if (isValidVideo(fileExtension)) return 'video';
  return 'other';
}

async function addPostAttachment(userId, postId, attachmentId) {
  return await sequelize.transaction(async (t) => {
    let post = await Post.findByPk(postId);
    if (userId !== post.userId) {
      throw new GraphQLError('Forbidden', {
        path: 'savePostAttachment',
        extensions: {
          code: 'FORBIDDEN',
        },
      });
    }

    let attachment = await Attachment.findByPk(attachmentId);
    if (!attachment) {
      throw new GraphQLError('Attachment not found', {
        path: 'savePostAttachment',
        extensions: {
          code: 'NOT_FOUND',
        },
      });
    }

    let [postAttachment] = await PostAttachment.upsert(
      { postId: postId, attachmentId: attachmentId },
      { transaction: t }
    );
    return postAttachment;
  });
}

async function findPostAttachmentsByPostId(postId) {
  let postAttachments = await PostAttachment.findAll({
    where: { postId: postId },
    include: { model: Attachment, attributes: ['id', 'url'] },
    attributes: ['postId'],
  });

  return transformPostAttachmentsModelToGraphQLPostAttachment(
    postAttachments,
    postId
  );
}

function transformPostAttachmentsModelToGraphQLPostAttachment(
  postAttachments,
  postId
) {
  let attachments = [];
  if (postAttachments?.length > 0) {
    postAttachments.forEach((postAttachment) => {
      let attachment = { postId: postId };
      attachment.id = postAttachment.get().Attachment.getDataValue('id');
      attachment.url = postAttachment.get().Attachment.getDataValue('url');
      attachments.push(attachment);
    });
  }
  return attachments;
}

module.exports = {
  addPostAttachment,
  savePostAttachment,
  findPostAttachmentsByPostId,
  transformPostAttachmentsModelToGraphQLPostAttachment,
};
