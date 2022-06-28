// Message{ senderId, Content{ media[], text} }
const {cassandraClient} = require("../db/connect");
const {parseFileExtension} = require("../utils/parsers/file");
const {isValidMedia} = require("../utils/validators/media");
const {v4: uuidv4} = require("uuid");
const fs = require("fs");
const path = require("path");
const {finished} = require("stream/promises");
const {TimeUuid} = require('cassandra-driver').types

async function addMessage(conversationId, message) {
    try {
        if (message.media){
            console.log("media exists: " + JSON.stringify(message.media))
        }
        let urls = await Promise.all((message.media).map(async (file) => {
            const {createReadStream, filename, mimetype, encoding} = await file;

            const fileExtension = parseFileExtension(filename);
            if (!isValidMedia(fileExtension)) {
                // TODO: Throw error
                throw new Error('Invalid media type');
            }

            const newFilename = uuidv4() + '_' + Date.now() + fileExtension; // generates a unique filename

            const stream = createReadStream();
            const out = fs.createWriteStream(path.join(__dirname, `/../FileUpload/Conversations/${conversationId}/${newFilename}`));
            stream.pipe(out);
            await finished(out);
            return `http://localhost:3000/FileUpload/Conversations/${conversationId}/${newFilename}`
        }));

        if (!urls && message.message.trim().length === 0) {
            throw new Error('Empty Post')
        }

        console.log("msg.txt: " + message.message);
        const query = "INSERT INTO Conversation_Messages(conversationId, messageId, senderId, msg, content, creationDate) VALUES (?, ?, ?, ?, ?, toTimeStamp(now()))";
        let messageId = TimeUuid.now();
        await cassandraClient.execute(query, [conversationId, messageId, message.senderId, message.message, urls], {prepare: true});
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
