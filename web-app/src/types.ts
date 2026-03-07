export type GameMode = "Anime" | "Marvel" | "Pokemon";

export interface AnimeStats {
  captain: number;
  vice_captain: number;
  tank: number;
  healer: number;
  assassin: number;
  support: number;
  traitor: number;
}

export interface MarvelStats {
  paragon: number;
  genius: number;
  powerhouse: number;
  mystic: number;
  street_level: number;
  cosmic: number;
  trickster: number;
  herald: number;
}

export interface PokemonStats {
  hp: number;
  attack: number;
  defense: number;
  "special-attack": number;
  "special-defense": number;
  speed: number;
}

export interface Character {
  name: string;
  series?: string;
  region?: string; // For Pokemon
  types?: string[]; // For Pokemon
  stats: any; // Using any for stats flexibility across modes
  img: string;
}

export type Role = string; // Flexible roles based on mode

export interface Player {
  name: string;
  team: Record<string, Character | null>;
  skips: number;
}

export interface SetupConfig {
  mode: GameMode;
  series: string | null;
}

export interface GameState {
  config: SetupConfig;
  p1: Player;
  p2: Player;
  turn: "p1" | "p2";
  currentDraw: Character | null;
  nextDraws: Character[];
  turnStartTime: number;
  status: "setup" | "waiting_for_player" | "matchmaking" | "drafting" | "ready" | "battle" | "finished";
  winner: string | null;
  p1Score?: number;
  p2Score?: number;
  p1Misses: number;
  p2Misses: number;
  battleLog: string[];
}

export type PlayerRole = "p1" | "p2" | null;

export interface Room {
  id: string;
  host: string;
  hostId: string;
  hostPhotoURL?: string | null;
  guest: string | null;
  guestId?: string | null;
  guestPhotoURL?: string | null;
  gameState: GameState;
  createdAt: number;
  isPublic: boolean;
  intendedPublic?: boolean;
  latestEmoji?: {
    senderId: string;
    emoji: string;
    timestamp: number;
  } | null;
  chat?: {
    senderId: string;
    senderName: string;
    text: string;
    timestamp: number;
  }[];
}

