const jsonwebtoken = require('jsonwebtoken');
const { User } = require('../models/user');
const { getPlain } = require('./model');

function issueJWT(user) {
    const id = user.id;
    const expiresIn = Number(process.env.JWT_EXPIRES_IN)

    const issuedAt = Math.floor(Date.now() / 1000);

    const payload = {
        sub: id,
        iat: issuedAt,
        claims: {
            roles: user.roles
        }
    };

    const exp = issuedAt + expiresIn;
    const signedToken = jsonwebtoken.sign(payload, process.env.JWT_SECRET_KEY, {
        expiresIn: expiresIn,
        algorithm: 'HS256'
    });

    return {
        token: signedToken,
        expiresIn: exp
    }
}

async function verifyToken(token) {
    try {
        const payload = jsonwebtoken.verify(token, process.env.JWT_SECRET_KEY);
        const user = await User.findByPk(payload.sub, {attributes: ['id']});

        return getPlain(user);
    } catch (error) {
        console.error('Error: ', error);
        return null;
    }
}

module.exports = {
    issueJWT,
    verifyToken
}
