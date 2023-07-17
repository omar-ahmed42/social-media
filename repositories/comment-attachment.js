const { sequelize } = require('../db/connect');
const { Attachment, AttachmentStatusEnum } = require('../models/attachment');
const { Comment } = require('../models/comment');
const { CommentAttachment } = require('../models/comment-attachment');
const {
  isValidImage,
  isValidVideo,
} = require('../utils/validators/attachment');
const path = require('path');
const fs = require('fs');
const { v4 } = require('uuid');
const { storeFile, DEFAULT_UPLOADS_PATH } = require('./attachment');


async function saveCommentAttachment(file, userId, commentId) {
  let attachment = await saveAttachment(file, userId);
  await addCommentAttachment(userId, commentId, attachment.id);
  attachment.commentId = commentId;
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

  if (!isValidCommentAttachmentExtension(fileExtension)) return null; // TODO: Throw an exception

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

function isValidCommentAttachmentExtension(fileExtension) {
  return isValidVideo(fileExtension) || isValidImage(fileExtension);
}

function getAttachmentTypeFromExtension(fileExtension) {
  if (isValidImage(fileExtension)) return 'image';
  else if (isValidVideo(fileExtension)) return 'video';
  return 'other';
}

async function addCommentAttachment(userId, commentId, attachmentId) {
  return await sequelize.transaction(async (t) => {
    let comment = await Comment.findByPk(commentId);
    if (userId !== comment.userId) return null; // TODO: Throw an exception

    let attachment = await Attachment.findByPk(attachmentId);
    if (!attachment) return null; // TODO: Throw an exception

    let [commentAttachment] = await CommentAttachment.upsert(
      { commentId: commentId, attachmentId: attachmentId },
      { transaction: t }
    );
    return commentAttachment;
  });
}

async function findCommentAttachmentsByCommentId(commentId) {
  let commentAttachments = await CommentAttachment.findAll({
    where: { commentId: commentId },
    include: { model: Attachment, attributes: ['id', 'url'] },
    attributes: ['commentId'],
  });

  return transformCommentAttachmentsModelToGraphQLCommentAttachment(
    commentAttachments,
    commentId
  );
}

function transformCommentAttachmentsModelToGraphQLCommentAttachment(commentAttachments, commentId) {
  let attachments = [];
  if (commentAttachments?.length > 0) {
    commentAttachments.forEach((commentAttachment) => {
      let attachment = { commentId: commentId };
      attachment.id = commentAttachment.get().Attachment.getDataValue('id');
      attachment.url = commentAttachment.get().Attachment.getDataValue('url');
      attachments.push(attachment);
    });
  }
  return attachments;
}

module.exports = {
  addCommentAttachment,
  saveCommentAttachment,
  findCommentAttachmentsByCommentId,
  transformCommentAttachmentsModelToGraphQLCommentAttachment
};
