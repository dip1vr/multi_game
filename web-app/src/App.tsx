import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Trash2, Shield, Sword, Heart, UserPlus,
  Target, Crown, Zap, Activity, Search, ChevronDown, Check
} from 'lucide-react';

import { Character, GameState, Player, GameMode } from './types';
import { getRolesForMode, calculateBattle } from './gameLogic';

import animeData from './data/character.json';
import marvelData from './data/marvel.json';
import pokemonData from './data/pokemon.json';

const datasets: Record<GameMode, any[]> = {
  Anime: animeData,
  Marvel: marvelData,
  Pokemon: pokemonData,
};

const INITIAL_PLAYER = (name: string): Player => ({
  name,
  team: {},
  skips: 2,
});

const roleIconsMapping: Record<string, React.ReactNode> = {
  "Captain": <Crown size={18} className="text-amber-400" />,
  "Vice Captain": <Target size={18} className="text-blue-400" />,
  "Tank": <Shield size={18} className="text-emerald-400" />,
  "Healer": <Heart size={18} className="text-rose-400" />,
  "Assassin": <Sword size={18} className="text-purple-400" />,
  "Support 1": <UserPlus size={18} className="text-indigo-400" />,
  "Support 2": <UserPlus size={18} className="text-indigo-400" />,
  "Traitor": <Zap size={18} className="text-yellow-400" />,
  "Paragon": <Crown size={18} className="text-amber-400" />,
  "Genius": <Activity size={18} className="text-blue-400" />,
  "Powerhouse": <Shield size={18} className="text-red-400" />,
  "Mystic": <Zap size={18} className="text-purple-400" />,
  "Street Level": <Sword size={18} className="text-gray-400" />,
  "Cosmic": <Target size={18} className="text-indigo-400" />,
  "Trickster": <Users size={18} className="text-emerald-400" />,
  "Herald": <UserPlus size={18} className="text-cyan-400" />,
  "HP": <Heart size={18} className="text-rose-400" />,
  "Atk": <Sword size={18} className="text-orange-400" />,
  "Def": <Shield size={18} className="text-blue-400" />,
  "SpA": <Zap size={18} className="text-purple-400" />,
  "SpD": <Users size={18} className="text-green-400" />,
  "Spe": <Activity size={18} className="text-cyan-400" />,
  "Type": <Target size={18} className="text-white" />,
};

interface SearchableSelectProps {
  options: string[];
  value: string;
  onChange: (val: string) => void;
  label?: string;
}

