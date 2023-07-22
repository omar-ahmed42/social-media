const { Sequelize, Op } = require('sequelize');
const { sequelize } = require('../db/connect');
const { Conversation } = require('../models/conversation');
const { User } = require('../models/user');
const { ConversationMember } = require('../models/conversation-members');
const { isBlank } = require('../utils/string-utils');

async function addConversationWithMembers(
  userId,
  conversationDetails,
  membersIds
) {
  try {
    let uniqueMembersIds = new Set(membersIds).add(userId.toString());
    uniqueMembersIds = Array.from(uniqueMembersIds);
    if (!conversationDetails) return null; // TODO: Throw an exception
    return conversationDetails.isGroup
      ? await createGroupConversation(conversationDetails, uniqueMembersIds)
      : await createConversation(conversationDetails, uniqueMembersIds);
  } catch (error) {
    console.error(`Error: `, error);
  }
}

async function createGroupConversation(conversationDetails, membersIds) {
  if (membersIds?.length <= 1) return null; // TODO: Throw an exception

  if (isBlank(conversationDetails.name))
    conversationDetails.name = await generateGroupName(membersIds);
  return await storeConversationWithMembers(conversationDetails, membersIds);
}

async function generateGroupName(membersIds) {
  let users = await User.findAll({
    attributes: ['firstName'],
    where: { id: { [Op.in]: membersIds.slice(0, 3) } },
  });

  if (users?.length <= 0) return null; // TODO: Throw an exception
  let groupName = users
    .map((user) => user.getDataValue('firstName'))
    .join(', ')
    .concat(membersIds.length - 3 > 0 ? ', Others' : '');
  return groupName;
}

async function createConversation(conversationDetails, membersIds) {
  if (membersIds?.length <= 1) return null; // TODO: Throw an exception
  let retrievedConversation = await sequelize.query(
    `SELECT * FROM conversation conv
     WHERE conv.is_group = false AND EXISTS (
         SELECT 1 FROM conversation_member conv_m WHERE conv.id = conv_m.conversation_id AND conv_m.user_id = :member1_id ) 
         AND EXISTS (
            SELECT 1 FROM conversation_member conv_m WHERE conv.id = conv_m.conversation_id AND conv_m.user_id = :member2_id )`,
    {
      type: Sequelize.QueryTypes.SELECT,
      model: Conversation,
      mapToModel: true,
      replacements: { member1_id: membersIds[0], member2_id: membersIds[0] },
    }
  );

  if (retrievedConversation?.length == 1) return retrievedConversation[0].get({plain: true}); // TODO: Throw an exception

  return await storeConversationWithMembers(conversationDetails, membersIds);
}

async function storeConversationWithMembers(conversationDetails, membersIds) {
  let members = [];
  for (let memberId of membersIds) {
    members.push({ userId: memberId });
  }

  return await sequelize.transaction(
    async (t) =>
      await Conversation.create(
        {
          name: conversationDetails.name,
          isGroup: conversationDetails.isGroup,
          ConversationMembers: members,
        },
        { include: [ConversationMember], transaction: t }
      )
  );
}

async function findConversationAndMembers(conversationId) {
  return Conversation.findByPk(conversationId, {
    include: { model: ConversationMember },
  }).then((data) => data.get({ plain: true }));
}

async function isMember(conversationId, userId) {
  let member = await ConversationMember.findOne({
    where: { conversationId: conversationId, userId: userId },
  });
  return member != null;
}

module.exports = {
  addConversationWithMembers,
  findConversationAndMembers,
  isMember,
};
