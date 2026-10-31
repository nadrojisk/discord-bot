#!/usr/bin/env node
/*
  Usage:
    node scripts/slash-commands-admin.js list
    node scripts/slash-commands-admin.js clear-global --force
    node scripts/slash-commands-admin.js clear-guild --force
    node scripts/slash-commands-admin.js prune --force

  Environment variables:
    DISCORD_TOKEN, APP_ID (or CLIENT_ID), optional GUILD_ID

  prune --force will keep one command per name (prefer guild command if present)
*/
require('dotenv').config();
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v10');

const token = process.env.DISCORD_TOKEN;
const appId = process.env.APP_ID || process.env.CLIENT_ID || process.env.DISCORD_APP_ID;
const guildId = process.env.GUILD_ID || null;

if (!token || !appId) {
    console.error('DISCORD_TOKEN and APP_ID are required in environment');
    process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(token);

async function listCommands() {
    const global = await rest.get(Routes.applicationCommands(appId));
    const guild = guildId ? await rest.get(Routes.applicationGuildCommands(appId, guildId)) : [];

    console.log(`Global commands: ${global.length}`);
    for (const c of global) console.log(`  [G] ${c.name}  id=${c.id}`);
    if (guildId) {
        console.log(`Guild (${guildId}) commands: ${guild.length}`);
        for (const c of guild) console.log(`  [L] ${c.name}  id=${c.id}`);
    }

    // detect duplicates by name across both sets
    const byName = new Map();
    for (const c of global) {
        const a = byName.get(c.name) || [];
        a.push({ scope: 'global', id: c.id });
        byName.set(c.name, a);
    }
    for (const c of (guild || [])) {
        const a = byName.get(c.name) || [];
        a.push({ scope: 'guild', id: c.id });
        byName.set(c.name, a);
    }

    const duplicates = [];
    for (const [name, arr] of byName.entries()) if (arr.length > 1) duplicates.push({ name, arr });
    if (duplicates.length) {
        console.log('\nDuplicates detected:');
        for (const d of duplicates) console.log(`  ${d.name}: ${d.arr.map(x => `${x.scope}:${x.id}`).join(', ')}`);
    } else {
        console.log('\nNo duplicate command names detected across global/guild scopes.');
    }
}

async function clearGlobal(force) {
    const global = await rest.get(Routes.applicationCommands(appId));
    if (!global.length) return console.log('No global commands to clear');
    if (!force) return console.log('Would clear global commands:', global.map(c => c.name).join(', '), '\nRun with --force to actually delete');
    for (const c of global) {
        try {
            await rest.delete(Routes.applicationCommand(appId, c.id));
            console.log('Deleted global', c.name, c.id);
        } catch (err) {
            console.error('Failed deleting global', c.name, c.id, err && err.message ? err.message : err);
        }
    }
}

async function clearGuild(force) {
    if (!guildId) return console.log('GUILD_ID not set; cannot clear guild commands');
    const guild = await rest.get(Routes.applicationGuildCommands(appId, guildId));
    if (!guild.length) return console.log('No guild commands to clear');
    if (!force) return console.log('Would clear guild commands:', guild.map(c => c.name).join(', '), '\nRun with --force to actually delete');
    for (const c of guild) {
        try {
            await rest.delete(Routes.applicationGuildCommand(appId, guildId, c.id));
            console.log('Deleted guild', c.name, c.id);
        } catch (err) {
            console.error('Failed deleting guild', c.name, c.id, err && err.message ? err.message : err);
        }
    }
}

async function pruneDuplicates(force) {
    const global = await rest.get(Routes.applicationCommands(appId));
    const guild = guildId ? await rest.get(Routes.applicationGuildCommands(appId, guildId)) : [];
    // group by name, prefer keeping guild command if present
    const groups = new Map();
    for (const c of global) groups.set(c.name, (groups.get(c.name) || []).concat({ scope: 'global', id: c.id }));
    for (const c of (guild || [])) groups.set(c.name, (groups.get(c.name) || []).concat({ scope: 'guild', id: c.id }));

    for (const [name, arr] of groups.entries()) {
        if (arr.length <= 1) continue;
        // choose keeper: any guild command first, else first global
        const keeper = arr.find(x => x.scope === 'guild') || arr[0];
        const toDelete = arr.filter(x => !(x.scope === keeper.scope && x.id === keeper.id));
        console.log(`Pruning '${name}': keeping ${keeper.scope}:${keeper.id}, deleting ${toDelete.map(x => x.scope + ':' + x.id).join(', ')}`);
        if (!force) continue;
        for (const d of toDelete) {
            try {
                if (d.scope === 'guild') await rest.delete(Routes.applicationGuildCommand(appId, guildId, d.id));
                else await rest.delete(Routes.applicationCommand(appId, d.id));
                console.log('Deleted', d.scope, d.id);
            } catch (err) {
                console.error('Failed deleting', d.scope, d.id, err && err.message ? err.message : err);
            }
        }
    }
}

async function main() {
    const cmd = (process.argv[2] || 'list').toLowerCase();
    const force = process.argv.includes('--force');
    try {
        if (cmd === 'list') await listCommands();
        else if (cmd === 'clear-global') await clearGlobal(force);
        else if (cmd === 'clear-guild') await clearGuild(force);
        else if (cmd === 'prune') await pruneDuplicates(force);
        else {
            console.log('Unknown command. Usage: list | clear-global | clear-guild | prune');
        }
    } catch (err) {
        console.error('Error:', err && err.message ? err.message : err);
    }
}

main();
