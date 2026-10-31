const { EmbedBuilder } = require('discord.js');
const logger = require('../logger');

const SCRYFALL_HEADERS = {
    'User-Agent': 'BotOfGreed (nad.junk@pm.me)',
    'Accept': 'application/json'
};

// Card helper functions moved here from src/helpers.js to keep magic-specific logic local
function getImageUrl(card, size = 'normal') {
    if (!card) return null;

    if (card.image_uris && card.image_uris[size]) {
        return card.image_uris[size];
    }

    if (Array.isArray(card.card_faces) && card.card_faces.length > 0) {
        const first = card.card_faces[0];
        if (first.image_uris && first.image_uris[size]) return first.image_uris[size];

        for (const face of card.card_faces) {
            if (face.image_uris && face.image_uris[size]) return face.image_uris[size];
        }
    }

    return null;
}

function getCardFace(card, index = 0) {
    if (!card) return null;
    if (Array.isArray(card.card_faces) && card.card_faces[index]) return card.card_faces[index];
    return card;
}

function getCardProp(card, prop, index = 0) {
    if (!card) return null;
    const face = getCardFace(card, index) || {};
    if (Object.prototype.hasOwnProperty.call(face, prop) && face[prop] != null) return face[prop];
    if (Object.prototype.hasOwnProperty.call(card, prop) && card[prop] != null) return card[prop];
    return null;
}

function faceRotation(card, faceIndex) {
    const face = card.card_faces?.[faceIndex];
    if (face?.type_line?.includes('Battle')) return -90;
    return 0;
}

async function buildDfcImage(card, front, back) {
    const frontUrl = front.image_uris && (front.image_uris.normal || front.image_uris.large || front.image_uris.png);
    const backUrl = back.image_uris && (back.image_uris.normal || back.image_uris.large || back.image_uris.png);
    let buffer = null;
    try {
        buffer = await mergeCardFaces(frontUrl, backUrl, faceRotation(card, 0), faceRotation(card, 1));
    } catch (e) {
        buffer = null;
    }
    return { buffer, name: `merged-${card.id || Date.now()}.png`, frontUrl, backUrl };
}

async function mergeCardFaces(urlA, urlB, rotateA = 0, rotateB = 0) {
    if (!urlA && !urlB) return null;
    let Jimp;
    try {
        Jimp = require('jimp');
    } catch (err) {
        return null;
    }

    try {
        const [imgA, imgB] = await Promise.all([
            urlA ? Jimp.read(urlA) : null,
            urlB ? Jimp.read(urlB) : null,
        ]);

        if (!imgA && !imgB) return null;

        if (imgA && rotateA) imgA.rotate(rotateA);
        if (imgB && rotateB) imgB.rotate(rotateB);

        if (!imgB) return await imgA.getBufferAsync(Jimp.MIME_PNG);
        if (!imgA) return await imgB.getBufferAsync(Jimp.MIME_PNG);

        const targetHeight = Math.max(imgA.bitmap.height, imgB.bitmap.height);
        imgA.resize(Jimp.AUTO, targetHeight);
        imgB.resize(Jimp.AUTO, targetHeight);

        const width = imgA.bitmap.width + imgB.bitmap.width;
        const merged = new Jimp(width, targetHeight, 0x000000FF);
        merged.composite(imgA, 0, 0);
        merged.composite(imgB, imgA.bitmap.width, 0);

        return await merged.getBufferAsync(Jimp.MIME_PNG);
    } catch (err) {
        return null;
    }
}

const SCRYFALL_API = 'https://api.scryfall.com';
let globalManaEmojis = {};

function normalizeEmbedItems(items) {
    const outEmbeds = [];
    const outFiles = [];
    for (const item of items) {
        if (!item) continue;
        if (item.embed && item.attachment) {
            outEmbeds.push(item.embed);
            outFiles.push({ attachment: item.attachment.buffer, name: item.attachment.name });
        } else {
            outEmbeds.push(item);
        }
    }
    return { outEmbeds, outFiles };
}

