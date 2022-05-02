const CustomAPIError = require("./CustomAPIError");
const NOT_FOUND = require('http-status-codes').NOT_FOUND

class NotFoundError extends CustomAPIError {
    constructor(message) {
        super(message);
        this.statusCode = NOT_FOUND;
    }
}

module.exports = NotFoundError;

