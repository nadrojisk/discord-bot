const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, Collection } = require('discord.js');
require('dotenv').config();
const logger = require('./logger');
const { startHealthServer } = require('./health');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.commands = new Collection();
// collect slash command definitions from cogs (if provided)
// use a map keyed by lowercased command name to avoid duplicates at collection time
const registeredSlashMap = new Map();

// load command modules from src/cogs
const cogsPath = path.join(__dirname, 'cogs');
for (const file of fs.readdirSync(cogsPath)) {
  const full = path.join(cogsPath, file);
  if (fs.lstatSync(full).isFile() && file.endsWith('.js')) {
    const mod = require(full);

    if (mod.enabled === false) {
      logger.info(`Skipping disabled cog: ${file}`);
      continue;
    }

    // each cog should export commands as an object or function map
    if (mod.commands && typeof mod.commands === 'object') {
      for (const [name, handler] of Object.entries(mod.commands)) {
        client.commands.set(name.toLowerCase(), handler);
      }
    }
    // collect slash definitions exported by the cog
    if (mod.slash) {
      const addDef = (def) => {
        if (!def || !def.name) return;
        const n = String(def.name).toLowerCase();
        if (!registeredSlashMap.has(n)) {
          registeredSlashMap.set(n, def);
        } else {
          logger.warn(`Skipping duplicate slash definition for '${n}' from cog ${file}`);
        }
      };

      if (Array.isArray(mod.slash)) mod.slash.forEach(addDef);
      else if (typeof mod.slash === 'object')
        Object.values(mod.slash).forEach(addDef);
    }
    // support init(client) for listener/background cogs
    if (typeof mod.init === 'function') {
      try {
        mod.init(client);
      } catch (err) {
        logger.error(`Error initializing cog ${file}`, err);
      }
    }
    // also support single-command exports e.g. module.exports = { pingCommand }
    for (const key of Object.keys(mod)) {
      if (key.endsWith('Command') || key.endsWith('command')) {
        client.commands.set(
          key.replace(/Command$/i, '').toLowerCase(),
          mod[key],
        );
      }
    }
  }
}

// Register slash commands (if possible)
async function registerSlashCommands() {
  const token = process.env.DISCORD_TOKEN;
  const appId =
    process.env.APP_ID || process.env.CLIENT_ID || process.env.DISCORD_APP_ID;
  const guildId = process.env.GUILD_ID;
  if (!token || !appId) {
    logger.warn('Skipping slash command registration - DISCORD_TOKEN or APP_ID missing');
    return;
  }

  // Build command definitions from collected slash defs (already deduplicated)
  const finalCommands = Array.from(registeredSlashMap.values());
  if (!finalCommands || !finalCommands.length) {
    logger.warn('No slash command definitions found in cogs; skipping registration. Add `slash` exports to cogs to enable slash commands.');
    return;
  }

  // Attempt to register using @discordjs/rest and discord-api-types
  try {
    const { REST } = require('@discordjs/rest');
    const { Routes } = require('discord-api-types/v10');
    const rest = new REST({ version: '10' }).setToken(token);
    if (guildId) {
      await rest.put(Routes.applicationGuildCommands(appId, guildId), {
        body: finalCommands,
      });
      logger.info(`Registered ${finalCommands.length} guild slash commands for ${guildId}`);
    } else {
      await rest.put(Routes.applicationCommands(appId), {
        body: finalCommands,
      });
      logger.info(`Registered ${finalCommands.length} global slash commands`);
    }
  } catch (err) {
    logger.error('Could not register slash commands: @discordjs/rest or discord-api-types missing or an error occurred. Install @discordjs/rest and discord-api-types/v10 to enable registration.', err);
  }
}

// Use the v15-compatible event name. This will run only once when emitted.
client.once('clientReady', () => {
  logger.info(`Logged in as ${client.user.tag}!`);
  // try register but don't block ready
  registerSlashCommands().catch((err) =>
    logger.error('Slash register error', err),
  );
});

// Handle slash interactions by mapping to existing command handlers
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const name = interaction.commandName.toLowerCase();
  const handler = client.commands.get(name);
  if (!handler)
    return interaction.reply({
      content: 'Command not implemented',
      ephemeral: true,
    });

  try {
    // Call handler with the Interaction object only; handlers should read interaction.options
    const res = handler(interaction);
    if (res && typeof res.then === 'function') await res;

    // If the handler didn't reply, inform user of non-response
    if (!interaction.replied && !interaction.deferred) {
      await interaction
        .reply({ content: 'Command executed (no output).', ephemeral: true })
        .catch(() => { });
    }
  } catch (err) {
    logger.error('Interaction handler error', err);
    if (!interaction.replied)
      await interaction
        .reply({
          content: 'There was an error executing command',
          ephemeral: true,
        })
        .catch(() => { });
  }
});

// Message delete/edit logging
const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID;

client.on('messageDelete', async (message) => {
  if (!message.guild || !message.channel || !message.author || message.author.bot) return;
  const logChannel = message.guild.channels.cache.get(LOG_CHANNEL_ID);
  if (!logChannel) return;
  const author = message.author ? `${message.author.tag}` : 'Unknown';
  const content = message.content
    || message.messageSnapshots?.first()?.content
    || '[No content]';
  const channelName = message.channel.name;
  const serverName = message.guild ? message.guild.name : 'Unknown';
  const time = new Date().toLocaleString();
  logChannel.send(
    `Message Deleted on ${time}\nServer: ${serverName}\nChannel: ${channelName}\nAuthor: ${author}\nMessage: ${content}`,
  ).catch((err) => logger.error('Log channel send failed', err));
});

client.on('messageUpdate', async (oldMessage, newMessage) => {
  if (!oldMessage.guild || !oldMessage.channel || !newMessage.author || newMessage.author.bot) return;
  if (oldMessage.content === newMessage.content) return;
  const logChannel = oldMessage.guild.channels.cache.get(LOG_CHANNEL_ID);
  if (!logChannel) return;
  const author = oldMessage.author ? `${oldMessage.author.tag}` : 'Unknown';
  const channelName = oldMessage.channel.name;
  const serverName = oldMessage.guild ? oldMessage.guild.name : 'Unknown';
  const time = new Date().toLocaleString();
  logChannel.send(
    `Message Edited on ${time}\nServer: ${serverName}\nChannel: ${channelName}\nAuthor: ${author}\nBefore: ${oldMessage.content || '[No content]'
    }\nAfter: ${newMessage.content || '[No content]'}`,
  ).catch((err) => logger.error('Log channel send failed', err));
});

const health = startHealthServer(client);

async function shutdown(signal) {
  logger.info(`${signal} received, shutting down`);
  health.close();
  try {
    await client.destroy();
  } catch (err) {
    logger.error('Error during client.destroy()', err);
  } finally {
    process.exit(0);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Retry forever with capped backoff, so a failed start-up login (DNS not up yet, Discord outage) doesn't leave the bot offline.
async function loginWithRetry(token) {
  for (let attempt = 1; ; attempt++) {
    try {
      await client.login(token);
      return;
    } catch (err) {
      const delay = Math.min(2000 * 2 ** (attempt - 1), 60000);
      logger.error(`Login attempt ${attempt} failed; retrying in ${delay / 1000}s`, err);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

const token = process.env.DISCORD_TOKEN;
if (token && typeof token === 'string' && token.length > 10) {
  loginWithRetry(token);
} else {
  logger.warn('DISCORD_TOKEN not set or invalid; skipping client.login() in test mode');
}
