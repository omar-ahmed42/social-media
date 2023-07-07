const {gql} = require('graphql-tag');

const typeDefs = gql`
    scalar Upload
    scalar Date

    type File {
        filename: String!
        mimetype: String!
        encoding: String!
    }
    
    type Person {
        id: ID!,
        firstName: String,
        middleName: String,
        lastName: String,
        email: String,
        username: String,
        password: String,
        dateOfBirth: Date,
        role: ID,
        posts: [Post]
    }
    
    type Post {
        id: ID!,
        content: String,
        media: [String]
        comments: [Comment],
        creationdate: String,
        poster: Person
    }
    
    type Comment {
        id: ID!,
        content: String,
        media: [File],
        post: Post,
        creationDate: String,
        commenter: Person
    }

    # Queries
    type Query {
        getBlockedUsers(userId: ID!): [Person]!
        getFriends(userId: ID!): [Person]!
        getSliceOfFriends(userId: ID!, offset: Int!, size: Int!): [Person]!
        findAllSentFriendRequests(userId: ID!): [Person]!
        findAllReceivedFriendRequests(userId: ID!): [Person]!
        getPersonById(userId: ID!): Person!
        getPostById(id: ID!): Post
        getCommentById(commentId: ID!): Comment
        getAllBlockedUsers: [Person]
        getNewsFeed(lastSeenPostId: Int, size: Int):[Post]
        
    }
    
    # Mutations
    type Mutation {
        addPerson(firstName: String!, lastName: String!, email: String!, password: String!, dateOfBirth: String!, role: [String]!): Boolean!
        deletePerson(id: ID!): Boolean
        addPost(content: String, media: [Upload]): Boolean
        deletePost(postId: ID!): Boolean
        addComment(postId: ID!, content: String, media: [Upload]): Boolean
        deleteComment(id: ID!): Boolean
        blockUser(userToBeBlockedId: ID!): Boolean
        unblockUser(userToBeBlockedId: ID!): Boolean
        deleteFriendship(friendId: ID!): Boolean
        declineFriendRequest(senderId: ID!): Boolean
        cancelFriendRequest(receiverId: ID!): Boolean
        acceptFriendRequest(senderId: ID!): Boolean
        sendFriendRequest(senderId: ID!, receiverId: ID!): Boolean
        reactToPost(postId: ID!, reactionTypeId: ID!): Boolean
        removeReactionFromPost(postId: ID!, reactionId: ID!): Boolean
        reactToComment(commentId: ID!, reactionTypeId: ID!): Boolean
        removeReactionFromComment(reactionId: ID!): Boolean
        addReactionType(reactionTypeName: String!): Boolean!
    }
`;

module.exports = {
    typeDefs
}
