const {and, or, rule, shield} = require("graphql-shield");

function checkPermission(user, permissions){
    if (!user && !containsRole(user.roles, permissions)){
        // TODO: Handle unauthorized user case
        console.error('Unauthorized');
        return;
    }
}

const isAuthenticated = rule()((parent, args, { user }) => {
    return user !== null;
})

const containsRole = (userRoles, requiredRoles) => {
    return requiredRoles.some( role => userRoles.indexOf(role) >= 0);
}

const isOwnUser = rule()((parent, { userId }, { user }) =>{
    return user && user == userId;
});

const isTheSameAuthenticatedUser = and(isAuthenticated, isOwnUser);


const permissions =  shield({
    Query: {
        getBlockedUsers: isTheSameAuthenticatedUser,
        getFriends: isTheSameAuthenticatedUser,
        getSliceOfFriends: isTheSameAuthenticatedUser,
        findAllSentFriendRequests: isTheSameAuthenticatedUser,
        findAllReceivedFriendRequests: isTheSameAuthenticatedUser,
        getPersonById: isAuthenticated,
        getPostById: isTheSameAuthenticatedUser,
        getCommentById: isTheSameAuthenticatedUser

    },

    Mutation: {
        addPost: isAuthenticated,
        deletePost: isAuthenticated,
        addComment: isAuthenticated,
        deleteComment: isAuthenticated,
        blockUser: isAuthenticated,
        unblockUser: isAuthenticated,
        deleteFriendship: isAuthenticated,
        declineFriendRequest: isTheSameAuthenticatedUser,
        cancelFriendRequest: isTheSameAuthenticatedUser,
        acceptFriendRequest: isTheSameAuthenticatedUser,
        sendFriendRequest: isTheSameAuthenticatedUser,
        reactToPost: isAuthenticated,
        removeReactionFromPost: isAuthenticated,
        reactToComment: isAuthenticated,
        removeReactionFromComment: isAuthenticated,
        addReactionType: isTheSameAuthenticatedUser
    }
});

module.exports = {
    permissions
}
