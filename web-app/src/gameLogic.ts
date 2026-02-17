import { Character, GameMode } from "./types";

export const ANIME_ROLES = ["Captain", "Vice Captain", "Tank", "Healer", "Assassin", "Support 1", "Support 2", "Traitor"];
export const MARVEL_ROLES = ["Paragon", "Genius", "Powerhouse", "Mystic", "Street Level", "Cosmic", "Trickster", "Herald"];
export const POKEMON_ROLES = ["HP", "Atk", "Def", "SpA", "SpD", "Spe", "Type"];

export const getRolesForMode = (mode: GameMode) => {
    if (mode === "Anime") return ANIME_ROLES;
    if (mode === "Marvel") return MARVEL_ROLES;
    if (mode === "Pokemon") return POKEMON_ROLES;
    return ANIME_ROLES;
};

const ANIME_MATCHUPS = [
    { r1: "Captain", r2: "Captain", pts: 30 },
    { r1: "Vice Captain", r2: "Vice Captain", pts: 25 },
    { r1: "Tank", r2: "Tank", pts: 15 },
    { r1: "Support 1", r2: "Support 1", pts: 10 },
    { r1: "Support 2", r2: "Support 2", pts: 10 },
    { r1: "Assassin", r2: "Healer", pts: 20 },
    { r1: "Healer", r2: "Assassin", pts: 20 },
];

const MARVEL_MATCHUPS = [
    { r1: "Paragon", r2: "Paragon", pts: 30 },
    { r1: "Genius", r2: "Genius", pts: 25 },
    { r1: "Powerhouse", r2: "Powerhouse", pts: 20 },
    { r1: "Cosmic", r2: "Cosmic", pts: 20 },
    { r1: "Mystic", r2: "Mystic", pts: 15 },
    { r1: "Street Level", r2: "Street Level", pts: 10 },
    { r1: "Herald", r2: "Herald", pts: 15 },
    { r1: "Trickster", r2: "Trickster", pts: 10 },
];

const TYPE_CHART: Record<string, Record<string, number>> = {
    'Normal': { 'Rock': 0.5, 'Ghost': 0, 'Steel': 0.5 },
    'Fire': { 'Fire': 0.5, 'Water': 0.5, 'Grass': 2, 'Ice': 2, 'Bug': 2, 'Rock': 0.5, 'Dragon': 0.5, 'Steel': 2 },
    'Water': { 'Fire': 2, 'Water': 0.5, 'Grass': 0.5, 'Ground': 2, 'Rock': 2, 'Dragon': 0.5 },
    'Electric': { 'Water': 2, 'Electric': 0.5, 'Grass': 0.5, 'Ground': 0, 'Flying': 2, 'Dragon': 0.5 },
    'Grass': { 'Fire': 0.5, 'Water': 2, 'Grass': 0.5, 'Poison': 0.5, 'Ground': 2, 'Flying': 0.5, 'Bug': 0.5, 'Rock': 2, 'Dragon': 0.5, 'Steel': 0.5 },
    'Ice': { 'Fire': 0.5, 'Water': 0.5, 'Grass': 2, 'Ice': 0.5, 'Ground': 2, 'Flying': 2, 'Dragon': 2, 'Steel': 0.5 },
    'Fighting': { 'Normal': 2, 'Ice': 2, 'Poison': 0.5, 'Flying': 0.5, 'Psychic': 0.5, 'Bug': 0.5, 'Rock': 2, 'Ghost': 0, 'Dark': 2, 'Steel': 2, 'Fairy': 0.5 },
    'Poison': { 'Grass': 2, 'Poison': 0.5, 'Ground': 0.5, 'Rock': 0.5, 'Ghost': 0.5, 'Steel': 0, 'Fairy': 2 },
    'Ground': { 'Fire': 2, 'Electric': 2, 'Grass': 0.5, 'Poison': 2, 'Flying': 0, 'Bug': 0.5, 'Rock': 2, 'Steel': 2 },
    'Flying': { 'Electric': 0.5, 'Grass': 2, 'Fighting': 2, 'Bug': 2, 'Rock': 0.5, 'Steel': 0.5 },
    'Psychic': { 'Fighting': 2, 'Poison': 2, 'Psychic': 0.5, 'Dark': 0, 'Steel': 0.5 },
    'Bug': { 'Fire': 0.5, 'Grass': 2, 'Fighting': 0.5, 'Poison': 0.5, 'Flying': 0.5, 'Psychic': 2, 'Ghost': 0.5, 'Dark': 2, 'Steel': 0.5, 'Fairy': 0.5 },
    'Rock': { 'Fire': 2, 'Ice': 2, 'Fighting': 0.5, 'Ground': 0.5, 'Flying': 2, 'Bug': 2, 'Steel': 0.5 },
    'Ghost': { 'Normal': 0, 'Psychic': 2, 'Ghost': 2, 'Dark': 0.5 },
    'Dragon': { 'Dragon': 2, 'Steel': 0.5, 'Fairy': 0 },
    'Dark': { 'Psychic': 2, 'Ghost': 2, 'Dark': 0.5, 'Fighting': 0.5, 'Fairy': 0.5 },
    'Steel': { 'Ice': 2, 'Rock': 2, 'Fairy': 2, 'Fire': 0.5, 'Water': 0.5, 'Electric': 0.5, 'Steel': 0.5 },
    'Fairy': { 'Fighting': 2, 'Dragon': 2, 'Dark': 2, 'Fire': 0.5, 'Poison': 0.5, 'Steel': 0.5 }
};

