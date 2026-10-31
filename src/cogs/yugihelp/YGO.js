// Function to retrieve card data
class YGO {
    constructor() {
        this.endpoint = 'https://db.ygoprodeck.com/api/v7/cardinfo.php';
        this.cache = {};
    }

    searchCache(query) {
        return this.cache[query] || null;
    }

    async request(queryType, query) {
        const url = `${this.endpoint}?${queryType}=${encodeURIComponent(query)}`;
        try {
            const resp = await fetch(url);
            if (resp.ok) return await resp.json();
        } catch (err) {
            return null;
        }
        return null;
    }

    async search(queryType, query) {
        const cached = this.searchCache(query);
        if (cached) return { data: [cached] };
        const cards = await this.request(queryType, query);
        if (cards && cards.data) {
            for (const card of cards.data) this.cache[card.name] = card;
            return cards;
        }
        return {};
    }
}

const ygo = new YGO();

module.exports = ygo;