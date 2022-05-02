const {cassandraClient} = require("../db/connect");
const {v4: uuidv4} = require('uuid');
const fs = require("fs");
const path = require("path");
const {finished} = require("stream/promises");
const {isValidMedia} = require("../utils/validators/media");
const {parseFileExtension} = require("../utils/parsers/file");
const {Uuid} = require('cassandra-driver').types;
var cache = require('../cache/memoryCache')();

async function findPostById(postId) {
    const query = 'SELECT CAST(postid AS text) AS id, content, media, userId, creationdate FROM Posts WHERE postId = ?';
    try {
        let res = await cassandraClient.execute(query, [postId], {prepare: true, isIdempotent: true});
        return res.rows[0];

    } catch (e) {
        console.error('ERROR: ' + e);
        console.error('ERROR_CODE: ' + e.code);
    }
}

async function deletePostById(userId, postId){
    const query = 'DELETE FROM Posts WHERE userId = ? AND postId = ?';
    try{
        await cassandraClient.execute(query, [userId, postId], {prepare: true});
    }
    catch(e)
    {
        console.error('ERROR: ' + e);
        console.error('ERROR_CODE: ' + e.code);
    }
}

async function addPost(userId, msg){
    let urls = await Promise.all((msg.media).map(async (file) => {
            const {createReadStream, filename, mimetype, encoding} = await file;

            const fileExtension = parseFileExtension(filename);
            if (!isValidMedia(fileExtension)) {
                // TODO: Throw error
                throw new Error('Invalid media type');
            }

            const newFilename = uuidv4() + '_' + Date.now() + fileExtension; // Generation a unique filename

            const stream = createReadStream();
            const out = fs.createWriteStream(path.join(__dirname, `/../FileUpload/Posts/${newFilename}`));
            stream.pipe(out);
            await finished(out);
            return `http://localhost:3000/FileUpload/Posts/${newFilename}`
        }));

    if (!urls && msg.content.trim().length == 0){
        // TODO: Throw Error
        throw new Error('Empty Post')
    }

    const query = 'INSERT INTO Posts(postId, userId, content, media, creationDate) VALUES(?, ?, ?, ?, toTimeStamp(now()))';
    let postId = Uuid.random();
    try {
        await cassandraClient.execute(query, [postId, userId, msg.content, urls], {prepare: true});
        return true;
    }catch(e){
        console.error('ERROR: ' + e);
        console.error('ERROR_CODE: ' + e.code);
        return false;
    }
}

async function getSliceOfUserPosts(userId){

    try {
        const query = 'SELECT CAST(postid AS text) AS id, content, media, userId, creationdate FROM Posts WHERE userId= ?';
        const userPostsPageState = cache.get('userPostsPageState');
        console.log('USER_POSTS_PAGE_STATE: ' + userPostsPageState);
        const options = userPostsPageState == undefined
            ?
            {prepare: true, autoPage: true, fetchSize: 6}
            :
            {prepare: true, autoPage: true, fetchSize: 6, pageState: userPostsPageState}

        let res = await cassandraClient.execute(query, [userId], options);

        cache.set('userPostsPageState', res.pageState);
        console.log(res.rows)
        return res.rows;
    }catch (e){
        console.error('ERROR: ' + e);
        console.error('ERROR_CODE: ' + e.code);
    }
}

async function getSliceOfPostComments(postId, size) {
    try {
        const query = 'SELECT * FROM Comments WHERE postId = ?';
        let comments = await cassandraClient.execute(query, [postId],
            {prepare: true, autoPage: true, fetchSize: size, pageState: true},
            (err, res) => {
                if (err) {
                    //TODO: Handle error
                    console.error(err)
                    // throw new Error('error');
                }
                //TODO: Handle success
                console.log("SUCCESS: " + res);
                return res;
            });
        console.log(comments);
        return comments;
    } catch (e) {
        console.error('ERROR: ' + e);
        console.error('ERROR_CODE: ' + e.code);
    }
}

async function findPostByCommentId(commentId) {
    const query = 'SELECT postId FROM COMMENTS WHERE commentId = ?';
    try {
        let res = await cassandraClient.execute(query, [commentId], {prepare: true, isIdempotent: true});
        const postId = res.rows[0].postid;

        const postQuery = 'SELECT postId, content, creationDate, userId FROM POSTS WHERE postId = ?';
        res = await cassandraClient.execute(postQuery, [postId], {prepare: true, isIdempotent: true});
        return res.rows[0];

    } catch (e) {
        console.error('ERROR: ' + e);
        console.error('ERROR_CODE: ' + e.code);
        //TODO: Handle Error
    }
}


module.exports = {
    addPost,
    findPostById,
    deletePostById,
    getSliceOfPostComments,
    findPostByCommentId,
    getSliceOfUserPosts
}
