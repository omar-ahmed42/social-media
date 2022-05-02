const {mysqlQuery} = require("../db/connect");
const JwtStrategy = require('passport-jwt').Strategy;
const ExtractJwt = require('passport-jwt').ExtractJwt;

require('dotenv').config();

const options = {
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: process.env.JWT_SECRET_KEY,
    algorithm: ['HS256']
};

module.exports = (passport) => {
    passport.use(new JwtStrategy(options, async (jwt_payload, done) => {
        console.log(jwt_payload);
        let id = jwt_payload.sub;
        let findUserQuery = "SELECT id FROM Person WHERE id = ?";
        try {
            let res = await mysqlQuery(findUserQuery, [id]);

            if (res[0].id) {
                return done(null, res[0].id)
            }

            return done(null, false);
        } catch (e) {
            console.log('ERROR: ' + e);
            console.log('ERROR_CODE: ' + e.code);
            done(e, false);
        }
    }));
}
