const fs = require('fs');
const path = require('path');

const { version: pkgVersion } = require('../../package.json');

async function changelogCommand(interaction) {
    const versionArg = interaction.options.getString('version') || 'latest';
    const changelogPath = path.join(process.cwd(), 'CHANGELOG.md');
    let text = '';
    try {
        text = fs.readFileSync(changelogPath, 'utf8');
    } catch (err) {
        return interaction.reply({ content: 'Changelog not found', ephemeral: true });
    }

    const index = text.indexOf('## Unreleased');
    text = index >= 0 ? text.slice(index) : text;

    if (/latest/i.test(versionArg)) {
        const parts = text.split('## [');
        if (parts.length > 1) text = '[' + parts[1];
    } else if (/unreleased/i.test(versionArg)) {
        text = text.split('## [')[0];
    } else {
        const start = text.indexOf('[' + versionArg + ']');
        if (start >= 0) {
            text = text.slice(start);
            const end = text.indexOf('\n## ');
            if (end >= 0) text = text.slice(0, end);
        }
    }

    let output = '';
    for (const line of text.split('\n')) {
        if (line.trim()) {
            let l = line;
            if (!l.includes('[')) l = l.replace('-', '\t\t-');
            l = l.replace('###', '\t').replace('#', '');
            output += l + '\n';
        }
    }

    await interaction.reply({ content: output }).catch(() => {});
}

async function warnCommand(interaction) {
    const userToWarn = interaction.options.getString('user') || '';
    const out = `Dude, you better STOP ${userToWarn} <:zachangry:1431073898556030997>`;
    await interaction.reply({ content: out }).catch(() => {});
}

async function versionCommand(interaction) {
    await interaction.reply({ content: `v${pkgVersion}` }).catch(() => {});
}

module.exports = {
    commands: {
        changelog: changelogCommand,
        warn: warnCommand,
        version: versionCommand,
    },
    slash: {
        changelog: {
            name: 'changelog',
            description: 'Return bot changelog',
            options: [{ name: 'version', description: 'version|latest|unreleased', type: 3, required: false }],
        },
        warn: {
            name: 'warn',
            description: 'Send a warning message',
            options: [{ name: 'user', description: 'user to warn', type: 3, required: true }],
        },
        version: { name: 'version', description: 'Get current version', options: [] },
    },
};
