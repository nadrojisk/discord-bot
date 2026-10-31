const pokedex = require('./pokehelp/Pokedex');
const helpers = require('../helpers');
const { EmbedBuilder, AttachmentBuilder } = require('discord.js');

async function dexCommand(interaction) {
  const query = (interaction.options.getString('query') || '').toLowerCase();
  if (!query)
    return interaction.reply({ content: 'Usage: /dex <pokémon>', ephemeral: true });

  const pokémon = await pokedex.getPokedexEntry(query);
  if (!pokémon)
    return interaction.reply({ content: 'Pokémon not found', ephemeral: true });

  const truncate = (s, n = 300) =>
    typeof s === 'string' && s.length > n ? s.slice(0, n - 1) + '…' : s;

  const TYPE_COLORS = {
    normal: 0xa8a77a, fire: 0xee8130, water: 0x6390f0, electric: 0xf7d02c,
    grass: 0x7ac74c, ice: 0x96d9d6, fighting: 0xc22e28, poison: 0xa33ea1,
    ground: 0xe2bf65, flying: 0xa98ff3, psychic: 0xf95587, bug: 0xa6b91a,
    rock: 0xb6a136, ghost: 0x735797, dragon: 0x6f35fc, dark: 0x705746,
    steel: 0xb7b7ce, fairy: 0xd685ad,
  };

  const primaryType = Array.isArray(pokémon.types) && pokémon.types[0]?.type?.name;
  const color = (primaryType && TYPE_COLORS[primaryType]) || 0xff0000;

  const embed = new EmbedBuilder()
    .setTitle(`**${helpers.titleCase(pokémon.name)}** (#${pokémon.id})`)
    .setColor(color);

  if (pokémon.sprites?.front_default) embed.setImage(pokémon.sprites.front_default);

  if (Array.isArray(pokémon.types)) {
    const typeNames = pokémon.types
      .map((t) => t?.type?.name ? helpers.titleCase(t.type.name) : null)
      .filter(Boolean);
    if (typeNames.length) embed.addFields({ name: 'Types', value: typeNames.join('/'), inline: true });
  }

  if (Array.isArray(pokémon.abilities)) {
    const abilities = pokémon.abilities
      .map((a) => a.ability?.name ? helpers.titleCase(a.ability.name) : String(a))
      .join(', ');
    if (abilities) embed.addFields({ name: 'Abilities', value: abilities, inline: true });
  }

  embed.addFields({ name: '\u200B', value: '' });

  if (pokémon.stats) {
    const statMap = {};
    for (const s of pokémon.stats) statMap[String(s.stat.name).toLowerCase()] = s.base_stat;
    const ordered = [
      ['HP', statMap['hp'] || '0'],
      ['ATTACK', statMap['attack'] || '0'],
      ['DEFENSE', statMap['defense'] || '0'],
      ['SP.ATTACK', statMap['special-attack'] || statMap['special_attack'] || '0'],
      ['SP.DEFENSE', statMap['special-defense'] || statMap['special_defense'] || '0'],
      ['SPEED', statMap['speed'] || '0'],
    ];
    for (const [k, v] of ordered) embed.addFields({ name: k, value: String(v), inline: true });
  }

  if (typeof pokémon.description === 'string')
    embed.setDescription(truncate(pokémon.description, 400));

  await interaction.reply({ embeds: [embed] }).catch(() => {});
}

async function evolveCommand(interaction) {
  const query = (interaction.options.getString('pokémon') || '').toLowerCase();
  if (!query)
    return interaction.reply({ content: 'Usage: /evolve <pokémon>', ephemeral: true });

  const summary = await pokedex.searchEvolve(query);
  if (!summary)
    return interaction.reply({ content: 'No evolution info found', ephemeral: true });

  const content = String(summary);
  if (content.length <= 1900)
    return interaction.reply({ content }).catch(() => {});

  try {
    const buf = Buffer.from(summary, 'utf8');
    const fileName = `${query.replace(/[^a-z0-9_-]/gi, '_')}_evolution.json`;
    const attachment = new AttachmentBuilder(buf, { name: fileName });
    return interaction.reply({ content: 'Evolution data is large — sending as file.', files: [attachment] }).catch(() => {});
  } catch (err) {
    return interaction.reply({ content: 'Evolution data is too large to display.', ephemeral: true }).catch(() => {});
  }
}

module.exports = {
  commands: {
    pokédex: dexCommand,
    evolve: evolveCommand,
  },
  slash: {
    dex: {
      name: 'pokédex',
      description: 'Search for Pokémon',
      options: [{ name: 'query', description: 'Pokémon name or Pokédex ID', type: 3, required: true }],
    },
    evolve: {
      name: 'evolve',
      description: 'Get evolution requirements',
      options: [{ name: 'pokémon', description: 'Pokémon name or id', type: 3, required: true }],
    },
  },
};
