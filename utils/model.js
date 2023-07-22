function getPlain(model) {
  return model ? model.get({ plain: true }) : null;
}

module.exports = {
  getPlain,
};