async function magic(interaction, client) {
    const name = interaction.options.getString('name');
    const request = interaction.options.getString('request') || 'text';

    try {
        const card = await searchCard(name);

        if (!card) {
            return interaction.reply(`Card not found: "${name}"`);
        }

        let embedsToSend = [];
        switch (request) {
            case 'price':
                embedsToSend = [await getCardPriceEmbed(card, client)];
                break;
            case 'rules':
                embedsToSend = [await getCardRulesEmbed(card, client)];
                break;
            case 'legal':
                embedsToSend = [await getCardLegalityEmbed(card, client)];
                break;
            case 'image':
                embedsToSend = await getCardImageEmbed(card, client);
                break;
            case 'text':
            default:
                embedsToSend = [await getCardTextEmbed(card, client)];
                break;
        }

        if (!Array.isArray(embedsToSend)) embedsToSend = [embedsToSend];

        const { outEmbeds, outFiles } = normalizeEmbedItems(embedsToSend);

        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ embeds: outEmbeds, files: outFiles }).catch(() => { });
        } else {
            await interaction.reply({ embeds: outEmbeds, files: outFiles }).catch(() => { });
        }
    } catch (error) {
        logger.error('Error fetching card', error);
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: `Error looking up "${name}"`, flags: 64 }).catch(() => { });
        } else {
            await interaction.reply({ content: `Error looking up "${name}"`, flags: 64 }).catch(() => { });
        }
    }
}

async function random(interaction, client) {
    try {
        const response = await fetch(`${SCRYFALL_API}/cards/random`, {
            headers: SCRYFALL_HEADERS
        });
        const card = await response.json();
        let embedsToSend = await getCardImageEmbed(card, client);
        if (!Array.isArray(embedsToSend)) embedsToSend = [embedsToSend];
        const { outEmbeds, outFiles } = normalizeEmbedItems(embedsToSend);
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ embeds: outEmbeds, files: outFiles }).catch(() => { });
        } else {
            await interaction.reply({ embeds: outEmbeds, files: outFiles }).catch(() => { });
        }
    } catch (error) {
        logger.error('Error fetching random card', error);
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: 'Error fetching random card', flags: 64 }).catch(() => { });
        } else {
            await interaction.reply({ content: 'Error fetching random card', flags: 64 }).catch(() => { });
        }
    }
}

