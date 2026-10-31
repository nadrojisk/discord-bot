const POKEMON_TYPES = {
    NORMAL: 'Normal',
    FIGHTING: 'Fighting',
    FLYING: 'Flying',
    POISON: 'Poison',
    GROUND: 'Ground',
    ROCK: 'Rock',
    BUG: 'Bug',
    GHOST: 'Ghost',
    STEEL: 'Steel',
    FIRE: 'Fire',
    WATER: 'Water',
    GRASS: 'Grass',
    ELECTRIC: 'Electric',
    PSYCHIC: 'Psychic',
    ICE: 'Ice',
    DRAGON: 'Dragon',
    DARK: 'Dark',
    FAIRY: 'Fairy',
};

const TYPE_EFFECTIVENESS = {
    [POKEMON_TYPES.NORMAL]: {
        effectiveAgainst: [POKEMON_TYPES.GHOST],
        notEffectiveAgainst: [POKEMON_TYPES.ROCK],
    },
    [POKEMON_TYPES.FIGHTING]: {
        effectiveAgainst: [POKEMON_TYPES.NORMAL, POKEMON_TYPES.ROCK, POKEMON_TYPES.STEEL, POKEMON_TYPES.ICE, POKEMON_TYPES.DARK],
        notEffectiveAgainst: [POKEMON_TYPES.POISON, POKEMON_TYPES.FLYING, POKEMON_TYPES.PSYCHIC, POKEMON_TYPES.BUG, POKEMON_TYPES.FAIRY],
    },
    // Add more types and their effectiveness as needed
};

module.exports = { POKEMON_TYPES, TYPE_EFFECTIVENESS };