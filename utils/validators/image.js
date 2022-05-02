const imageFilter = (filename) => {
    if (!filename.match(/\.(jpg|JPG|jpeg|JPEG|png|PNG|gif|GIF)$/)){
        console.error('Only image files are allowed!')
        return false;
    }
    return true;
}

module.exports = {
    imageFilter
}
