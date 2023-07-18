const { User } = require('../models/user');
const JwtStrategy = require('passport-jwt').Strategy;
const ExtractJwt = require('passport-jwt').ExtractJwt;

require('dotenv').config();

const options = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: process.env.JWT_SECRET_KEY,
  algorithm: ['HS256'],
};

module.exports = (passport) => {
  passport.use(
    new JwtStrategy(options, async (jwt_payload, done) => {
      // console.log(jwt_payload);
      let id = jwt_payload.sub;
      try {
        let res = await User.findByPk(id, { attributes: ['id'] });
        if (res?.getDataValue('id')) {
          return done(null, res.getDataValue('id'));
        }

        return done(null, false);
      } catch (e) {
        console.log('ERROR: ' + e);
        console.log('ERROR_CODE: ' + e.code);
        done(e, false);
      }
    })
  );
};
