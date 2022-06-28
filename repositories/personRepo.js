const {mysqlConnection, driverSession} = require('../db/connect.js');
const {cassandraClient, mysqlQuery} = require("../db/connect");
const bcrypt = require("bcrypt");

async function addPerson(msg){
    try {
        const personQuery = `INSERT INTO PERSON(firstName, lastName, email, password, dateOfBirth) VALUES (?, ?, ?, ?, ?)`;
        const personRoleQuery = `INSERT INTO PERSON_ROLE(person_fk, role_fk) VALUES (?, ?)`;
        mysqlConnection.beginTransaction(err => {
            if (err){
                console.log('err: ' + err)
                throw new Error('An error has occurred while starting the transaction');
            }
        });

        const password = await hashPassword(msg.password);
        let res = await mysqlQuery(personQuery, [msg.firstName, msg.lastName, msg.email, password, msg.dateOfBirth]);

        const id = res.insertId;
        await mysqlQuery(personRoleQuery, [id, msg.role]);
        console.log('id_: ' + id);
        await driverSession.run(`
    CREATE (person:PERSON {id: $id})
    RETURN person`, {id: id});
        mysqlConnection.commit();
    }catch (e){
        console.error('CODE: ' + e.code);
        console.error(e);
        mysqlConnection.rollback(function(){});
    }
}

async function hashPassword(passwordInPlainText){
    const salt = await bcrypt.genSalt();
    return bcrypt.hash(passwordInPlainText, salt);
}

//----------------------------------------------------------------------------------
async function deletePersonById(id){
    try {
        mysqlConnection.beginTransaction(err => {
            if (err){
                console.log('err: ' + err);
                throw new Error('An error has occurred while starting the transaction');
            }
        });
        const deletePersonQuery = `DELETE FROM Person WHERE id = ?`;
        await mysqlQuery(deletePersonQuery, [id]);
        await driverSession.run(`
     MATCH (person:PERSON {id: $id})
     DETACH DELETE person`, {id: id});
        return true;
    } catch (e) {
        console.error('CODE: ' + e.code);
        console.error(e);
        mysqlConnection.rollback(function (){});
        return false;
    }
}

async function findPersonById(id) {
    try {
        const query = `SELECT id, firstName, middleName, lastName, email, dateOfBirth, pr.role_fk AS role FROM PERSON 
INNER JOIN PERSON_ROLE pr ON id = pr.person_fk WHERE id = ?`;
        let res = await mysqlQuery(query, [id]);
        return res[0];
    } catch (e) {
        console.error('CODE: ' + e.code);
        console.error(e);
    }
}

async function findUserByCommentId(commentId){
    try {
        const getUserIdQuery = 'SELECT userId FROM Comments WHERE commentId = ?';
        let res = await cassandraClient.execute(getUserIdQuery, [commentId], {prepare: true, isIdempotent: true});
        let id = parseInt(res.rows[0].userid);

        const query = 'SELECT id, firstName, lastName FROM Person WHERE id = ?';
        res = await mysqlQuery(query, [id]);
        return res[0];
    } catch (e){
        console.error('CODE: ' + e.code);
        console.error(e);
    }
}

async function findUserByPostId(postId){
    try {
        const getUserIdQuery = 'SELECT userId FROM Posts WHERE postId = ?';
        let res = await cassandraClient.execute(getUserIdQuery, [postId], {prepare: true, isIdempotent: true});
        let userId = parseInt(res.rows[0].userid);

        const query = 'SELECT id, firstName, lastName FROM Person WHERE id = ?';
        res = await mysqlQuery(query, [userId]);
        return res[0];
    } catch (e){
        console.error('CODE: ' + e.code);
        console.error(e);
    }
}

module.exports = {
    addPerson,
    deletePersonById,
    findPersonById,
    findUserByCommentId,
    findUserByPostId
}
