const videoFilter = (filename) => {
    if (!filename.match(/\.(mp4|MP4|webm|WEBM|mkv|MKV|mov|MOV|wmv|WMV)$/)){
        console.error('Only video files are allowed!')
        return false;
    }

    return true;
}


module.exports = {
    videoFilter
}
