const CustomAPIError = require("./CustomAPIError");
const BAD_REQUEST = require('http-status-codes').BAD_REQUEST;

class BadRequestError extends CustomAPIError {
    constructor(message) {
        super(message);
        this.statusCode = BAD_REQUEST;
    }
}

module.exports = BadRequestError;

