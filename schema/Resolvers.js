const {GraphQLUpload} = require('graphql-upload');
require("fs");
require("path");
const {
    getSliceOfPostComments, findPostByCommentId, getSliceOfUserPosts, addPost, deletePostById, findPostById,
    fetchNewsfeed
} = require("../repositories/postRepo");
const {
    findUserByPostId,
    findUserByCommentId,
    addPerson,
    deletePersonById,
    findPersonById
} = require("../repositories/personRepo");
const {addComment, deleteComment, findCommentById} = require("../repositories/commentRepo");
const {blockUser, unblockUser, findAllBlockedUsers} = require("../repositories/blockRepo");
const {findFriends, findSliceOfFriends, deleteFriendship} = require("../repositories/friendRepo");
const {deleteFriendRequest, acceptFriendRequest, declineFriendRequest} = require("../repositories/friendRequestRepo");
const {
    reactToPost,
    reactToComment,
    removeReactionFromComment,
    removeReactionFromPost,
    addReactionType
} = require("../repositories/reactionRepo");
const {GraphQLScalarType, Kind} = require("graphql");

const dateScalar = new GraphQLScalarType({
    name: 'Date',
    description: 'Date custom scalar type YYYY-MM-DD',
    parseValue(value) {
        return new Date(value); // value from the client
    },
    serialize(value) {
        const offset = value.getTimezoneOffset()
        value = new Date(value.getTime() - (offset * 60 * 1000))
        return value.toISOString().split('T')[0] // value sent to the client
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
        getBlockedUsers(parent, args) {
            return findAllBlockedUsers(args.userId);
        },

        async getFriends(parent, args) {
            return findFriends(args.userId)
        },

        async getSliceOfFriends(parent, args) {
            return findSliceOfFriends(args.userId, args.offset, args.size);
        },

        async getPersonById(parent, args) {
            return findPersonById(args.userId);
        },

        async getPostById(parent, args) {
            return await findPostById(args.id);
        },

        async getCommentById(parent, args) {
            return findCommentById(args.id);
        },

        async getAllBlockedUsers(parent, args) {
            return findAllBlockedUsers(args.id);
        },

        async getNewsFeed(parent, args, {user}) {
            return fetchNewsfeed(user, args.size, args.lastSeenPostId)
        }

    },

    Date: dateScalar,

    Person: {
        async posts(parent) {
            return getSliceOfUserPosts(parent.id);
        }
    },
    Post: {
        comments(parent) {
            return getSliceOfPostComments(parent.id, 15);
        },
        poster(parent) {
            return findUserByPostId(parent.id);
        }
    },
    Comment: {
        post(parent) {
            return findPostByCommentId(parent.id);
        },
        commenter(parent) {
            return findUserByCommentId(parent.id);
        }
    },

    Mutation: {
        async addPerson(parent, args) {
            await addPerson(args);
            return true;
        },

        async deletePerson(parent, args) {
            return await deletePersonById(args.id);
        },

        addPost: async function (parent, args, {user}) {
            return await addPost(user, args);
        },

        async deletePost(parent, args, {user}) {
            await deletePostById(user, args.postId);
            return true;
        },

        addComment: async function (parent, args, {user}) {
            return await addComment(user, args);
        },

        deleteComment: async function (parent, args, {user}) {
            return await deleteComment(user, args.id);
        },

        async blockUser(parent, args, {user}) {
            await blockUser(user, args.userToBeBlockedId);
            return true;
        },

        async unblockUser(parent, args, {user}) {
            await unblockUser(user, args.userToBeBlockedId);
            return true;
        },

        async deleteFriendship(parent, args, {user}) {
            await deleteFriendship(user, args.friendId);
            return true;
        },

        async declineFriendRequest(parent, args, {user}) {
            await declineFriendRequest(args.senderId, user);
            return true;
        },

        async cancelFriendRequest(parent, args, {user}) {
            await deleteFriendRequest(user, args.receiverId);
            return true;
        },

        async acceptFriendRequest(parent, args, {user}) {
            await acceptFriendRequest(args.senderId, user);
            return true;
        },

        async reactToPost(parent, args, {user}) {
            await reactToPost(user, args);
            return true;
        },

        async removeReactionFromPost(parent, args, {user}) {
            return await removeReactionFromPost(user, args);
        },

        async reactToComment(parent, args, {user}) {
            return await reactToComment(user, args);
        },

        async removeReactionFromComment(parent, args, {user}) {
            return await removeReactionFromComment(args);
        },

        async addReactionType(parent, args, {user}) {
            return await addReactionType(args.reactionTypeName);
        }
    }
}

module.exports = {
    resolvers
}
