const router = require('express').Router();
const bcrypt = require('bcrypt');
const { issueJWT } = require('../utils/jwt');
const { StatusCodes } = require('http-status-codes');
const { User } = require('../models/user');

router.post('/login', async (req, res, next) => {
  if (!req.body.email || !req.body.password) {
    return res
      .status(400)
      .json({ success: false, msg: 'Please provide email or password' });
  }

  let user = await User.findOne({
    where: { email: req.body.email },
    attributes: ['id', 'firstName', 'lastName', 'password'],
  });

  if (!user) {
    return res.status(404).json({ success: false, msg: 'Invalid credentials' });
  }

  let isMatch = await bcrypt.compare(
    req.body.password,
    user.getDataValue('password')
  );
  if (!isMatch)
    return res.status(404).json({ success: false, msg: 'Invalid credentials' });

  let roles = await user.getRoles();
  user = user.get();
  user.roles = roles?.length
    ? roles.map((role) => role.getDataValue('name'))
    : [];

  const token = issueJWT(user);
  return res.status(StatusCodes.OK).json({ success: true, token: token });
});

module.exports = {
  router,
};
