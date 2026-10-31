const logger = require('./logger');

function logError(error) {
  logger.error(String(error));
}

function word_cmp(string1, string2) {
  if (!string1 || !string2) return false;
  const re = new RegExp(
    `\\b${string1.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`,
    'i',
  );
  return re.test(string2);
}

function titleCase(s) {
  if (!s && s !== '') return '';
  return String(s)
    .replace(/-/g, ' ')
    .split(' ')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ''))
    .filter(Boolean)
    .join(' ');
}

module.exports = {
  logError,
  word_cmp,
  titleCase,
};
