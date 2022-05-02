const {imageFilter} = require("./image");
const {videoFilter} = require("./video");

const isValidMedia = (fileExtension) => {
    return imageFilter(fileExtension) || videoFilter(fileExtension);
}


module.exports = {
    isValidMedia
}
