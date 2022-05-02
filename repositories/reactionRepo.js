const {cassandraClient, mysqlQuery, mysqlConnection} = require("../db/connect");
const {Uuid} = require('cassandra-driver').types;

async function reactToPost(msg) {
    try {
        const query = 'INSERT INTO Post_Reactions(postId, reactionTypeId, reactionId, userId, creationDate) VALUES (?, ?, ?, ?, toTimeStamp(now()))';
        let reactionId = Uuid.random();
        await cassandraClient.execute(query, [msg.postId, msg.reactionTypeId, reactionId, msg.userId], {prepare: true});
    } catch (e) {
        console.error('CODE: ' + e.code);
        console.error(e);
    }
}

async function removeReactionFromPost(msg) {
    try {
        const query = 'DELETE FROM Post_Reactions WHERE postId = ? AND reactionId = ?';
        await cassandraClient.execute(query, [msg.postId, msg.reactionId], {prepare: true});
    } catch (e) {
        console.error('CODE: ' + e.code);
        console.error(e);
    }
}

async function reactToComment(msg) {
    try {
        const query = 'INSERT INTO Comment_Reactions(commentId, reactionTypeId, reactionId, userId, creationDate) VALUES (?, ?, ?, ?, toTimeStamp(now()))';
        let reactionId = Uuid.random();
        await cassandraClient.execute(query, [msg.commentId, msg.reactionTypeId, reactionId, msg.userId], {prepare: true});
    } catch (e) {
        console.error('CODE: ' + e.code);
        console.error(e);
    }
}

async function removeReactionFromComment(msg) {
    try {
        const query = 'DELETE FROM Comment_Reactions WHERE commentId = ? AND reactionId = ?';
        await cassandraClient.execute(query, [msg.commentId, msg.reactionId], {prepare: true});
    } catch (e) {
        console.error('CODE: ' + e.code);
        console.error(e);
    }
}

async function addReactionType(reactionTypeName){
    try {
        const query = 'INSERT INTO ReactionType(reactionTypeName) VALUES (?)';
        mysqlConnection.beginTransaction(err => {
            if (err) {
                console.log('err: ' + err)
                throw new Error('An error has occurred while starting the transaction');
            }
        });
        await mysqlQuery(query, [reactionTypeName]);
        mysqlConnection.commit();
    } catch (e){
        console.error('CODE: ' + e.code);
        console.error(e);
        mysqlConnection.rollback(function(){});
    }
}

module.exports = {
    reactToPost,
    removeReactionFromPost,
    reactToComment,
    removeReactionFromComment,
    addReactionType
}
