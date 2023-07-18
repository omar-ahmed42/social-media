const {driverSession, sequelize, neo4j} = require('../db/connect.js');
const { User } = require('../models/user.js');
const { Comment } = require('../models/comment.js');
const {Role} = require('../models/role.js');
const bcrypt = require("bcrypt");
const { Op } = require('sequelize');
const { Post } = require('../models/post.js');

async function addPerson(msg) {
  const password = await hashPassword(msg.password);
  return await sequelize.transaction(async (t1) => {
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
          MERGE (person:PERSON {id: $id})
          RETURN person`,
        { id: neo4j.int(user.getDataValue('id')) }
      );
    });
    return user.get();
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
        { id: neo4j.int(id) }
      )
    );
  });
  return rowsDeleted >= 1;
}

async function findPersonById(id) {
  let user = await sequelize.transaction(
    async (t1) => await User.findByPk(id, { transaction: t1 })
  );
  return user.get();
}

async function findUserByCommentId(commentId) {
  try {
    let comment = await Comment.findByPk(commentId, {
      include: {
        model: User,
        attributes: [
          'id',
          'firstName',
          'lastName',
          'email',
          'dateOfBirth',
          'createdAt',
        ],
      },
      attributes: [],
    });
    return comment ? comment.get().User : null;
  } catch (e) {
    console.error(e);
  }
}

async function findUserByPostId(postId) {
  try {
    let user = await Post.findByPk(postId, {
      include: {
        model: User,
        attributes: [
          'id',
          'firstName',
          'lastName',
          'email',
          'dateOfBirth',
          'createdAt',
        ],
      },
      attributes: [],
    });
    return user ? user.get().User : null;
  } catch (e) {
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
