const ygo = require('./yugihelp/YGO');
const { EmbedBuilder } = require('discord.js');

async function card_search(interaction) {
  const query = interaction.options.getString('query') || '';
  if (!query)
    return interaction.reply({ content: 'Usage: /card_search <query>', ephemeral: true });

  const cards = await ygo.search('fname', query);
  if (!cards || !cards.data)
    return interaction.reply({ content: 'No cards found', ephemeral: true });

  // build list of names (2000 char max per message)
  let names = '';
  const out = [];
  for (const card of cards.data) {
    if ((names + card.name + '\n').length >= 2000) {
      out.push(names);
      names = '';
    }
    names += card.name + '\n';
  }
  if (names) out.push(names);
  for (const part of out)
    await interaction.reply({ content: part }).catch(() => {});
}

async function card(interaction) {
  const query = interaction.options.getString('query') || '';
  if (!query)
    return interaction.reply({ content: 'Usage: /card <name>', ephemeral: true });

  const cards = await ygo.search('name', query);
  if (!cards || !cards.data || !cards.data[0])
    return interaction.reply({ content: 'No card found', ephemeral: true });

  const cardInfo = cards.data[0];
  const cardType = (cardInfo.type || '').toLowerCase();
  const TYPE_COLORS = {
    normal: 0xfde68a,
    effect: 0xff8b53,
    spell: 0x1e9e74,
    trap: 0xbc5a84,
    fusion: 0xa086b7,
    synchro: 0xcccccc,
    xyz: 0x000000,
    link: 0x006ead,
    pendulum: 0x7cfc00,
    token: 0x828d85,
    counter: 0x828d85,
    ritual: 0x9db5cc,
  };
  let color = 0xffd700;
  for (const key of Object.keys(TYPE_COLORS)) {
    if (cardType.includes(key)) { color = TYPE_COLORS[key]; break; }
  }
  const embed = new EmbedBuilder().setTitle(cardInfo.name).setColor(color);
  if (cardType.includes('monster')) {
    embed.addFields(
      { name: 'ATK', value: String(cardInfo.atk || 0), inline: true },
      { name: 'DEF', value: String(cardInfo.def || 0), inline: true },
      { name: 'Level', value: String(cardInfo.level || 'N/A'), inline: true },
    );
  }
  embed.addFields({ name: 'Desc', value: (cardInfo.desc || '').replace("''", '*') });
  if (cardInfo.banlist_info) {
    if (cardInfo.banlist_info.ban_tcg)
      embed.addFields({ name: 'TCG', value: String(cardInfo.banlist_info.ban_tcg) });
    if (cardInfo.banlist_info.ban_ocg)
      embed.addFields({ name: 'OCG', value: String(cardInfo.banlist_info.ban_ocg) });
  }
  if (cardInfo.card_images && cardInfo.card_images.length)
    embed.setImage(cardInfo.card_images[Math.floor(Math.random() * cardInfo.card_images.length)].image_url);

  await interaction.reply({ embeds: [embed] }).catch(() => {});
}

module.exports = {
  commands: { card_search, card },
  slash: {
    card_search: {
      name: 'card_search',
      description: 'Fuzzy search for Yu-Gi-Oh cards',
      options: [{ name: 'query', description: 'search query', type: 3, required: true }],
    },
    card: {
      name: 'card',
      description: 'Get information for a Yu-Gi-Oh card',
      options: [{ name: 'query', description: 'card name', type: 3, required: true }],
    },
  },
};
