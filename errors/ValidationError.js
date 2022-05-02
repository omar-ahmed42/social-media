const CustomAPIError = require("./CustomAPIError");
const UNPROCESSABLE_ENTITY = require('http-status-codes').UNPROCESSABLE_ENTITY;

class ValidationError extends CustomAPIError {
    constructor(message) {
        super(message);
        this.statusCode = UNPROCESSABLE_ENTITY;
    }
}

module.exports = ValidationError;
