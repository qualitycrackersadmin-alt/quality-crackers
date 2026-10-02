// "Vanitha's Color Koti Flower Pots (10 Pieces)" -> "vanithas-color-koti-flower-pots-10-pieces"
function slugify(text) {
  return String(text)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’`]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

module.exports = slugify;
