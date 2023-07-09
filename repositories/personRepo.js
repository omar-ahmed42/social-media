const {mysqlConnection, driverSession, sequelize} = require('../db/connect.js');
const {cassandraClient, mysqlQuery} = require("../db/connect");
const { User } = require('../models/user.js');
const {Role} = require('../models/role.js');
const bcrypt = require("bcrypt");

async function addPerson(msg) {
  const password = await hashPassword(msg.password);
  const escapedRoleNames = msg.roles.map((roleName) => sequelize.escape(roleName));
  sequelize.transaction(async (t1) => {
    const user = await User.create(
      {
        firstName: msg.firstName,
        lastName: msg.lastName,
        email: msg.email,
        password: password,
        dateOfBirth: new Date(msg.dateOfBirth),
        roles: msg.roles.map((name, index) => ({
          id: sequelize.literal(
            `(SELECT id FROM role WHERE name = ${escapedRoleNames[index]})`
          ),
        })),
      },
      { transaction: t1, include: Role }
    );

    await driverSession.executeWrite((t2) => {
      return t2.run(
        `
          CREATE (person:PERSON {id: $id})
          RETURN person`,
        { id: user.id }
      );
    });
  });
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
