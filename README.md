# Discord Bot (JavaScript, Dockerized)

This project is a modular Discord bot written in JavaScript (Node.js, discord.js v14+), featuring slash commands and integrations for card games, Pokémon, dice and more. It is designed for easy deployment using Docker and GitHub Actions.

## Features

- Slash commands for Pokémon, Yu-Gi-Oh!, Magic, dice rolls, stocks, and more
- Modular cog system for easy feature expansion
- Keyword triggers and canned responses loaded from a JSON file you control (`DB_PATH`)
- Dockerized for consistent deployment
- Automated image publishing to GHCR with GitHub Actions

## Project Structure

```
src/
  index.js         # Bot entry point
  database.js      # trigger/response JSON loader
  helpers.js       # Utility functions
  health.js        # /health endpoint
  logger.js
  cogs/            # Feature modules, one slash-command set each
    commands.js
    dungeon.js
    magic.js
    pokemon.js
    stocks.js
    triggers.js
    yugioh.js
    pokehelp/
    yugihelp/
Dockerfile         # Docker build instructions
docker-compose.yml # Local development/deployment
.env               # Environment variables (not committed)
```

## Quick Start (Docker)

1. **Clone the repository:**

   ```sh
   git clone <repository-url>
   cd discord-bots
   ```

2. **Create and edit your .env file:**

   Create a `.env` file in the project root and fill in your Discord and API tokens as environment variables. See below for required variables.

   Example `.env`:

   ```env
   DISCORD_TOKEN=your_discord_token
   APP_ID=your_app_id
   GUILD_ID=your_guild_id
   DB_PATH=/data/db.json   # optional, see Triggers
   ```

3. **Build and run with Docker Compose:**

   ```sh
   docker-compose up --build -d
   ```

   Or build and run manually:

   ```sh
   docker build -t discord-bot .
   docker run --rm --env-file .env discord-bot
   ```

## Triggers and responses

Keyword triggers and their replies come from a JSON file, `{"triggers": {name: [words]}, "responses": {name: [replies]}}`.
By default the bot reads the bundled `db.example.json`; set `DB_PATH` to your own file (for example a bind mount) to use custom
words. A missing or invalid file means no triggers.

## Releases

Bump `version` in `package.json` and add a `CHANGELOG.md` entry, then push to `main`. `.github/workflows/publish.yml` sees that
`v<version>` is not a git tag yet, builds the image, pushes `ghcr.io/nadrojisk/discord-bot:<version>` and creates the tag. A push that
doesn't change the version publishes nothing, and a released version is never overwritten.

## Development

1. Install dependencies:

   ```sh
   npm install
   ```

2. Run locally:

   ```sh
   node src/index.js
   ```

## Contributing

Pull requests and issues are welcome! Please open an issue to discuss major changes.
