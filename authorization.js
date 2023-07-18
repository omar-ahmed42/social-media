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
    },

    Mutation: {
      savePost: isAuthenticated,
      deletePost: isAuthenticated,
      saveComment: isAuthenticated,
      blockUser: isAuthenticated,
      unblockUser: isAuthenticated,
      unfriend: isAuthenticated,
      rejectFriendRequest: isAuthenticated,
      cancelFriendRequest: isAuthenticated,
      acceptFriendRequest: isAuthenticated,
      sendFriendRequest: isAuthenticated,
      reactToPost: isAuthenticated,
      removeReactionFromPost: isAuthenticated,
      reactToComment: isAuthenticated,
      removeReactionFromComment: isAuthenticated,
      addReactionType: isAuthenticated,
    },
  },
  { debug: true, allowExternalErrors: true }
);

module.exports = {
  permissions,
};