module.exports = {
    name: 'magic',

    slash: {
        magic: {
            name: 'magic',
            description: 'Look up a Magic card by name with optional request type',
            options: [
                {
                    name: 'name',
                    description: 'Card name to search for',
                    type: 3,
                    required: true,
                },
                {
                    name: 'request',
                    description: 'Type of information to display',
                    type: 3,
                    required: false,
                    choices: [
                        { name: 'Text (default)', value: 'text' },
                        { name: 'Image', value: 'image' },
                        { name: 'Price', value: 'price' },
                        { name: 'Rules', value: 'rules' },
                        { name: 'Legality', value: 'legal' },
                    ],
                },
            ],
        },
        random: {
            name: 'random',
            description: 'Get a random Magic card',
            options: [],
        },
    },

    commands: {
        magic,
        random,
    },

    init(client) {
        logger.info('[Cog] Magic loaded');

        client.once('clientReady', async () => {
            try {
                const appEmojis = await client.application.emojis.fetch();

                logger.info(`Loaded ${appEmojis.size} bot application emojis`);

                const manaMap = {
                    '{W}': appEmojis.find(e => e.name?.toLowerCase() === 'manaw'),
                    '{U}': appEmojis.find(e => e.name?.toLowerCase() === 'manau'),
                    '{B}': appEmojis.find(e => e.name?.toLowerCase() === 'manab'),
                    '{R}': appEmojis.find(e => e.name?.toLowerCase() === 'manar'),
                    '{G}': appEmojis.find(e => e.name?.toLowerCase() === 'manag'),
                    '{C}': appEmojis.find(e => e.name?.toLowerCase() === 'manac'),
                    '{X}': appEmojis.find(e => e.name?.toLowerCase() === 'manax'),
                    '{0}': appEmojis.find(e => e.name?.toLowerCase() === 'mana0'),
                    '{1}': appEmojis.find(e => e.name?.toLowerCase() === 'mana1'),
                    '{2}': appEmojis.find(e => e.name?.toLowerCase() === 'mana2'),
                    '{3}': appEmojis.find(e => e.name?.toLowerCase() === 'mana3'),
                    '{4}': appEmojis.find(e => e.name?.toLowerCase() === 'mana4'),
                    '{5}': appEmojis.find(e => e.name?.toLowerCase() === 'mana5'),
                    '{6}': appEmojis.find(e => e.name?.toLowerCase() === 'mana6'),
                    '{7}': appEmojis.find(e => e.name?.toLowerCase() === 'mana7'),
                    '{8}': appEmojis.find(e => e.name?.toLowerCase() === 'mana8'),
                    '{9}': appEmojis.find(e => e.name?.toLowerCase() === 'mana9'),
                    '{10}': appEmojis.find(e => e.name?.toLowerCase() === 'mana10'),
                    '{11}': appEmojis.find(e => e.name?.toLowerCase() === 'mana11'),
                    '{12}': appEmojis.find(e => e.name?.toLowerCase() === 'mana12'),
                    '{13}': appEmojis.find(e => e.name?.toLowerCase() === 'mana13'),
                    '{14}': appEmojis.find(e => e.name?.toLowerCase() === 'mana14'),
                    '{15}': appEmojis.find(e => e.name?.toLowerCase() === 'mana15'),
                    '{16}': appEmojis.find(e => e.name?.toLowerCase() === 'mana16'),
                    '{20}': appEmojis.find(e => e.name?.toLowerCase() === 'mana20'),
                    '{W/U}': appEmojis.find(e => e.name?.toLowerCase() === 'manawu'),
                    '{W/B}': appEmojis.find(e => e.name?.toLowerCase() === 'manawb'),
                    '{U/B}': appEmojis.find(e => e.name?.toLowerCase() === 'manaub'),
                    '{U/R}': appEmojis.find(e => e.name?.toLowerCase() === 'manaur'),
                    '{R/G}': appEmojis.find(e => e.name?.toLowerCase() === 'manarg'),
                    '{R/W}': appEmojis.find(e => e.name?.toLowerCase() === 'manarw'),
                    '{G/W}': appEmojis.find(e => e.name?.toLowerCase() === 'managw'),
                    '{G/U}': appEmojis.find(e => e.name?.toLowerCase() === 'managu'),
                    '{B/R}': appEmojis.find(e => e.name?.toLowerCase() === 'manabr'),
                    '{B/G}': appEmojis.find(e => e.name?.toLowerCase() === 'manabg'),
                    '{W/P}': appEmojis.find(e => e.name?.toLowerCase() === 'manawp'),
                    '{U/P}': appEmojis.find(e => e.name?.toLowerCase() === 'manaup'),
                    '{B/P}': appEmojis.find(e => e.name?.toLowerCase() === 'manabp'),
                    '{R/P}': appEmojis.find(e => e.name?.toLowerCase() === 'manarp'),
                    '{G/P}': appEmojis.find(e => e.name?.toLowerCase() === 'managp'),
                    '{2/W}': appEmojis.find(e => e.name?.toLowerCase() === 'mana2w'),
                    '{2/U}': appEmojis.find(e => e.name?.toLowerCase() === 'mana2u'),
                    '{2/B}': appEmojis.find(e => e.name?.toLowerCase() === 'mana2b'),
                    '{2/R}': appEmojis.find(e => e.name?.toLowerCase() === 'mana2r'),
                    '{2/G}': appEmojis.find(e => e.name?.toLowerCase() === 'mana2g'),
                    '{S}': appEmojis.find(e => e.name?.toLowerCase() === 'manas'),
                    '{T}': appEmojis.find(e => e.name?.toLowerCase() === 'manat'),
                    '{Q}': appEmojis.find(e => e.name?.toLowerCase() === 'manaq'),
                    '{E}': appEmojis.find(e => e.name?.toLowerCase() === 'manae'),
                    '{A}': appEmojis.find(e => e.name?.toLowerCase() === 'manaa'),
                    '{P/W}': appEmojis.find(e => e.name?.toLowerCase() === 'manapw'),
                    '{CHAOS}': appEmojis.find(e => e.name?.toLowerCase() === 'manachaos'),
                    '{TK}': appEmojis.find(e => e.name?.toLowerCase() === 'manatk'),
                    '{W/U/P}': appEmojis.find(e => e.name?.toLowerCase() === 'manawup'),
                    '{U/B/P}': appEmojis.find(e => e.name?.toLowerCase() === 'manaubp'),
                    '{B/R/P}': appEmojis.find(e => e.name?.toLowerCase() === 'manabrp'),
                    '{R/G/P}': appEmojis.find(e => e.name?.toLowerCase() === 'manargp'),
                    '{G/W/P}': appEmojis.find(e => e.name?.toLowerCase() === 'managwp'),
                    '{R/W/P}': appEmojis.find(e => e.name?.toLowerCase() === 'manarwp'),
                    '{U/R/P}': appEmojis.find(e => e.name?.toLowerCase() === 'manaurp'),
                    '{B/G/P}': appEmojis.find(e => e.name?.toLowerCase() === 'manabgp'),
                    '{C/W}': appEmojis.find(e => e.name?.toLowerCase() === 'manacw'),
                    '{C/U}': appEmojis.find(e => e.name?.toLowerCase() === 'manacu'),
                    '{C/B}': appEmojis.find(e => e.name?.toLowerCase() === 'manacb'),
                    '{C/R}': appEmojis.find(e => e.name?.toLowerCase() === 'manacr'),
                    '{C/G}': appEmojis.find(e => e.name?.toLowerCase() === 'manacg'),
                };

                globalManaEmojis = manaMap;
                client.manaEmojis = manaMap;
                logger.info('Mana emojis loaded');

                const loadedCount = Object.values(manaMap).filter(e => e).length;
                logger.info(`Successfully loaded ${loadedCount} mana emojis`);
            } catch (err) {
                logger.error('Error loading bot emojis', err);
            }
        });

        client.on('messageCreate', async (message) => {
            if (message.author.bot) return;
            await onMessage(message, client);
        });
    },
};

