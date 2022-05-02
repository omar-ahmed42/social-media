function parseFileExtension(filename){
    const re = /(?:\.([^.]+))?$/;
    let fileExtension = re.exec(filename);
    return fileExtension === undefined ? undefined : fileExtension[0];
}

module.exports = {
    parseFileExtension
}
