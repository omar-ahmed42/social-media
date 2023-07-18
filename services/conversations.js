const {cassandraClient} = require("../db/connect");

async function addConversation(conversation) {
    try {
        if (!conversation.members) {
            //TODO: Throw error
        }

        const query = "INSERT INTO Conversation_Members(conversationId, userIds) VALUES (?, ?)";
        await cassandraClient.execute(query, [conversation.conversationId, conversation.members], {prepare: true});
    } catch (e) {
        console.error('ERROR: ' + e);
        console.error('ERROR_CODE: ' + e.code);
    }
}

async function deleteConversation(conversationId) {
    try {
        const query = "DELETE FROM Conversation_Members WHERE conversationId = ?";
        await cassandraClient.execute(query, [conversationId], {prepare: true});
    } catch (e) {
        console.error('ERROR: ' + e);
        console.error('ERROR_CODE: ' + e.code);
    }
}


module.exports = {
    addConversation,
    deleteConversation
}
