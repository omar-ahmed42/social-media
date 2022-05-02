const jsonwebtoken = require('jsonwebtoken');

function issueJWT(user) {
    const id = user.id;
    const expiresIn = process.env.JWT_EXPIRES_IN

    const payload = {
        sub: id,
        iat: Date.now(),
        claims: {
            roles: user.roles
        }
    };

    const signedToken = jsonwebtoken.sign(payload, process.env.JWT_SECRET_KEY, {
        expiresIn: process.env.JWT_EXPIRES_IN,
        algorithm: 'HS256'
    });

    return {
        token: signedToken,
        expiresIn: expiresIn
    }
}

module.exports = {
    issueJWT
}
