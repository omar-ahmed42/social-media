const VALID_VIDEO_EXTENSIONS = [
  '.mp4',
  '.mov',
  '.wmv',
  '.webm',
  '.avi',
  '.flv',
  '.mkv',
  '.mts',
];
const VALID_IMAGE_EXTENSIONS = [
  '.jpeg',
  '.jpg',
  '.png',
  '.webp',
  '.gif',
  '.jfif',
  '.avif',
  '.pjpeg',
  '.pjp',
];

function isValidVideo(fileExtension) {
  return VALID_VIDEO_EXTENSIONS.includes(fileExtension?.toLowerCase());
}

function isValidImage(fileExtension) {
  return VALID_IMAGE_EXTENSIONS.includes(fileExtension?.toLowerCase());
}

module.exports = {
  isValidImage,
  isValidVideo,
  VALID_VIDEO_EXTENSIONS,
  VALID_IMAGE_EXTENSIONS,
};
