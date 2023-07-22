const { DataTypes } = require('sequelize');
const { sequelize } = require('../db/connect');
const { Conversation } = require('./conversation');
const { User } = require('./user');

const ConversationMember = sequelize.define(
  'ConversationMember',
  {
    id: { type: DataTypes.BIGINT, primaryKey: true, allowNull: false, autoIncrement: true },
    conversationId: {
      type: DataTypes.BIGINT,
      allowNull: false,
      references: { model: Conversation, key: 'id' },
    },
    userId: {
      type: DataTypes.BIGINT,
      allowNull: false,
      references: { model: User, key: 'id' },
    },
  },
  {
    tableName: 'conversation_member',
    underscored: true,
    createdAt: true,
    updatedAt: 'lastModifiedAt',
  }
);

Conversation.hasMany(ConversationMember, { foreignKey: 'conversationId' });
ConversationMember.belongsTo(Conversation, { foreignKey: 'conversationId' });

User.hasMany(ConversationMember, { foreignKey: 'userId' });
ConversationMember.belongsTo(User, { foreignKey: 'userId' });

module.exports = { ConversationMember };
