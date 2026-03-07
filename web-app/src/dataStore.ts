import { GameMode } from './types';

export const loadDataset = async (mode: GameMode): Promise<any[]> => {
    try {
        const response = await fetch(`/data/${mode.toLowerCase()}.json`);
        if (!response.ok) throw new Error(`Failed to load ${mode} data`);
        return await response.json();
    } catch (error) {
        console.error("Data load error:", error);
        // Fallback for character.json vs anime mode naming
        if (mode === 'Anime') {
            const resp = await fetch('/data/character.json');
            return await resp.json();
        }
        return [];
    }
};

// Full metadata lists to power UI dropdowns without loading the entire 1.2MB dataset
export const SERIES_LISTS: Record<GameMode, string[]> = {
    Anime: ["86", "AOT", "Akame ga Kill", "Assassination Classroom", "Black Butler", "Black Clover", "Bleach", "Blue Lock", "Boruto", "Bungo Stray Dogs", "Chainsaw Man", "Code Geass", "Cowboy Bebop", "Danganronpa", "Death Note", "Demon Slayer", "Detective Conan", "Digimon", "Dr. Stone", "Dragon Ball", "Fairy Tail", "Fate", "Fire Force", "Food Wars", "Fullmetal Alchemist", "Gintama", "Haikyuu", "Hellsing", "High School DxD", "Hunter x Hunter", "Inuyasha", "Jojo's Bizarre Adventure", "Jujutsu Kaisen", "Kaguya-sama", "Kill la Kill", "Kingdom", "Konosuba", "Kuroko no Basket", "Magi", "Mob Psycho 100", "Mushoku Tensei", "My Hero Academia", "Nanatsu no Taizai", "Naruto", "Neon Genesis Evangelion", "No Game No Life", "One Piece", "One Punch Man", "Overlord", "Oshi No Ko", "Persona", "Psycho-Pass", "Re:Zero", "Record of Ragnarok", "Reincarnated as a Slime", "Rurouni Kenshin", "SMT", "Sailor Moon", "Saint Seiya", "Seven Deadly Sins", "Shadow Eminence", "Shaman King", "Shield Hero", "Solo Leveling", "Soul Eater", "Spy x Family", "Steins;Gate", "Sword Art Online", "Tokyo Ghoul", "Toriko", "Trigun", "Vinland Saga", "World Trigger", "Yu-Gi-Oh", "YuYu Hakusho"],
    Marvel: ["Avengers", "Bat-Family", "Fantastic Four", "Guardian of the Galaxy", "Justice League", "Spider-Man", "Static Shock", "Teen Titans", "X-Men"],
    Pokemon: ["Alola", "Galar", "Hoenn", "Johto", "Kalos", "Kanto", "Paldea", "Sinnoh", "Unova"]
};

// Common series for Bot matches
export const BOT_SERIES_ANIME = ["One Piece", "Naruto", "Dragon Ball", "Jujutsu Kaisen", "Bleach", "Attack on Titan", "Demon Slayer", "My Hero Academia"];
export const BOT_REGIONS_POKEMON = ["Kanto", "Johto", "Hoenn", "Sinnoh", "Unova", "Kalos"];