async function onMessage(message, client) {
    if (message.author.bot) return;

    const cardRegex = /\[\[([!?#$]?)(.+?)\]\]/g;
    const matches = [];
    let match;

    while ((match = cardRegex.exec(message.content)) !== null) {
        matches.push({
            modifier: match[1],
            cardName: match[2].trim()
        });
    }

    if (matches.length === 0) return;

    const embeds = [];

    for (const { modifier, cardName } of matches) {
        try {
            const card = await searchCard(cardName);

            if (!card) {
                await message.reply(`Card not found: "${cardName}"`);
                continue;
            }

            let embed;
            if (modifier === '!') {
                embed = await getCardImageEmbed(card, client);
            } else if (modifier === '?') {
                embed = await getCardRulesEmbed(card, client);
            } else if (modifier === '#') {
                embed = await getCardLegalityEmbed(card, client);
            } else if (modifier === '$') {
                embed = await getCardPriceEmbed(card, client);
            } else {
                embed = await getCardTextEmbed(card, client);
            }

            if (!embed) continue;
            if (Array.isArray(embed)) {
                for (const e of embed) embeds.push(e);
            } else {
                embeds.push(embed);
            }
        } catch (error) {
            logger.error('Error fetching card', error);
            await message.reply(`Error looking up "${cardName}"`);
        }
    }

    if (embeds.length > 0) {
        const { outEmbeds, outFiles } = normalizeEmbedItems(embeds);
        await message.reply({ embeds: outEmbeds, files: outFiles.length ? outFiles : undefined }).catch(() => { });
    }
}

async function searchCard(cardName) {
    try {
        const encodedName = encodeURIComponent(cardName);
        const response = await fetch(`${SCRYFALL_API}/cards/named?fuzzy=${encodedName}`, {
            headers: SCRYFALL_HEADERS
        });

        if (!response.ok) return null;
        return await response.json();
    } catch (error) {
        logger.error('Scryfall API error', error);
        throw error;
    }
}

function formatManaSymbols(text, client) {
    if (!text) return '';

    let manaMap = client?.manaEmojis || globalManaEmojis;

    if (!manaMap || Object.values(manaMap).every(e => !e)) {
        manaMap = {
            '{W}': ':manaw:',
            '{U}': ':manau:',
            '{B}': ':manab:',
            '{R}': ':manar:',
            '{G}': ':manag:',
            '{C}': ':manac:',
            '{X}': ':manax:'
        };
    }

    let formatted = text;
    for (const [symbol, emoji] of Object.entries(manaMap)) {
        if (emoji) {
            formatted = formatted.replaceAll(symbol, emoji.toString());
        }
    }

    return formatted;
}

function getLegalityEmoji(status) {
    const emojiMap = {
        'legal': '✅',
        'banned': '🚫',
        'restricted': '⚠️',
        'not_legal': '❌'
    };
    return emojiMap[status] || '❓';
}

async function getCardTextEmbed(card, client) {
    let embed;
    if (Array.isArray(card.card_faces) && card.card_faces.length > 1) {
        const front = card.card_faces[0] || {};
        const back = card.card_faces[1] || {};

        // Adventure/flip cards share one image (top-level image_uris); DFCs have per-face image_uris
        const sharedImage = card.image_uris
            ? (card.image_uris.normal || card.image_uris.large || card.image_uris.png)
            : null;

        const faceLines = (face) => {
            const mana = face.mana_cost ? ` ${formatManaSymbols(face.mana_cost, client)}` : '';
            const type = face.type_line ? `*${face.type_line}*\n` : '';
            const text = formatManaSymbols(face.oracle_text || '', client);
            return `**${face.name || ''}**${mana}\n${type}${text}`;
        };

        embed = new EmbedBuilder()
            .setTitle(`${card.name}`)
            .setURL(card.scryfall_uri)
            .setDescription(`${faceLines(front)}\n\n${faceLines(back)}`)
            .setColor('#0099ff')
            .setFooter({ text: `${card.set_name} • ${card.rarity}` });

        if (front.power != null && front.toughness != null) {
            embed.addFields({ name: 'Power / Toughness', value: `${front.power} / ${front.toughness}`, inline: true });
        }
        if (back.power != null && back.toughness != null) {
            embed.addFields({ name: 'Back Power / Toughness', value: `${back.power} / ${back.toughness}`, inline: true });
        }

        if (sharedImage) {
            embed.setImage(sharedImage);
            return embed;
        }

        // DFC: merge per-face images
        const dfc = await buildDfcImage(card, front, back);
        if (dfc.buffer) {
            embed.setImage(`attachment://${dfc.name}`);
            return { embed, attachment: { name: dfc.name, buffer: dfc.buffer } };
        }
        return embed;
    }

    // single-faced fallback
    const oracleText = getCardProp(card, 'oracle_text') || 'No text';
    const formattedText = formatManaSymbols(oracleText, client);
    const formattedManaCost = formatManaSymbols(getCardProp(card, 'mana_cost') || '', client);

    embed = new EmbedBuilder()
        .setTitle(`${card.name}`)
        .setURL(card.scryfall_uri)
        .setDescription(formattedText)
        .addFields(
            {
                name: 'Mana Cost',
                value: formattedManaCost || 'None',
                inline: true
            },
            {
                name: 'Type',
                value: getCardProp(card, 'type_line') || 'Unknown',
                inline: true
            }
        )
        .setColor('#0099ff')
        .setFooter({ text: `${card.set_name} • ${card.rarity}` });

    const power = getCardProp(card, 'power');
    const toughness = getCardProp(card, 'toughness');
    if (power != null && toughness != null) {
        embed.addFields({
            name: 'Power / Toughness',
            value: `${power}/${toughness}`,
            inline: true
        });
    }

    const flavor = getCardProp(card, 'flavor_text');
    if (flavor) {
        const formattedFlavorText = formatManaSymbols(flavor, client);
        embed.addFields({
            name: 'Flavor Text',
            value: `*${formattedFlavorText}*`
        });
    }

    const image = getImageUrl(card, 'normal');
    if (image) {
        embed.setImage(image);
    }

    return embed;
}

async function getCardImageEmbed(card, client) {
    const embeds = [];

    if (Array.isArray(card.card_faces) && card.card_faces.length > 1) {
        const front = card.card_faces[0] || {};
        const back = card.card_faces[1] || {};

        // Adventure/flip: single shared image at the top level
        const sharedImage = card.image_uris
            ? (card.image_uris.normal || card.image_uris.large || card.image_uris.png)
            : null;

        const e = new EmbedBuilder()
            .setTitle(card.name)
            .setColor('#0099ff')
            .setFooter({ text: `${card.set_name} • ${card.rarity}` });

        if (sharedImage) {
            const rotation = faceRotation(card, 0);
            if (rotation) {
                const rotated = await mergeCardFaces(sharedImage, null, rotation, 0);
                if (rotated) {
                    const attachmentName = `rotated-${card.id || Date.now()}.png`;
                    e.setImage(`attachment://${attachmentName}`);
                    embeds.push({ embed: e, attachment: { name: attachmentName, buffer: rotated } });
                } else {
                    e.setImage(sharedImage);
                    embeds.push(e);
                }
            } else {
                e.setImage(sharedImage);
                embeds.push(e);
            }
        } else {
            // DFC: merge per-face images
            const dfc = await buildDfcImage(card, front, back);
            if (dfc.buffer) {
                e.setImage(`attachment://${dfc.name}`);
                embeds.push({ embed: e, attachment: { name: dfc.name, buffer: dfc.buffer } });
            } else {
                if (dfc.frontUrl) e.setImage(dfc.frontUrl);
                if (dfc.backUrl) e.setThumbnail(dfc.backUrl);
                embeds.push(e);
            }

            // add second-face abilities and power/toughness for DFCs
            const secondKeywords = back.keyword_abilities || back.keywords || back.keyword || null;
            const secondPower = back.power || null;
            const secondToughness = back.toughness || null;
            if (secondKeywords && Array.isArray(secondKeywords) && secondKeywords.length > 0) {
                e.addFields({ name: 'Back Face Keywords', value: secondKeywords.join(', '), inline: false });
            }
            if (secondPower != null || secondToughness != null) {
                e.addFields({ name: 'Back Face Power / Toughness', value: `${secondPower || '?'} / ${secondToughness || '?'}`, inline: true });
            }
        }
    } else {
        const image = getImageUrl(card, 'normal');
        if (image) {
            const e = new EmbedBuilder()
                .setTitle(`${card.name}`)
                .setImage(image)
                .setColor('#0099ff')
                .setFooter({ text: `${card.set_name} • ${card.rarity}` });
            embeds.push(e);
        }
    }

    // If no images found, fallback to text embed
    if (embeds.length === 0) return [await getCardTextEmbed(card, client)];

    return embeds;
}

async function getCardPriceEmbed(card, client) {
    const prices = card.prices || {};
    const priceData = {
        usd: prices.usd,
        usd_foil: prices.usd_foil,
    };

    let priceText = '';

    if (priceData.usd) priceText += `USD: $${priceData.usd}\n`;
    if (priceData.usd_foil) priceText += `USD Foil: $${priceData.usd_foil}\n`;

    if (!priceText) {
        priceText = 'No price data available';
    }

    const embed = new EmbedBuilder()
        .setTitle(`${card.name} - Pricing`)
        .setDescription(priceText)
        .setColor('#00aa00')
        .setFooter({ text: `${card.set_name} • Prices may vary by seller` });

    const thumb = getImageUrl(card, 'normal');
    if (thumb) embed.setThumbnail(thumb);

    return embed;
}

async function getCardRulesEmbed(card, client) {
    let rulesText = '';

    if (Array.isArray(card.card_faces) && card.card_faces.length > 1) {
        for (const face of card.card_faces) {
            const faceLabel = face.name || '';
            const otext = face.oracle_text;
            const ptext = face.printed_text;
            const keywords = face.keyword_abilities || face.keywords;

            if (otext) rulesText += `**${faceLabel}:**\n${formatManaSymbols(otext, client)}\n\n`;
            if (ptext) rulesText += `**${faceLabel} (Printed):**\n${formatManaSymbols(ptext, client)}\n\n`;
            if (Array.isArray(keywords) && keywords.length > 0) {
                rulesText += `**${faceLabel} Keywords:**\n${keywords.join(', ')}\n\n`;
            }
        }
    } else {
        const otext = getCardProp(card, 'oracle_text');
        if (otext) {
            rulesText += `**Oracle Text:**\n${formatManaSymbols(otext, client)}\n\n`;
        }

        const ptext = getCardProp(card, 'printed_text');
        if (ptext) {
            rulesText += `**Printed Text:**\n${formatManaSymbols(ptext, client)}\n\n`;
        }

        const keywords = getCardProp(card, 'keyword_abilities') || getCardProp(card, 'keywords');
        if (Array.isArray(keywords) && keywords.length > 0) {
            rulesText += `**Keywords:**\n${keywords.join(', ')}\n\n`;
        }
    }

    if (card.all_parts && card.all_parts.length > 1) {
        rulesText += `**Card Parts:**\n${card.all_parts.map(p => `• ${p.name} (${p.type_line})`).join('\n')}\n`;
    }

    if (!rulesText) {
        rulesText = 'No rules text available for this card.';
    }

    const embed = new EmbedBuilder()
        .setTitle(`${card.name} - Rules`)
        .setDescription(rulesText)
        .setColor('#9933ff')
        .setFooter({ text: `${card.set_name} • ${getCardProp(card, 'type_line')}` });

    const thumb2 = getImageUrl(card, 'normal');
    if (thumb2) embed.setThumbnail(thumb2);

    return embed;
}

async function getCardLegalityEmbed(card, client) {
    const legality = card.legalities || {};

    const formats = [
        'standard',
        'future',
        'historic',
        'timeless',
        'gladiator',
        'pioneer',
        'explorer',
        'modern',
        'legacy',
        'pauper',
        'vintage',
        'penny',
        'commander',
        'oathbreaker',
        'brawl',
        'historicbrawl',
        'alchemy',
        'paupercommander',
        'duel',
        'oldschool',
        'premodern',
        'predh'
    ];

    let legalityText = '';

    for (const format of formats) {
        if (legality[format]) {
            const status = legality[format];
            legalityText += `${getLegalityEmoji(status)} **${format.charAt(0).toUpperCase() + format.slice(1)}**: ${status}\n`;
        }
    }

    if (!legalityText) {
        legalityText = 'No legality information available.';
    }

    const embed = new EmbedBuilder()
        .setTitle(`${card.name} - Format Legality`)
        .setDescription(legalityText)
        .setColor('#ff6600')
        .setFooter({ text: `${card.set_name} • Check your local tournament rules` });

    const thumb = getImageUrl(card, 'normal');
    if (thumb) embed.setThumbnail(thumb);

    return embed;
}

module.exports.getCardImageEmbed = getCardImageEmbed;
module.exports.getCardTextEmbed = getCardTextEmbed;
module.exports.getCardPriceEmbed = getCardPriceEmbed;
module.exports.getCardRulesEmbed = getCardRulesEmbed;
module.exports.getCardLegalityEmbed = getCardLegalityEmbed;
