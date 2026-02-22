import animeData from './data/character.json';
import marvelData from './data/marvel.json';
import pokemonData from './data/pokemon.json';
import { GameMode } from './types';

export const datasets: Record<GameMode, any[]> = {
    Anime: animeData,
    Marvel: marvelData,
    Pokemon: pokemonData,
};
