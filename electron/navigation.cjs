const { pathToFileURL } = require('node:url');

const isExternalWebUrl = (value) => {
  try {
    return ['https:', 'http:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
};

const isAppDocument = (value, indexPath) => {
  try {
    const candidate = new URL(value);
    candidate.hash = '';
    candidate.search = '';
    return candidate.href === pathToFileURL(indexPath).href;
  } catch {
    return false;
  }
};

module.exports = { isExternalWebUrl, isAppDocument };
