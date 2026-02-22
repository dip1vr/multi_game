import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Zap } from 'lucide-react';
import { SearchableSelect } from './SearchableSelect';
import { GameMode } from '../types';
import { datasets } from '../dataStore';

interface SetupScreenProps {
    onStart: (mode: GameMode, series: string | null) => void;
}

export const SetupScreen: React.FC<SetupScreenProps> = React.memo(({ onStart }) => {
    const [mode, setMode] = useState<GameMode>("Anime");
    const [series, setSeries] = useState<string>("All");

    const availableSeriesList = Array.from(new Set(datasets[mode].map((c: any) => mode === "Pokemon" ? c.region : c.series).filter(Boolean))).sort() as string[];
    const finalOptions = ["All", ...availableSeriesList];

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md lg:max-w-2xl mx-auto bg-gray-900/40 backdrop-blur-xl px-6 py-8 md:p-10 rounded-3xl border border-white/10 shadow-2xl mt-4"
        >
            <h2 className="text-3xl md:text-4xl font-black text-center mb-8 italic tracking-tighter">BATTLE CONFIG</h2>

            <div className="space-y-10">
                <div>
                    <label className="block text-sm font-black uppercase tracking-[0.3em] text-gray-400 mb-4 px-1">Select Universe</label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {(["Anime", "Marvel", "Pokemon"] as GameMode[]).map(m => (
                            <button
                                key={m}
                                type="button"
                                onClick={() => { setMode(m); setSeries("All"); }}
                                className={`py-4 md:py-5 rounded-2xl font-black text-sm uppercase tracking-widest transition-all border shadow-lg ${mode === m ? 'bg-purple-600 border-purple-400 text-white scale-[1.02] shadow-[0_0_30px_rgba(147,51,234,0.4)]' : 'bg-white/5 border-white/5 text-gray-500 hover:bg-white/10 hover:text-white'}`}
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
                    type="button"
                    onClick={() => onStart(mode, series)}
                    className="w-full py-5 mt-4 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl font-black text-lg tracking-widest hover:scale-[1.02] transition-transform active:scale-95 shadow-2xl text-white uppercase flex items-center justify-center gap-3"
                >
                    <Zap size={22} className="text-yellow-400" /> INITIALIZE DRAFT
                </button>
            </div>
        </motion.div>
    );
});
