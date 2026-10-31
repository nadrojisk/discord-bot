/**
 * Ports the Python Dungeon cog's dice commands.
 */
function roll(num_of_sides, num_of_dice = 1) {
    const results = [];
    for (let i = 0; i < num_of_dice; i++) {
        results.push(Math.floor(Math.random() * num_of_sides) + 1);
    }
    return results.join(', ');
}

function makeDiceCommand(sides) {
    return async (interaction) => {
        const count = interaction.options.getInteger('count') || 1;
        await interaction.reply({ content: roll(sides, count) }).catch(() => {});
    };
}

const commands = {
    d4:  makeDiceCommand(4),
    d6:  makeDiceCommand(6),
    d8:  makeDiceCommand(8),
    d10: makeDiceCommand(10),
    d12: makeDiceCommand(12),
    d20: makeDiceCommand(20),
    d: async (interaction) => {
        const sides = interaction.options.getInteger('sides');
        const count = interaction.options.getInteger('count') || 1;
        if (!sides || sides <= 0)
            return interaction.reply({ content: 'Usage: /d <sides> [count]', ephemeral: true });
        await interaction.reply({ content: roll(sides, count) }).catch(() => {});
    },
};

module.exports = {
    commands,
    slash: [
        { name: 'd4',  description: 'Roll a d4',  options: [{ name: 'count', description: 'number of dice', type: 4, required: false }] },
        { name: 'd6',  description: 'Roll a d6',  options: [{ name: 'count', description: 'number of dice', type: 4, required: false }] },
        { name: 'd8',  description: 'Roll a d8',  options: [{ name: 'count', description: 'number of dice', type: 4, required: false }] },
        { name: 'd10', description: 'Roll a d10', options: [{ name: 'count', description: 'number of dice', type: 4, required: false }] },
        { name: 'd12', description: 'Roll a d12', options: [{ name: 'count', description: 'number of dice', type: 4, required: false }] },
        { name: 'd20', description: 'Roll a d20', options: [{ name: 'count', description: 'number of dice', type: 4, required: false }] },
        { name: 'd', description: 'Roll a die with X sides', options: [
            { name: 'sides', description: 'number of sides', type: 4, required: true },
            { name: 'count', description: 'number of dice', type: 4, required: false },
        ] },
    ],
};
