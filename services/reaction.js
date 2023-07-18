const {mysqlQuery, mysqlConnection, driverSession} = require("../db/connect");

async function reactToPost(userId, msg) {
    try {
        await driverSession.run(
            `
            MATCH (person:PERSON) WHERE ID(person) = $userId
            CREATE (person) -[reacts_to:REACTS_TO {reactionType: $reactionType, creationDate: timestamp()}]-> (post:POST) WHERE ID(post) = $postId
            `, {userId: userId, reactionType: msg.reactionTypeId, postId: msg.postId}
        )
    } catch (e) {
        console.error('CODE: ' + e.code);
        console.error(e);
    }
}


async function removeReactionFromPost(userId, msg) {
    try {
        await driverSession.run(`
        MATCH (person:PERSON) WHERE ID(person) = $userId
        MATCH (person) -[reacts_to:REACTS_TO]-> (post:POST) WHERE ID(post) = $postId AND ID(reacts_to) = $reactionId
        DETACH DELETE reacts_to`, {userId: userId, postId: msg.postId, reactionId: msg.reactionId})
        return true;
    } catch (e) {
        console.error('CODE: ' + e.code);
        console.error(e);
        return false;
    }
}

async function reactToComment(userId, msg) {
    try {
        await driverSession.run(
            `
            MATCH (person:PERSON) WHERE ID(person) = $userId
            CREATE (person) -[reacts_to:REACTS_TO {reactionType: $reactionType}]->(comment:COMMENT) WHERE ID(comment) = $commentId`
            , {userId: userId, reactionType: msg.reactionTypeId, commentId: msg.commentId}
        );
        return true;

    } catch (e) {
        console.error('CODE: ' + e.code);
        console.error(e);
        return false;
    }
}

async function removeReactionFromComment(userId, msg) {
    try {
        await driverSession.run(
            `
            MATCH (person:PERSON) WHERE ID(person) = $userId
            MATCH (person) -[reacts_to:REACTS_TO]-> (comment:COMMENT) WHERE ID(comment) = $commentId AND ID(reacts_to) = $reactionId
            DETACH DELETE reacts_to`
            , {userId: userId, commentId: msg.commentId, reactionId: msg.reactionId}
        )

        return true;
    } catch (e) {
        console.error('CODE: ' + e.code);
        console.error(e);
        return false;
    }
}

async function addReactionType(reactionTypeName) {
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
        return true;
    } catch (e) {
        console.error('CODE: ' + e.code);
        console.error(e);
        mysqlConnection.rollback(function () {
        });
        return false;
    }
}

module.exports = {
    reactToPost,
    removeReactionFromPost,
    reactToComment,
    removeReactionFromComment,
    addReactionType
}
