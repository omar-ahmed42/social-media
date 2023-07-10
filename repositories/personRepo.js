const {mysqlConnection, driverSession, sequelize} = require('../db/connect.js');
const {cassandraClient, mysqlQuery} = require("../db/connect");
const { User } = require('../models/user.js');
const {Role} = require('../models/role.js');
const bcrypt = require("bcrypt");
const { Op } = require('sequelize');

async function addPerson(msg) {
  const password = await hashPassword(msg.password);
  await sequelize.transaction(async (t1) => {
    let user = await User.create(
      {
        firstName: msg.firstName,
        lastName: msg.lastName,
        email: msg.email,
        password: password,
        dateOfBirth: new Date(msg.dateOfBirth),
      },
      { transaction: t1 }
    );

    const roles = await Role.findAll({
      where: {
        name: { [Op.in]: msg.roles },
      },
    });

    user.addRoles(roles);

    await driverSession.executeWrite(async (t2) => {
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

async function deletePersonById(id) {
  let rowsDeleted = 0;
  sequelize.transaction(async (t1) => {
    rowsDeleted = await User.destroy({ where: { id: id }, transaction: t1 });
    driverSession.executeWrite(async (t2) =>
      t2.run(
        `MATCH (person:PERSON {id: $id})
        DETACH DELETE person`,
        { id: id }
      )
    );
  });
  return rowsDeleted >= 1;
}

async function findPersonById(id) {
  let user;
  sequelize.transaction(
    async (t1) => (user = User.findByPk(id, { transaction: t1 }))
  );
  return user;
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
    findUserByPostId,
    hashPassword
}
