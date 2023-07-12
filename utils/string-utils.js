function isBlank(str) {
  return !str || /^\s*$/.test(str);
}

module.exports = {
  isBlank,
};
