const {cassandraClient} = require("../db/connect");
const fs = require("fs");
const path = require("path");
const {finished} = require("stream/promises");
const {parseFileExtension} = require("../utils/parsers/file");
const {isValidMedia} = require("../utils/validators/media");
const {v4: uuidv4} = require("uuid");
const {Uuid} = require('cassandra-driver').types;

async function addComment(msg) {
    try {
        let urls = await Promise.all((msg.media).map(async (file) => {
            const {createReadStream, filename, mimetype, encoding} = await file;

            const fileExtension = parseFileExtension(filename);
            if (!isValidMedia(fileExtension)) {
                // TODO: Throw error
                throw new Error('Invalid media type');
            }

            const newFilename = uuidv4() + '_' + Date.now() + fileExtension; // Generation a unique filename

            const stream = createReadStream();
            const out = fs.createWriteStream(path.join(__dirname, `/../FileUpload/Comments/${newFilename}`));
            stream.pipe(out);
            await finished(out);
            return `http://localhost:3000/FileUpload/Comments/${newFilename}`
        }));

        if (!urls || msg.content.length === 0){
            // TODO: Throw Error
            throw new Error('Empty comment')
        }

        const query = 'INSERT INTO Comments(postId, commentId, userId, content, media, creationDate) VALUES (?, ?, ?, ?, ?, toTimeStamp(now()))';
        let commentId = Uuid.random();
        await cassandraClient.execute(query, [msg.postId, commentId, msg.userId, msg.content, urls], {prepare: true});
        return true;
    } catch (e) {
        console.error('ERROR: ' + e);
        console.error('ERROR_CODE: ' + e.code);
        return false;
    }
}

async function deleteComment(commentId) {
    try {
        const query = 'DELETE FROM Comments WHERE commentId = ?';
        await cassandraClient.execute(query, [commentId], {prepare: true});
        return true;
    } catch (e) {
        console.error('ERROR: ' + e);
        console.error('ERROR_CODE: ' + e.code);
        return false;
    }
}

async function findCommentById(commentId) {
    const query = 'SELECT * FROM Comments WHERE commentId = ?';
    try {
        let res = await cassandraClient.execute(query, [commentId], {prepare: true, isIdempotent: true});
        return res.rows[0];
    } catch (e) {
        console.error('ERROR: ' + e);
        console.error('ERROR_CODE: ' + e.code);
    }
}

module.exports = {
    addComment,
    deleteComment,
    findCommentById
}
