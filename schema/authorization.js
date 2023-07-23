const { rule, shield } = require('graphql-shield');

const isAuthenticated = rule()((parent, args, { user }) => {
  return user !== null;
});

const containsRole = (userRoles, requiredRoles) => {
  return requiredRoles.some((role) => userRoles.indexOf(role) >= 0);
};

const permissions = shield(
  {
    Query: {
      findPost: isAuthenticated,
      findComment: isAuthenticated,
      findFriends: isAuthenticated,
      fetchNewsfeed: isAuthenticated,
      findFriendRequests: isAuthenticated,
      findMessages: isAuthenticated,
      findAllBlockedUsers: isAuthenticated,
    },

    Mutation: {
      savePost: isAuthenticated,
      deletePost: isAuthenticated,
      saveComment: isAuthenticated,
      deleteComment: isAuthenticated,
      blockUser: isAuthenticated,
      unblockUser: isAuthenticated,
      unfriend: isAuthenticated,
      rejectFriendRequest: isAuthenticated,
      cancelFriendRequest: isAuthenticated,
      acceptFriendRequest: isAuthenticated,
      sendFriendRequest: isAuthenticated,
      savePostReaction: isAuthenticated,
      saveCommentReaction: isAuthenticated,
      savePostAttachment: isAuthenticated,
      saveCommentAttachment: isAuthenticated,
      createConversationWithMembers: isAuthenticated,
      sendMessage: isAuthenticated,
    },

    Subscription: {
      messageSent: isAuthenticated,
      messageReceived: isAuthenticated,
    },
  },
  { debug: true, allowExternalErrors: true }
);

module.exports = {
  permissions,
};
