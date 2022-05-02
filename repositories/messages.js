// Message{ senderId, Content{ media[], text} }
const {cassandraClient} = require("../db/connect");
const {TimeUuid} = require('cassandra-driver').types

async function addMessage(conversationId, message) {

    try {
        if (!message.media && !message.message) {
            //TODO: Throw error
        }
        // TODO: Implement media handling/processing for messages

        // if (message.media){
        //     save into database (media)
        //     TODO: to be implemented
        // }

        console.log("msg.txt: " + message.message);
        if (message.message) {
            // save into database (text)
            const query = "INSERT INTO Conversation_Messages(conversationId, messageId, senderId, msg, creationDate) VALUES (?, ?, ?, ?, toTimeStamp(now()))";
            let messageId = TimeUuid.now();
            await cassandraClient.execute(query, [conversationId, messageId, message.senderId, message.message], {prepare: true});
        }
    } catch (e) {
        console.error('ERROR: ' + e);
        console.error('ERROR_CODE: ' + e.code);
    }
}

async function getSliceOfMessages(conversationId, size, lastSeenMessageId) {
    const query = 'SELECT * Conversation_Messages WHERE conversationId = ? AND messageId = ?';
    try {
        let res = await cassandraClient.execute(query, [conversationId, lastSeenMessageId],
            {prepare: true, autoPage: true, fetchSize: size});
        return res.rows;
    } catch (e) {
        console.error('ERROR: ' + e);
        console.error('ERROR_CODE: ' + e.code);
    }
}

async function getMessage(messageId) {
    try {
        const query = 'SELECT * FROM Conversation_Messages WHERE msgId = ?';
        let msg = await cassandraClient.execute(query, [messageId], {prepare: true, isIdempotent: true});
        console.log(msg);
        return msg;
    } catch (e) {
        console.error('ERROR: ' + e);
        console.error('ERROR_CODE: ' + e.code);
    }
}

async function saveMedia(media){

}

async function deleteMessage(messageId) {
    const query = "DELETE FROM Conversation_Messages WHERE msgId = ?";
    try {
        await cassandraClient.execute(query, [messageId], {prepare: true});
    } catch (e) {
        console.error('ERROR: ' + e);
        console.error('ERROR_CODE: ' + e.code);
    }
}

module.exports = {
    addMessage,
    getMessage,
    deleteMessage
}
