const { User } = require('../models/user');
const { Role, UserRole } = require('../models/role');
const { FriendRequest } = require('../models/friend-request');
const { Post } = require('../models/post');
const { PostAttachment } = require('../models/post-attachment');
const { Attachment } = require('../models/attachment');
const { Comment } = require('../models/comment');
const { PostReaction } = require('../models/post-reaction');
const { CommentReaction } = require('../models/comment-reaction');
const { Reaction } = require('../models/reaction');
const { CommentAttachment } = require('../models/comment-attachment');
const { Conversation } = require('../models/conversation');
const { ConversationMember } = require('../models/conversation-members');


async function syncModels() {
  await User.sync();
  await Role.sync();
  await UserRole.sync();
  await FriendRequest.sync();
  await Post.sync();
  await Comment.sync();
  await Reaction.sync();
  await PostReaction.sync();
  await CommentReaction.sync();
  await Attachment.sync();
  await PostAttachment.sync();
  await CommentAttachment.sync();
  await Conversation.sync();
  await ConversationMember.sync();
}
exports.syncModels = syncModels;
