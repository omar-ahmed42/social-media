const {cassandraClient, driverSession} = require("../db/connect");
const fs = require("fs");
const path = require("path");
const {finished} = require("stream/promises");
const {parseFileExtension} = require("../utils/parsers/file");
const {isValidMedia} = require("../utils/validators/media");
const {v4: uuidv4} = require("uuid");

async function addComment(userId, msg) {
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

        if (!urls && msg.content.length === 0) {
            // TODO: Throw Error
            throw new Error('Empty comment')
        }

        await driverSession.run(
            `
            MATCH (person:PERSON) WHERE ID(person) = $userId
            MATCH (post:POST) WHERE ID(post) = $postId
            CREATE (person) -[writes_comment:WRITES_COMMENT]-> (comment:COMMENT {content: $content, media: $media, creationDate: timestamp()})
            CREATE (comment) -[comments_on:COMMENTS_ON]-> (post)`,
            {userId: userId, content: msg.content, media: urls, postId: msg.postId}
        )
        return true;
    } catch (e) {
        console.error('ERROR: ' + e);
        console.error('ERROR_CODE: ' + e.code);
        return false;
    }
}

async function deleteComment(userId, commentId) {
    try {
        await driverSession.run(
            `
            MATCH (person: PERSON) WHERE ID(person) = $userId
            MATCH (person) -[writes_comment:WRITES_COMMENT]-> (comment:COMMENT) WHERE ID(comment) = $commentId
            MATCH (comment) -[comments_on:COMMENTS_ON]-> (post:POST)
            DETACH DELETE writes_comment
            DETACH DELETE (comment)
            DETACH DELETE comments_on
            `, {userId: userId, commentId: commentId}
        )
        return true;
    } catch (e) {
        console.error('ERROR: ' + e);
        console.error('ERROR_CODE: ' + e.code);
        return false;
    }
}

async function findCommentById(commentId) {
    try {
        let res = await driverSession.run(`
        MATCH (comment:COMMENT) WHERE ID(comment) = $commentId
        RETURN (comment)
    `, {commentId: commentId});
        return res.records.map(record => record._fields[0].properties);
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
