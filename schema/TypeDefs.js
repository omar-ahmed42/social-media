const { gql } = require('graphql-tag');

const typeDefs = gql`
  scalar Upload
  scalar Date

  type File {
    filename: String!
    mimetype: String!
    encoding: String!
  }

  type Person {
    id: ID
    firstName: String
    lastName: String
    email: String
    username: String
    dateOfBirth: Date
    createdAt: Date
    roles: [Role]
    posts: [Post]
  }

  type Role {
    id: ID
    name: String
  }

  type Post {
    id: ID
    content: String
    postAttachments: [PostAttachment]
    comments: [Comment]
    createdAt: String
    user: Person
  }

  type Comment {
    id: ID!
    content: String
    commentAttachments: [CommentAttachment]
    post: Post
    createdAt: String
    user: Person
  }

  type FriendRequest {
    id: ID
    sender: Person
    receiver: Person
  }

  type PostAttachment {
    id: ID
    url: String
    post: Post
  }

  type CommentAttachment {
    id: ID
    url: String
    comment: Comment
  }

  type Conversation {
    id: ID,
    name: String
    messages: [Message]
    users: Person
    createdAt: Date
  }

  type Message {
    id: ID
    content: String
    user: Person
    conversation: Conversation
    createdAt: Date
    attachment: MessageAttachment
  }

  type MessageAttachment {
    id: ID
    url: String
    message: Message
  }

  # Queries
  type Query {
    findPost(id: ID!): Post
    findComment(id: ID!): Comment
    findFriends(page: Int, pageSize: Int): [Person]
    fetchNewsfeed(id: ID): [Post]
    findFriendRequests(
      friendRequestStatus: String
      page: Int
      pageSize: Int
    ): [FriendRequest]
    findMessages(conversationId: ID!, messageId: ID): [Message]
  }

  # Mutations
  type Mutation {
    addPerson(
      firstName: String!
      lastName: String!
      email: String!
      password: String!
      dateOfBirth: String!
      roles: [String]!
    ): Person
    deletePerson(id: ID!): Boolean
    blockUser(userToBeBlockedId: ID!): Boolean
    unblockUser(userToBeBlockedId: ID!): Boolean
    reactToPost(postId: ID!, reactionTypeId: ID!): Boolean
    removeReactionFromPost(postId: ID!, reactionId: ID!): Boolean
    reactToComment(commentId: ID!, reactionTypeId: ID!): Boolean
    removeReactionFromComment(reactionId: ID!): Boolean
    addReactionType(reactionTypeName: String!): Boolean!

    savePost(id: ID, content: String, postStatus: String): Post
    deletePost(id: ID!): Int

    saveComment(
      id: ID
      postId: ID
      content: String
      commentStatus: String
    ): Comment
    deleteComment(id: ID!): Int

    sendFriendRequest(receiverId: ID!): FriendRequest
    cancelFriendRequest(id: ID!): Int
    acceptFriendRequest(id: ID!): Int
    rejectFriendRequest(id: ID!): Int
    unfriend(friendId: ID): Boolean

    savePostReaction(reactionId: ID!, postId: ID!): Int
    saveCommentReaction(reactionId: ID!, commentId: ID!): Int

    savePostAttachment(attachment: Upload!, postId: ID): PostAttachment
    saveCommentAttachment(attachment: Upload!, commentId: ID): CommentAttachment

    createConversationWithMembers(name: String, isGroup: Boolean!, membersIds: [ID]!): Conversation
    sendMessage(conversationId: ID, content: String, attachment: Upload): Message
  }

  type Subscription {
    messageSent(conversationId: ID!): Message
    messageReceived: Message
  }
`;

module.exports = {
  typeDefs,
};
