import { Room, GameMode } from '../types';
import { BOT_SERIES_ANIME, BOT_REGIONS_POKEMON } from '../dataStore';

export const BOT_NAMES = [
    "Shadow", "Nova", "Echo", "Alpha", "Omega", "Blade", "Viper", "Titan", "Rogue", "Ghost",
    "Sniper", "Raven", "Rex", "Leon", "Kira", "Zane", "Sora", "Jin", "Kai", "Ryu",
    "Ken", "King", "Duke", "Maverick", "Phoenix", "Hunter", "Storm", "Blaze", "Frost", "Iron",
    "Atlas", "Zeus", "Ares", "Diana", "Bruce", "Clark", "Arthur", "Barry", "Victor", "Hal",
    "Peter", "Tony", "Steve", "Thor", "Natasha", "Clint", "Wanda", "Vision", "Sam", "Bucky"
];

const imageCache: Record<string, string | null> = {};

export const getDeterministicRoomImage = (
    roomId: string,
    mode: string,
    series: string | null,
    charactersPool: Record<string, any[]>
): string | null => {
    const cacheKey = `${roomId}-${mode}-${series || 'All'}`;
    if (imageCache[cacheKey] !== undefined) return imageCache[cacheKey];

    const modeKey = (mode || 'Anime') as 'Anime' | 'Marvel' | 'Pokemon';
    let pool: any[] = charactersPool[modeKey] || charactersPool.Anime || [];
    if (pool.length === 0) return null;

    if (series && series !== 'All') {
        if (modeKey === 'Pokemon') {
            pool = pool.filter((c: any) => c.region === series);
        } else {
            pool = pool.filter((c: any) => c.series === series);
        }
    }
    if (pool.length === 0) pool = charactersPool.Anime || [];
    if (pool.length === 0) return null;

    let hash = 0;
    for (let i = 0; i < roomId.length; i++) {
        hash = (hash * 31 + roomId.charCodeAt(i)) >>> 0;
    }
    const char = pool[hash % pool.length];

    imageCache[cacheKey] = char?.img || null;
    return imageCache[cacheKey];
};

export const generateRoomCode = () => {
    return Math.random().toString(36).substring(2, 7).toUpperCase();
};

export const generateBotRooms = (initialPlayerFactory: (name: string) => any): Room[] => {
    const bots: Room[] = [];
    const count = Math.floor(Math.random() * 6) + 10;
    const shuffledNames = [...BOT_NAMES].sort(() => 0.5 - Math.random());
    const modes: GameMode[] = ["Anime", "Marvel", "Pokemon"];

    const validAnimeSeries = BOT_SERIES_ANIME;
    const validPokemonRegions = BOT_REGIONS_POKEMON;

    for (let i = 0; i < count; i++) {
        const mode = modes[Math.floor(Math.random() * modes.length)];
        let series = "All";

        if (mode === "Anime") {
            if (Math.random() > 0.5 && validAnimeSeries.length > 0) {
                series = validAnimeSeries[Math.floor(Math.random() * validAnimeSeries.length)] as string;
            }
        } else if (mode === "Pokemon") {
            if (Math.random() > 0.5 && validPokemonRegions.length > 0) {
                series = validPokemonRegions[Math.floor(Math.random() * validPokemonRegions.length)] as string;
            }
        }

        bots.push({
            id: `BOT-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
            host: shuffledNames[i],
            hostId: `BOT_ID_${shuffledNames[i]}`,
            guest: null,
            gameState: {
                config: { mode, series },
                p1: initialPlayerFactory(shuffledNames[i]),
                p2: initialPlayerFactory("Player 2"),
                turn: "p1",
                currentDraw: null,
                nextDraws: [],
                turnStartTime: 0,
                status: "setup",
                winner: null,
                p1Misses: 0,
                p2Misses: 0,
                battleLog: []
            },
            createdAt: Date.now() - Math.floor(Math.random() * 100000),
            isPublic: true,
            intendedPublic: true
        });
    }
    return bots;
};
