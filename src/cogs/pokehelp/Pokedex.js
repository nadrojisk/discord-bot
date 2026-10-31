class Pokedex {
  constructor() {
    this.host = 'https://pokeapi.co/api/v2/pokemon/';
    this.cache = {};
  }

  searchCache(query) {
    return this.cache[query] || null;
  }

  async searchPokemon(query) {
    const cached = this.searchCache(query);
    if (cached) return cached;
    try {
      const url = this.host + encodeURIComponent(query) + '/';
      const resp = await fetch(url);
      const result = await resp.json();
      this.cache[result.name] = result;
      this.cache[String(result.id)] = result;
      return result;
    } catch (err) {
      return null;
    }
  }

  parseTypes(ptype) {
    if (!ptype) return '';
    if (ptype.length === 1) return ptype[0].type.name;
    if (ptype.length === 2)
      return `${ptype[0].type.name}/${ptype[1].type.name}`;
    return '';
  }

  getStats(pokemon, statQuery) {
    for (const stat of pokemon.stats) {
      if (stat.stat.name === statQuery) return String(stat.base_stat);
    }
    return '';
  }

  async searchEvolve(query) {
    // Mirror Python: get pokemon, fetch species and evolution chain, then parse
    const pokemon = await this.searchPokemon(query);
    if (!pokemon) return null;
    try {
      const speciesResp = await fetch(pokemon.species.url);
      const species = await speciesResp.json();
      const evoResp = await fetch(species.evolution_chain.url);
      const evolution = await evoResp.json();
      const chain = evolution.chain;

      const chains = this.getChain(query.toLowerCase(), chain);
      const summaryList = this.getEvolutionSummary(query.toLowerCase(), chains);
      if (!summaryList || !summaryList.length) return null;
      return summaryList.join('\n');
    } catch (err) {
      return null;
    }
  }

  // Helper: follow the chain to the node(s) for the given pokemon
  getChain(pokemonName, chain) {
    if (!chain) return null;
    if (chain.species && chain.species.name === pokemonName)
      return chain.evolves_to || [];
    if (!chain.evolves_to) return null;
    for (const x of chain.evolves_to) {
      const res = this.getChain(pokemonName, x);
      if (res) return res;
    }
    return null;
  }

  // Build human-readable evolution summary list
  getEvolutionSummary(query, chains) {
    const summaries = [];
    if (chains && chains.length) {
      for (const chain of chains) {
        const detailsArr = chain.evolution_details || [];
        for (const details of detailsArr) {
          let summary = `**${this.capitalize(
            query,
          )}** evolves into **${this.capitalize(chain.species.name)}**`;
          const summaryFull = this.evolution_general_req(details, summary);
          if (summaryFull !== summary) summaries.push(summaryFull);
        }
      }
      const filtered = summaries.filter(Boolean);
      if (!filtered.length)
        return [`Go to https://bulbapedia.bulbagarden.net/wiki/${query}`];
      return filtered;
    }
    return [`${this.capitalize(query)} does not evolve.`];
  }

  capitalize(s) {
    if (!s || typeof s !== 'string') return s;
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  evolution_general_req(details, summary) {
    if (!details) return summary;
    const known_move = details.known_move;
    const known_move_type = details.known_move_type;
    const min_affection = details.min_affection;
    const min_beauty = details.min_beauty;
    const min_happiness = details.min_happiness;
    const min_level = details.min_level;
    const needs_overworld_rain = details.needs_overworld_rain;
    const time_of_day = details.time_of_day;
    const held_item = details.held_item;
    const party_species = details.party_species;
    const relative_physical_stats = details.relative_physical_stats;
    const turn_upside_down = details.turn_upside_down;

    const trigger = details.trigger && details.trigger.name;
    if (details.location) return summary;

    const gender = details.gender;
    if (gender) {
      const sex = gender === 2 ? 'male' : 'female';
      summary = `A ${sex} ${summary}`;
    } else if (trigger === 'trade') {
      summary = this.evolution_trade(details, summary);
    } else if (trigger === 'use-item') {
      summary = this.evolution_use_item(details, summary);
    }

    if (min_level) summary += ` at level **${min_level}**`;
    if (min_affection)
      summary += ` with a minimum affection of **${min_affection}**`;
    if (min_beauty) summary += ` with a minimum beauty of **${min_beauty}**`;
    if (min_happiness)
      summary += ` with a minimum happines of **${min_happiness}**`;
    if (time_of_day) summary += ` during the **${time_of_day}**`;
    if (needs_overworld_rain) summary += ' while it is raining';
    if (known_move_type)
      summary += ` while it knows a **${known_move_type.name}** type move`;
    if (known_move) summary += ` while it knows **${known_move.name}**`;
    if (held_item)
      summary += ` while holding a **${held_item.name.replace(/-/g, ' ')}**`;
    if (party_species)
      summary += ` while **${this.capitalize(
        party_species.name,
      )}** is in the party`;

    if (relative_physical_stats === 1)
      summary += ' while its Attack stat is higher than its Defense';
    if (relative_physical_stats === -1)
      summary += ' while its Defense stat is higher than its Attack';
    if (relative_physical_stats === 0)
      summary += ' while its Attack and Defense are the same';
    if (turn_upside_down)
      summary += ' while the game system is held upside-down';
    return summary;
  }

  evolution_trade(details, summary) {
    const trade_species = details.trade_species;
    if (trade_species) {
      const trade = this.capitalize(trade_species.name);
      summary += ` while being traded for a **${trade}**`;
    } else {
      summary += ' by **trading**';
    }
    const held_item = details.held_item;
    if (held_item) {
      const item = held_item.name.replace(/-/g, ' ');
      summary += ` while holding the ${item}`;
    }
    return summary;
  }

  evolution_use_item(details, summary) {
    if (details.item && details.item.name) {
      const item = details.item.name.replace(/-/g, ' ');
      summary += ` by use of the **${item}**`;
    }
    return summary;
  }
}

const pokedex = new Pokedex();

async function getPokedexEntry(name) {
  return await pokedex.searchPokemon(name);
}

async function listAllPokemon() {
  // Not implemented fully; return keys of cache
  return Object.keys(pokedex.cache);
}

module.exports = {
  getPokedexEntry,
  listAllPokemon,
  searchEvolve: (q) => pokedex.searchEvolve(q),
};
