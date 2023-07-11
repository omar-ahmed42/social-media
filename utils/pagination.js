const MAX_PAGE_SIZE = 50;

const DEFAULT_PAGE = 0;
const DEFAULT_PAGE_SIZE = 15;

function calculateOffset(page, pageSize) {
  return page * pageSize;
}

function calculatePageLimit(pageSize) {
  return pageSize > MAX_PAGE_SIZE ? MAX_PAGE_SIZE : pageSize;
}

module.exports = {
  MAX_PAGE_SIZE,
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  calculateOffset,
  calculatePageLimit,
};
