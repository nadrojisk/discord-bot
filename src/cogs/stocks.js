const { EmbedBuilder } = require('discord.js');

async function getStockQuote(symbol) {
    try {
        const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbol)}`;
        const resp = await fetch(url);
        const data = await resp.json();
        const quote = data?.quoteResponse?.result?.[0];
        return quote || null;
    } catch (err) {
        return null;
    }
}

async function stockCommand(interaction) {
    const symbol = (interaction.options.getString('symbol') || '').toUpperCase();
    if (!symbol)
        return interaction.reply({ content: 'Please provide a stock symbol.', ephemeral: true });

    const q = await getStockQuote(symbol);
    if (!q)
        return interaction.reply({ content: 'Could not fetch stock data.', ephemeral: true });

    const embed = new EmbedBuilder()
        .setTitle(`Stock: ${q.longName || q.symbol}`)
        .addFields(
            { name: 'Price', value: `$${q.regularMarketPrice}`, inline: true },
            { name: 'Change', value: `${q.regularMarketChange} (${q.regularMarketChangePercent}%)`, inline: true },
            { name: 'Previous Close', value: `$${q.regularMarketPreviousClose}`, inline: true },
        )
        .setColor(0x00ff00);

    await interaction.reply({ embeds: [embed] }).catch(() => {});
}

module.exports = {
    commands: { stock: stockCommand },
    slash: {
        stock: {
            name: 'stock',
            description: 'Retrieve stock info',
            options: [{ name: 'symbol', description: 'stock symbol', type: 3, required: true }],
        },
    },
};
