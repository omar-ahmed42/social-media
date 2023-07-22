const { cassandraClient } = require('../db/connect');
const { TimeUuid } = require('cassandra-driver').types;
const {
  isValidVideo,
  isValidImage,
} = require('../utils/validators/attachment');
const { storeFile, DEFAULT_UPLOADS_PATH } = require('./attachment');
const { isBlank } = require('../utils/string-utils');
const { ConversationMember } = require('../models/conversation-members');
const { DEFAULT_PAGE_SIZE } = require('../utils/pagination');
const { pubsub } = require('../config/pub-sub');
const { findConversationAndMembers } = require('./conversation');
const { GraphQLError } = require('graphql');

async function findMessages(conversationId, userId, messageId) {
  let member = await ConversationMember.findOne({
    where: { conversationId: conversationId, userId: userId },
  });
  if (!member) {
    throw new GraphQLError('Conversation not found', {
      path: 'findMessages',
      extensions: {
        code: 'NOT_FOUND',
      },
    });
  }

  return messageId
    ? await findPreviousMessages(conversationId, messageId)
    : await findLatestMessages(conversationId);
}

async function findLatestMessages(conversationId) {
  let query = `
    SELECT conversation_id AS conversationId, message_id AS id, content, sender_id AS senderId, attachment, created_at AS createdAt FROM conversation_message
    WHERE conversation_id = ? LIMIT ?
    `;

  let messages = await cassandraClient.execute(
    query,
    [conversationId, DEFAULT_PAGE_SIZE],
    { isIdempotent: true, prepare: true }
  );
  return messages;
}

async function findPreviousMessages(conversationId, messageId) {
  let query = `
    SELECT conversation_id AS conversationId, message_id AS id, content, sender_id AS senderId, attachment, created_at AS createdAt FROM conversation_message
    WHERE conversation_id = ? AND message_id < ? LIMIT ?
    `;

  let messages = await cassandraClient.execute(
    query,
    [conversationId, messageId, DEFAULT_PAGE_SIZE],
    { isIdempotent: true, prepare: true }
  );
  return messages;
}

async function addMessage(userId, conversationId, file, messageDetails) {
  let conversation = await findConversationAndMembers(conversationId);

  if (!isMemberOf(conversation, userId)) {
    throw new GraphQLError('Forbidden', {
      path: 'sendMessage',
      extensions: {
        code: 'FORBIDDEN',
      },
    });
  }

  let attachment;
  if (file) attachment = await saveAttachment(file, userId);
  let message = await storeMessage(
    userId,
    conversationId,
    attachment,
    messageDetails
  );
  publishMessage(message, conversation);
  return message;
}

function isMemberOf(conversation, userId) {
  for (let member of conversation.ConversationMembers) {
    if (member.userId == userId) return true;
  }

  return false;
}

async function publishMessage(message, conversation) {
  let members = conversation.ConversationMembers;
  pubsub.publish(`MESSAGE_SENT_${message.senderId}`, { messageSent: message });

  members.forEach((member) =>
    pubsub.publish(`MESSAGE_RECEIVED_${member.userId}`, {
      messageReceived: message,
    })
  );
}

async function storeMessage(
  userId,
  conversationId,
  attachment,
  messageDetails
) {
  if (!messageDetails) {
    throw new GraphQLError('Bad user input', {
      path: 'sendMessage',
      extensions: {
        code: 'BAD_USER_INPUT',
      },
    });
  }
  if (!attachment && isBlank(messageDetails.content)) {
    throw new GraphQLError('No message body nor attachment provided', {
      path: 'sendMessage',
      extensions: {
        code: 'BAD_USER_INPUT',
        argumentName: 'content',
      },
    });
  }

  let messageId = TimeUuid.now(); // TODO: Replace it with snowflake
  let query = `INSERT INTO conversation_message(conversation_id, message_id, content, sender_id, attachment, created_at)
      VALUES (?, ?, ?, ?, ?, toTimeStamp(now()))`;
  let messageAttachment = attachment
    ? { id: attachment.id, url: attachment.url }
    : null;

  let createdAt = Date.now();
  await cassandraClient.execute(
    query,
    [
      conversationId,
      messageId,
      messageDetails.content,
      userId,
      messageAttachment,
    ],
    { prepare: true }
  );

  return {
    id: messageId,
    conversationId: conversationId,
    senderId: userId,
    content: messageDetails.content,
    attachment: messageAttachment,
    createdAt: createdAt,
  };
}

async function saveAttachment(file, conversationId, userId) {
  const { createReadStream, filename } = await file;
  if (!filename) return null;
  const fileExtension = path.extname(filename)?.toLowerCase();

  let name = v4() + fileExtension;
  const CONVERSATION_UPLOADS_DIR = path.join(
    __dirname,
    DEFAULT_UPLOADS_PATH,
    'conversations',
    conversationId.toString()
  );
  const attachmentUrl = path.join(CONVERSATION_UPLOADS_DIR, name);

  if (!fs.existsSync(CONVERSATION_UPLOADS_DIR))
    fs.mkdirSync(CONVERSATION_UPLOADS_DIR, { recursive: true });

  if (!isValidMessageAttachmentExtension(fileExtension)) {
    throw new GraphQLError('Unsupported media type', {
      path: 'sendMessage',
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

function isValidMessageAttachmentExtension(fileExtension) {
  return isValidVideo(fileExtension) || isValidImage(fileExtension);
}

function getAttachmentTypeFromExtension(fileExtension) {
  if (isValidImage(fileExtension)) return 'image';
  else if (isValidVideo(fileExtension)) return 'video';
  return 'other';
}

module.exports = { addMessage, findMessages };