const getBestMultiplier = (attackerTypes: string[], defenderTypes: string[]) => {
    let bestMult = -1;
    attackerTypes.forEach(atk => {
        let currentMult = 1.0;
        defenderTypes.forEach(def => {
            currentMult *= (TYPE_CHART[atk]?.[def] ?? 1.0);
        });
        if (currentMult > bestMult) bestMult = currentMult;
    });
    return (bestMult === -1) ? 1.0 : bestMult;
};

const calculatePokemonDamage = (atk: number, def: number, multiplier: number) => {
    const damage = (((((2 * 100 / 5) + 2) * 50 * (atk / def)) / 50) + 2) * 1.0 * multiplier;
    return Math.max(1, Math.floor(damage));
};

export const calculateBattle = (
    mode: GameMode,
    p1Team: Record<string, Character | null>,
    p2Team: Record<string, Character | null>,
    p1Name: string,
    p2Name: string
) => {
    let s1 = 0;
    let s2 = 0;
    const log: string[] = [];

    if (mode === "Anime" || mode === "Marvel") {
        const matchups = mode === "Anime" ? ANIME_MATCHUPS : MARVEL_MATCHUPS;
        const statKeyMap: Record<string, string> = mode === "Anime"
            ? { "Captain": "captain", "Vice Captain": "vice_captain", "Tank": "tank", "Healer": "healer", "Assassin": "assassin", "Support 1": "support", "Support 2": "support", "Traitor": "traitor" }
            : { "Paragon": "paragon", "Genius": "genius", "Powerhouse": "powerhouse", "Mystic": "mystic", "Street Level": "street_level", "Cosmic": "cosmic", "Trickster": "trickster", "Herald": "herald" };

        matchups.forEach(({ r1, r2, pts }) => {
            const c1 = p1Team[r1];
            const c2 = p2Team[r2];
            if (c1 && c2) {
                let v1 = c1.stats[statKeyMap[r1]] || 50;
                let v2 = c2.stats[statKeyMap[r2]] || 50;
                let details = "";

                if (mode === "Anime") {
                    if (r1 === "Assassin" && r2 === "Healer") {
                        v2 = Math.floor(v2 * 2.3);
                        details = " (Assassin vs Healer Bonus Applied)";
                    }
                    if (r1 === "Healer" && r2 === "Assassin") {
                        v1 = Math.floor(v1 * 2.3);
                        details = " (Healer vs Assassin Bonus Applied)";
                    }
                }

                if (v1 > v2) {
                    s1 += pts;
                    log.push(`${r1}: 🔵 ${c1.name} (${v1}) defeated 🔴 ${c2.name} (${v2})${details} (+${pts} pts)`);
                }
                else if (v2 > v1) {
                    s2 += pts;
                    log.push(`${r1}: 🔴 ${c2.name} (${v2}) defeated 🔵 ${c1.name} (${v1})${details} (+${pts} pts)`);
                }
                else log.push(`${r1}: ${c1.name} vs ${c2.name} (${v1} vs ${v2}) -> Draw`);
            }
        });

        if (mode === "Anime") {
            ["p1", "p2"].forEach(p => {
                const team = p === "p1" ? p1Team : p2Team;
                const traitor = team["Traitor"];
                const playerName = p === "p1" ? p1Name : p2Name;

                if (traitor) {
                    const betrayalChance = traitor.stats.traitor || 0;
                    if (Math.random() * 100 < betrayalChance) {
                        if (p === "p1") {
                            s1 -= 30;
                            log.push(`🎭 🔵 ${traitor.name} BETRAYED ${playerName}! ${betrayalChance}% betrayal chance triggered (-30 pts)`);
                        }
                        else {
                            s2 -= 30;
                            log.push(`🎭 🔴 ${traitor.name} BETRAYED ${playerName}! ${betrayalChance}% betrayal chance triggered (-30 pts)`);
                        }
                    } else {
                        log.push(`🎭 ${p === "p1" ? "🔵" : "🔴"} ${traitor.name} stayed loyal to ${playerName} (${betrayalChance}% betrayal chance ignored)`);
                    }
                }
            });
        } else {
            ["p1", "p2"].forEach(p => {
                const team = p === "p1" ? p1Team : p2Team;
                const trickster = team["Trickster"];
                const opponentName = p === "p1" ? p2Name : p1Name;

                if (trickster) {
                    const power = trickster.stats.trickster || 0;
                    if (power >= 90) {
                        if (p === "p1") {
                            s1 += 10; s2 = Math.max(0, s2 - 10);
                            log.push(`🃏 🔵 ${trickster.name} (Trickster Power: ${power}) STOLE 10 pts from ${opponentName}!`);
                        }
                        else {
                            s2 += 10; s1 = Math.max(0, s1 - 10);
                            log.push(`🃏 🔴 ${trickster.name} (Trickster Power: ${power}) STOLE 10 pts from ${opponentName}!`);
                        }
                    }
                }
            });
        }
    } else if (mode === "Pokemon") {
        const h1 = p1Team["HP"]?.stats.hp || 100;
        const h2 = p2Team["HP"]?.stats.hp || 100;
        const n1 = p1Team["HP"]?.name || "P1 HP";
        const n2 = p2Team["HP"]?.name || "P2 HP";

        log.push(`❤️ HP Clash: 🔵 ${n1} (${h1} HP) vs 🔴 ${n2} (${h2} HP)`);
        if (h1 > h2) { s1 += 1; log.push(`   -> 🔵 Point for ${p1Name}`); }
        else if (h2 > h1) { s2 += 1; log.push(`   -> 🔴 Point for ${p2Name}`); }
        else log.push(`   -> Push`);

        const t1 = p1Team["Type"];
        const t2 = p2Team["Type"];
        if (t1 && t2) {
            const types1 = t1.types || [];
            const types2 = t2.types || [];

            // Physical
            const atk1 = p1Team["Atk"]?.stats.attack || 50;
            const def2 = p2Team["Def"]?.stats.defense || 50;
            const atk2 = p2Team["Atk"]?.stats.attack || 50;
            const def1 = p1Team["Def"]?.stats.defense || 50;

            const mult1P = getBestMultiplier(types1, types2);
            const mult2P = getBestMultiplier(types2, types1);

            const dmg1P = calculatePokemonDamage(atk1, def2, mult1P);
            const dmg2P = calculatePokemonDamage(atk2, def1, mult2P);

            const turns1P = Math.ceil(h2 / (dmg1P || 1));
            const turns2P = Math.ceil(h1 / (dmg2P || 1));

            log.push(`⚔️ Physical: 🔵 ${p1Team["Atk"]?.name} (${dmg1P} dmg) vs 🔴 ${p2Team["Atk"]?.name} (${dmg2P} dmg)`);

            if (turns1P < turns2P) {
                s1 += 1;
                log.push(`   -> 🔵 ${p1Name} wins in ${turns1P} hits (vs ${turns2P})`);
            }
            else if (turns2P < turns1P) {
                s2 += 1;
                log.push(`   -> 🔴 ${p2Name} wins in ${turns2P} hits (vs ${turns1P})`);
            }
            else {
                const spe1 = p1Team["Spe"]?.stats.speed || 0;
                const spe2 = p2Team["Spe"]?.stats.speed || 0;
                if (spe1 > spe2) { s1 += 1; log.push(`   -> 🔵 ${p1Name} wins by Speed (${spe1} vs ${spe2})`); }
                else if (spe2 > spe1) { s2 += 1; log.push(`   -> 🔴 ${p2Name} wins by Speed (${spe2} vs ${spe1})`); }
                else log.push(`   -> Double KO (No points)`);
            }

            // Special
            const spa1 = p1Team["SpA"]?.stats["special-attack"] || 50;
            const spd2 = p2Team["SpD"]?.stats["special-defense"] || 50;
            const spa2 = p2Team["SpA"]?.stats["special-attack"] || 50;
            const spd1 = p1Team["SpD"]?.stats["special-defense"] || 50;

            const mult1S = getBestMultiplier(types1, types2);
            const mult2S = getBestMultiplier(types2, types1);

            const dmg1S = calculatePokemonDamage(spa1, spd2, mult1S);
            const dmg2S = calculatePokemonDamage(spa2, spd1, mult2S);

            const turns1S = Math.ceil(h2 / (dmg1S || 1));
            const turns2S = Math.ceil(h1 / (dmg2S || 1));

            log.push(`🔮 Special: 🔵 ${p1Team["SpA"]?.name} (${dmg1S} dmg) vs 🔴 ${p2Team["SpA"]?.name} (${dmg2S} dmg)`);

            if (turns1S < turns2S) {
                s1 += 1;
                log.push(`   -> 🔵 ${p1Name} wins in ${turns1S} hits (vs ${turns2S})`);
            }
            else if (turns2S < turns1S) {
                s2 += 1;
                log.push(`   -> 🔴 ${p2Name} wins in ${turns2S} hits (vs ${turns1S})`);
            }
            else {
                const spe1 = p1Team["Spe"]?.stats.speed || 0;
                const spe2 = p2Team["Spe"]?.stats.speed || 0;
                if (spe1 > spe2) { s1 += 1; log.push(`   -> 🔵 ${p1Name} wins by Speed (${spe1} vs ${spe2})`); }
                else if (spe2 > spe1) { s2 += 1; log.push(`   -> 🔴 ${p2Name} wins by Speed (${spe2} vs ${spe1})`); }
                else log.push(`   -> Double KO (No points)`);
            }
        }
    }

    return { s1, s2, log };
};
