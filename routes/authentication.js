const {mysqlQuery} = require("../db/connect");
const router = require('express').Router();
const bcrypt = require("bcrypt");
const {issueJWT} = require("../utils/jwt");
const {StatusCodes} = require("http-status-codes");

router.post('/login', async (req, res, next) => {
    if (!req.body.email || !req.body.password){
        res.status(400).json({"success":false, "msg": "Please provide email or password"});
    }

    let findUserQuery = "SELECT id, firstName, lastName, password FROM Person WHERE email = ?";
    let user = await mysqlQuery(findUserQuery, [req.body.email]);
    if (!user){
        res.status(404).json({"success": false, "msg": "Invalid credentials"});
    }

    user = user[0];
    let isMatch = bcrypt.compare(req.body.password, user.password);
    if (!isMatch){
        res.status(404).json({"success": false, "msg": "Invalid credentials"});
    }

    let findUserRolesQuery = "SELECT r.name FROM PERSON_ROLE pr INNER JOIN Role r ON pr.role_fk = r.id WHERE person_fk = ?";
    let res_roles = await mysqlQuery(findUserRolesQuery, [user.id]);

    let roles = new Array();
    res_roles.forEach(element => roles.push(element.name));
    user.roles = roles;

    const token = issueJWT(user);
    res.status(StatusCodes.OK).json({"success": true, "token": token});
})

module.exports = {
    router
}
