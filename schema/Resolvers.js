const { GraphQLUpload } = require('graphql-upload');
const {
  findPostByCommentId,
  savePost,
  deletePost,
  findPost,
  findPostsByUserId,
} = require('../repositories/postRepo');
const {
  findUserByPostId,
  findUserByCommentId,
  addPerson,
  deletePersonById,
  findPersonById,
} = require('../repositories/personRepo');
const {
  deleteComment,
  findCommentById,
  saveComment,
  findCommentsByPostId,
  findCommentByCommentAttachmentId,
} = require('../repositories/commentRepo');
const {
  blockUser,
  unblockUser,
} = require('../repositories/blockRepo');
const {
  findFriends,
  deleteFriendship,
} = require('../repositories/friendRepo');
const {
  findFriendRequests,
  sendFriendRequest,
  cancelFriendRequest,
  rejectFriendRequest,
  acceptFriendRequest,
} = require('../repositories/friendRequestRepo');
const {
  reactToPost,
  reactToComment,
  removeReactionFromComment,
  removeReactionFromPost,
  addReactionType,
} = require('../repositories/reactionRepo');
const { GraphQLScalarType, Kind } = require('graphql');
const { fetchNewsfeed } = require('../repositories/fanout');
const { savePostReaction } = require('../repositories/post-reaction');
const { saveCommentReaction } = require('../repositories/comment-reaction');
const {
  savePostAttachment,
  findPostAttachmentsByPostId,
  transformPostAttachmentsModelToGraphQLPostAttachment,
} = require('../repositories/post-attachment');
const { transformCommentAttachmentsModelToGraphQLCommentAttachment, findCommentAttachmentsByCommentId, saveCommentAttachment } = require('../repositories/comment-attachment');

const dateScalar = new GraphQLScalarType({
  name: 'Date',
  description: 'Date custom scalar type YYYY-MM-DD',
  parseValue(value) {
    return new Date(value); // value from the client
  },
  serialize(value) {
    const offset = value.getTimezoneOffset();
    value = new Date(value.getTime() - offset * 60 * 1000);
    return value.toISOString().split('T')[0]; // value sent to the client
  },
  parseLiteral(ast) {
    if (ast.kind === Kind.INT) {
      return parseInt(ast.value, 10); // ast value is always in string format
    }
    return null;
  },
});

const resolvers = {
  Upload: GraphQLUpload,

  Query: {
    async findPost(parent, args, { user }) {
      return await findPost(user, args.id);
    },

    async findComment(parent, args, { user }) {
      return await findCommentById(args.id, user);
    },

    async findFriendRequests(parent, args, { user }) {
      return await findFriendRequests(
        user,
        args.friendRequestStatus,
        args.page,
        args.pageSize
      );
    },

    async findFriends(parent, args, { user }) {
      return await findFriends(user);
    },

    async fetchNewsfeed(parent, args, { user }) {
      return await fetchNewsfeed(user, args.page, args.pageSize);
    },
  },

  Date: dateScalar,

  Person: {
    async posts(parent) {
      return await findPostsByUserId(parent.id);
    },
  },
  Post: {
    async comments(parent) {
      return await findCommentsByPostId(parent.id);
    },
    async user(parent) {
      return await findUserByPostId(parent.id);
    },
    async postAttachments(parent, args, { user }) {
      return parent.PostAttachments?.length > 0
        ? transformPostAttachmentsModelToGraphQLPostAttachment(
            parent.PostAttachments,
            parent.id
          )
        : await findPostAttachmentsByPostId(parent.id);
    },
  },
  Comment: {
    async post(parent) {
      return await findPostByCommentId(parent.id);
    },
    async user(parent) {
      return await findUserByCommentId(parent.id);
    },
    async commentAttachments(parent) {
      return parent.CommentAttachments?.length > 0
        ? transformCommentAttachmentsModelToGraphQLCommentAttachment(
            parent.CommentAttachments,
            parent.id
          )
        : await findCommentAttachmentsByCommentId(parent.id);
    },
  },
  FriendRequest: {
    async sender(parent) {
      return await findPersonById(parent.senderId);
    },
    async receiver(parent) {
      return await findPersonById(parent.receiverId);
    },
  },
  PostAttachment: {
    async post(parent, args, { user }) {
      return parent.postId
        ? await findPost(user, parent.postId)
        : await findPostByPostAttachmentId(parent.id);
    },
  },

  CommentAttachment: {
    async comment(parent, { user }) {
      return parent.commentId
        ? await findCommentById(parent.commentId, user)
        : await findCommentByCommentAttachmentId(parent.id);
    },
  },

  Mutation: {
    async addPerson(parent, args) {
      return await addPerson(args);
    },

    async deletePerson(parent, args) {
      return await deletePersonById(args.id);
    },

    async blockUser(parent, args, { user }) {
      await blockUser(user, args.userToBeBlockedId);
      return true;
    },

    async unblockUser(parent, args, { user }) {
      await unblockUser(user, args.userToBeBlockedId);
      return true;
    },

    async reactToPost(parent, args, { user }) {
      await reactToPost(user, args);
      return true;
    },

    async removeReactionFromPost(parent, args, { user }) {
      return await removeReactionFromPost(user, args);
    },

    async reactToComment(parent, args, { user }) {
      return await reactToComment(user, args);
    },

    async removeReactionFromComment(parent, args, { user }) {
      return await removeReactionFromComment(args);
    },

    async addReactionType(parent, args, { user }) {
      return await addReactionType(args.reactionTypeName);
    },

    async savePost(parent, args, { user }) {
      return await savePost(user, args.id, args);
    },

    async deletePost(parent, args, { user }) {
      return await deletePost(user, args.id);
    },

    async saveComment(parent, args, { user }) {
      return await saveComment(user, args.id, args.postId, args);
    },

    async deleteComment(parent, args, { user }) {
      return await deleteComment(user, args.id);
    },

    async sendFriendRequest(parent, args, { user }) {
      return await sendFriendRequest(user, args.receiverId);
    },

    async cancelFriendRequest(parent, args, { user }) {
      return await cancelFriendRequest(args.id, user);
    },

    async acceptFriendRequest(parent, args, { user }) {
      return await acceptFriendRequest(args.id, user);
    },

    async rejectFriendRequest(parent, args, { user }) {
      return await rejectFriendRequest(args.id, user);
    },

    async unfriend(parent, args, { user }) {
      return await deleteFriendship(user, args.friendId);
    },

    async savePostReaction(parent, args, { user }) {
      return await savePostReaction(user, args.reactionId, args.postId);
    },

    async saveCommentReaction(parent, args, { user }) {
      return await saveCommentReaction(user, args.reactionId, args.commentId);
    },

    async savePostAttachment(parent, { attachment, postId }, { user }) {
      return await savePostAttachment(attachment, user, postId);
    },
    
    async saveCommentAttachment(parent, { attachment, commentId }, { user }) {
      return await saveCommentAttachment(attachment, user, commentId);
    },
  },
};

module.exports = {
  resolvers,
};
