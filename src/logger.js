function format(level, message) {
  return `[${new Date().toISOString().replace('T', ' ').replace('Z', '')
    }] [${level}] ${message}`;
}

module.exports = {
  info: (msg) => console.log(format('INFO', msg)),
  warn: (msg) => console.warn(format('WARN', msg)),
  error: (msg, err) => console.error(format('ERROR', msg), err != null ? err : ''),
};
