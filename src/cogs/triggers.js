const Database = require('../database');
const helpers = require('../helpers');
const logger = require('../logger');

const GREETING_FALLBACK = ['hello', 'hi', 'hey', 'yo', 'greetings'];

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function handleMessage(message) {
  if (message.author.bot) return;
  const text = message.content.toLowerCase();

  // Greeting: short message containing a greeting trigger + "bot"
  const greetTriggers = Database.getTriggers('greeting').length
    ? Database.getTriggers('greeting')
    : GREETING_FALLBACK;
  if (
    greetTriggers.some((v) => helpers.word_cmp(v, text)) &&
    text.trim().split(' ').length <= 2
  ) {
    const greetings = Database.getResponses('greeting');
    if (helpers.word_cmp('bot', text) && greetings.length) {
      const nick = message.member
        ? message.member.nickname || message.author.username
        : message.author.username;
      await message.channel.send(`${pickRandom(greetings)} ${nick}`);
      return;
    }
  }

  // Generic keyword triggers
  for (const tname of Database.getAllTriggerTypes()) {
    if (tname === 'greeting') continue;
    const triggers = Database.getTriggers(tname);
    if (!triggers.length) continue;
    if (triggers.some((v) => helpers.word_cmp(v, text))) {
      const responses = Database.getResponses(tname);
      if (responses.length) {
        await message.channel.send(pickRandom(responses));
        return;
      }
    }
  }
}

function init(client) {
  client.on('messageCreate', (message) => {
    handleMessage(message).catch((err) =>
      logger.error('Trigger handler error', err),
    );
  });
  logger.info('Triggers cog is ready');
}

module.exports = { init };
