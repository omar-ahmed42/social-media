const fs = require('fs');
const path = require('path');
const { finished } = require('stream/promises');

const DEFAULT_UPLOADS_PATH = '../uploads/';

async function storeFile(readStream, attachmentUrl) {
  try {
    const stream = readStream();

    const out = fs.createWriteStream(attachmentUrl);
    stream.pipe(out);
    await finished(out);
  } catch (error) {
    console.error('Error while storing an attachment:', error);
  }
}

module.exports = {
  DEFAULT_UPLOADS_PATH,
  storeFile,
};