const SearchableSelect: React.FC<SearchableSelectProps> = ({ options, value, onChange, label = "Option" }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const filteredOptions = options.filter(opt =>
    opt.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      <label className="block text-xs font-black uppercase tracking-[0.3em] text-gray-500 mb-3">{label}</label>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-black/60 border border-white/10 rounded-xl py-4 px-6 text-left text-gray-300 font-bold flex items-center justify-between group hover:border-purple-500/50 transition-all shadow-lg"
      >
        <span className="truncate">{value}</span>
        <ChevronDown size={20} className={`text-gray-500 transition-transform duration-300 ${isOpen ? 'rotate-180 text-purple-400' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 5, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className="absolute z-50 w-full bg-[#121216] border border-white/10 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-xl"
          >
            <div className="p-3 border-b border-white/5 bg-white/5">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  autoFocus
                  type="text"
                  placeholder="Type to search..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-black/40 border border-white/5 rounded-lg py-2 pl-10 pr-4 text-sm text-gray-200 focus:outline-none focus:border-purple-500/50 transition-colors"
                />
              </div>
            </div>

            <div className="max-h-60 overflow-y-auto custom-scrollbar py-2">
              {filteredOptions.length > 0 ? (
                filteredOptions.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => {
                      onChange(opt);
                      setIsOpen(false);
                      setSearch("");
                    }}
                    className={`w-full text-left px-5 py-3 text-sm flex items-center justify-between transition-colors
                      ${value === opt ? 'bg-purple-600/10 text-purple-400 font-bold' : 'text-gray-400 hover:bg-white/5 hover:text-white'}
                    `}
                  >
                    <span className="truncate">{opt}</span>
                    {value === opt && <Check size={16} />}
                  </button>
                ))
              ) : (
                <div className="px-5 py-8 text-center text-gray-600 text-xs italic">
                  No matches found.
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

interface SetupScreenProps {
  onStart: (mode: GameMode, series: string | null) => void;
}

const SetupScreen: React.FC<SetupScreenProps> = ({ onStart }) => {
  const [mode, setMode] = useState<GameMode>("Anime");
  const [series, setSeries] = useState<string>("All");

  const availableSeriesList = Array.from(new Set(datasets[mode].map((c: any) => mode === "Pokemon" ? c.region : c.series).filter(Boolean))).sort() as string[];
  const finalOptions = ["All", ...availableSeriesList];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-xl mx-auto bg-gray-900/40 backdrop-blur-xl p-8 rounded-3xl border border-white/10 shadow-2xl"
    >
      <h2 className="text-3xl font-black text-center mb-8 italic tracking-tighter">BATTLE CONFIG</h2>

      <div className="space-y-8">
        <div>
          <label className="block text-xs font-black uppercase tracking-[0.3em] text-gray-500 mb-3">Select Mode</label>
          <div className="grid grid-cols-3 gap-3">
            {(["Anime", "Marvel", "Pokemon"] as GameMode[]).map(m => (
              <button
                key={m}
                onClick={() => { setMode(m); setSeries("All"); }}
                className={`py-4 rounded-xl font-bold transition-all border ${mode === m ? 'bg-purple-600 border-purple-400 text-white shadow-[0_0_20px_rgba(147,51,234,0.3)]' : 'bg-white/5 border-white/5 text-gray-400 hover:bg-white/10'}`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        <SearchableSelect
          label="Filter Series/Region"
          options={finalOptions}
          value={series}
          onChange={setSeries}
        />

        <button
          onClick={() => onStart(mode, series)}
          className="w-full py-5 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl font-black text-lg tracking-widest hover:scale-[1.02] transition-transform active:scale-95 shadow-xl text-white mt-4"
        >
          INITIALIZE DRAFT
        </button>
      </div>
    </motion.div>
  );
};

const TeamDisplay: React.FC<{ player: Player; isLeft: boolean; roles: string[] }> = ({ player, isLeft, roles }) => (
  <div className={`flex flex-col gap-3 p-4 bg-gray-900/50 backdrop-blur-md rounded-2xl border ${isLeft ? 'border-blue-500/30' : 'border-red-500/30'} flex-1`}>
    <h2 className={`text-xl font-bold mb-2 flex items-center gap-2 ${isLeft ? 'text-blue-400' : 'text-red-400'}`}>
      <Users size={20} /> {player.name}
    </h2>
    <div className="grid gap-2">
      {roles.map(role => {
        const char = player.team[role];
        return (
          <div key={role} className={`flex items-center justify-between p-2 rounded-lg bg-black/40 border transition-all ${char ? 'border-green-500/20' : 'border-gray-700/30 opacity-60'}`}>
            <div className="flex items-center gap-2">
              <span className="text-gray-400">{roleIconsMapping[role]}</span>
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter">{role}</span>
            </div>
            <span className={`text-sm ${char ? 'text-white font-bold' : 'text-gray-700 italic'} truncate max-w-[100px]`}>
              {char ? char.name : '---'}
            </span>
          </div>
        );
      })}
    </div>
    <div className="mt-2 flex items-center justify-between text-[10px] text-gray-500 uppercase tracking-[0.2em] font-bold">
      <span>Skips Available</span>
      <div className="flex gap-1">
        {[...Array(player.skips)].map((_, i) => <div key={i} className="w-2 h-2 rounded-full bg-rose-500/50"></div>)}
        {[...Array(2 - player.skips)].map((_, i) => <div key={i} className="w-2 h-2 rounded-full bg-gray-800"></div>)}
      </div>
    </div>
  </div>
);

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>({
    config: { mode: "Anime", series: null },
    p1: INITIAL_PLAYER("Player 1"),
    p2: INITIAL_PLAYER("Player 2"),
    turn: "p1",
    currentDraw: null,
    status: "setup",
    winner: null,
    battleLog: [],
  });

  const [pool, setPool] = useState<Character[]>([]);
  const [usedIndices, setUsedIndices] = useState<Set<number>>(new Set());

  const startDraft = (mode: GameMode, series: string | null) => {
    let chars = datasets[mode] as any[];

    if (series && series !== "All") {
      if (mode === "Pokemon") {
        chars = chars.filter(c => c.region === series);
      } else {
        chars = chars.filter(c => c.series === series);
      }
    }

    chars = chars.filter(c => c.stats !== null);

    if (chars.length < 16) {
      alert("Not enough characters available for this filter!");
      return;
    }

    setPool(chars);
    setUsedIndices(new Set());
    setGameState(prev => ({
      ...prev,
      config: { mode, series: series === "All" ? null : series },
      status: "drafting",
      turn: Math.random() > 0.5 ? "p1" : "p2",
    }));
  };

  const drawCharacter = (currentPool: Character[], currentUsed: Set<number>) => {
    if (currentPool.length === 0) return null;
    let index;
    let attempts = 0;
    do {
      index = Math.floor(Math.random() * currentPool.length);
      attempts++;
    } while (currentUsed.has(index) && attempts < 100);

    setUsedIndices(prev => {
      const next = new Set(prev);
      next.add(index);
      return next;
    });
    return currentPool[index];
  };

  useEffect(() => {
    if (gameState.status === "drafting" && !gameState.currentDraw && pool.length > 0) {
      const char = drawCharacter(pool, usedIndices);
      if (char) {
        setGameState(prev => ({ ...prev, currentDraw: char }));
      }
    }
  }, [gameState.status, pool]);

  const roles = getRolesForMode(gameState.config.mode);

  const assignRole = (role: string) => {
    if (!gameState.currentDraw) return;

    const currentPlayerKey = gameState.turn;
    const opponentPlayerKey = gameState.turn === "p1" ? "p2" : "p1";

    const updatedCurrentPlayer = {
      ...gameState[currentPlayerKey],
      team: { ...gameState[currentPlayerKey].team, [role]: gameState.currentDraw },
    };

    const isFinished =
      Object.keys(updatedCurrentPlayer.team).length === roles.length &&
      Object.keys(gameState[opponentPlayerKey].team).length === roles.length;

    setGameState((prev) => {
      const nextTurn = prev.turn === "p1" ? "p2" : "p1";
      const newState: GameState = {
        ...prev,
        [currentPlayerKey]: updatedCurrentPlayer,
        turn: nextTurn,
        currentDraw: null,
      };

      if (isFinished) {
        const { s1, s2, log } = calculateBattle(
          prev.config.mode,
          (currentPlayerKey === "p1" ? updatedCurrentPlayer : prev.p1).team,
          (currentPlayerKey === "p2" ? updatedCurrentPlayer : prev.p2).team,
          prev.p1.name,
          prev.p2.name
        );
        newState.status = "finished";
        newState.winner = s1 > s2 ? prev.p1.name : s2 > s1 ? prev.p2.name : "Draw";
        newState.p1Score = s1;
        newState.p2Score = s2;
        newState.battleLog = log;
      }

      return newState;
    });

    if (!isFinished) {
      const char = drawCharacter(pool, usedIndices);
      if (char) {
        setGameState(prev => ({ ...prev, currentDraw: char }));
      }
    }
  };

  const skipTurn = () => {
    const currentPlayer = gameState[gameState.turn];
    if (currentPlayer.skips <= 0) return;

    const char = drawCharacter(pool, usedIndices);
    setGameState((prev) => ({
      ...prev,
      [prev.turn]: { ...currentPlayer, skips: currentPlayer.skips - 1 },
      turn: prev.turn === "p1" ? "p2" : "p1",
      currentDraw: char,
    }));
  };

  return (
    <div className="min-h-screen bg-[#050507] text-[#e0e0e6] p-4 md:p-8 font-sans selection:bg-purple-500/30">
      <div className="max-w-7xl mx-auto">
        <header className="text-center mb-12 relative">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-purple-600/10 blur-[100px] -z-10 animate-pulse"></div>
          <h1 className="text-5xl md:text-7xl font-black italic tracking-tighter text-white mb-3 tracking-tighter">
            MULTI <span className="bg-gradient-to-r from-blue-400 via-purple-500 to-rose-500 bg-clip-text text-transparent">{gameState.config.mode.toUpperCase()}</span> BATTLE
          </h1>
          <div className="flex items-center justify-center gap-4">
            <span className="h-px w-12 bg-gradient-to-r from-transparent to-gray-700"></span>
            <p className="text-gray-500 tracking-[0.3em] uppercase text-xs font-bold leading-none">
              {gameState.config.series || "Legendary Arena"}
            </p>
            <span className="h-px w-12 bg-gradient-to-l from-transparent to-gray-700"></span>
          </div>
        </header>

        {gameState.status === "setup" && <SetupScreen onStart={startDraft} />}

        {(gameState.status === "drafting" || gameState.status === "ready") && (
          <div className="grid md:grid-cols-[1fr_2fr_1fr] gap-8 items-start">
            <TeamDisplay player={gameState.p1} isLeft={true} roles={roles} />

            <div className="flex flex-col items-center gap-6 sticky top-6">
              <div className="text-center">
                <p className="text-gray-400 text-sm mb-1 uppercase tracking-tighter">Current Turn</p>
                <h3 className={`text-2xl font-black ${gameState.turn === "p1" ? 'text-blue-400' : 'text-red-400'}`}>
                  {gameState[gameState.turn].name}
                </h3>
              </div>

              <AnimatePresence mode="wait">
                {gameState.currentDraw && (
                  <motion.div
                    key={gameState.currentDraw.name}
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 1.1, filter: "blur(10px)" }}
                    className="relative group w-full max-sm px-4"
                  >
                    <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
                    <div className="relative bg-[#121216] p-4 rounded-xl border border-white/10 overflow-hidden shadow-2xl">
                      <img
                        src={gameState.currentDraw.img}
                        alt={gameState.currentDraw.name}
                        className="w-full aspect-[4/5] object-cover rounded-lg mb-4 shadow-2xl"
                      />
                      <div className="text-center mb-4">
                        <h2 className="text-2xl font-bold text-white leading-tight">{gameState.currentDraw.name}</h2>
                        <p className="text-blue-400 text-xs font-semibold uppercase tracking-widest mt-1 opacity-80">
                          {gameState.currentDraw.series || (gameState.config.mode === "Pokemon" ? gameState.currentDraw.region : "")}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-2 mb-6">
                        {roles.filter(r => !gameState[gameState.turn].team[r]).map(role => (
                          <button
                            key={role}
                            onClick={() => assignRole(role)}
                            className="flex items-center justify-center gap-2 py-2 px-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-[10px] font-bold transition-all active:scale-95 text-gray-300"
                          >
                            {roleIconsMapping[role]} {role}
                          </button>
                        ))}
                      </div>

                      <button
                        onClick={skipTurn}
                        disabled={gameState[gameState.turn].skips <= 0}
                        className={`w-full flex items-center justify-center gap-2 py-3 rounded-lg text-[10px] font-black border transition-all uppercase tracking-[0.2em]
                          ${gameState[gameState.turn].skips > 0
                            ? 'bg-rose-500/10 border-rose-500/20 text-rose-400 hover:bg-rose-500/20'
                            : 'bg-gray-800 border-transparent text-gray-500 cursor-not-allowed'}`}
                      >
                        <Trash2 size={14} /> Skip Character
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <TeamDisplay player={gameState.p2} isLeft={false} roles={roles} />
          </div>
        )}

        {gameState.status === "finished" && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-2xl mx-auto bg-gray-900/50 backdrop-blur-xl rounded-2xl p-8 border border-white/10 text-center shadow-2xl"
          >
            <h2 className="text-3xl font-black mb-2 italic tracking-widest text-gray-500 uppercase">BATTLE CONCLUDED</h2>
            <div className={`text-6xl font-black mb-1 ${gameState.winner === "Draw" ? 'text-gray-400' : gameState.winner === gameState.p1.name ? 'text-blue-400' : 'text-red-400'}`}>
              {gameState.winner === "Draw" ? "IT'S A DRAW!" : `${(gameState.winner || "").toUpperCase()} WINS!`}
            </div>
            <div className="flex justify-center gap-8 mb-8 text-xl font-black italic tracking-widest opacity-80">
              <span className="text-blue-400">{gameState.p1.name}: {gameState.p1Score || 0} pts</span>
              <span className="text-gray-600">VS</span>
              <span className="text-red-400">{gameState.p2.name}: {gameState.p2Score || 0} pts</span>
            </div>

            <div className="bg-black/40 rounded-2xl p-6 text-left border border-white/5 mb-8 max-h-96 overflow-y-auto custom-scrollbar">
              <h4 className="text-xs font-bold text-gray-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Activity size={14} /> Intelligence Log
              </h4>
              <div className="space-y-3">
                {gameState.battleLog.map((log: string, i: number) => (
                  <div key={i} className="py-2 border-b border-white/5 text-gray-400 text-sm leading-relaxed">
                    {log}
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => setGameState(prev => ({ ...prev, status: "setup", p1: INITIAL_PLAYER("Player 1"), p2: INITIAL_PLAYER("Player 2"), currentDraw: null, winner: null, battleLog: [] }))}
              className="px-12 py-4 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full font-black text-white hover:scale-105 transition-transform shadow-xl uppercase tracking-widest text-sm"
            >
              Initiate New Conflict
            </button>
          </motion.div>
        )}
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.1);
        }
      `}</style>
    </div>
  );
};

export default App;
