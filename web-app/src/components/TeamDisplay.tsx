import React from 'react';
import { motion } from 'framer-motion';
import { Users, UserPlus, Crown, Target, Shield, Heart, Sword, Zap, Activity } from 'lucide-react';
import { Player } from '../types';

export const roleIconsMapping: Record<string, React.ReactNode> = {
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
    "SpD": <Shield size={18} className="text-emerald-400" />,
    "Spe": <Activity size={18} className="text-cyan-400" />,
    "Type": <Crown size={18} className="text-amber-400" />
};

interface TeamDisplayProps {
    player: Player;
    isLeft: boolean;
    roles: string[];
    isLocal?: boolean;
    showAddFriend?: boolean;
    onAddFriend?: () => void;
    misses: number;
}

export const TeamDisplay: React.FC<TeamDisplayProps> = React.memo(({ player, isLeft, roles, isLocal, showAddFriend, onAddFriend, misses }) => {
    return (
        <div className={`flex flex-col gap-1 p-1.5 sm:p-2 bg-gray-900/50 backdrop-blur-md rounded-lg border ${isLocal ? 'border-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.15)]' : isLeft ? 'border-blue-500/30' : 'border-red-500/30'} w-full`}>
            <div className="flex items-center justify-between pb-1 mb-0.5 border-b border-white/5">
                <h2 className={`text-xs sm:text-sm font-black flex items-center gap-1 ${isLocal ? 'text-purple-400' : isLeft ? 'text-blue-400' : 'text-red-400'}`}>
                    <Users size={12} /> <span className="truncate max-w-[100px] sm:max-w-[200px]">{player.name}</span>
                    {isLocal && <span className="ml-1 text-[8px] font-black bg-purple-500/20 px-1 py-0.5 rounded-sm uppercase tracking-widest text-purple-300">You</span>}
                    {!isLocal && showAddFriend && (
                        <button onClick={onAddFriend} className="ml-2 bg-purple-500/20 text-purple-400 hover:bg-purple-500/40 p-1.5 rounded-lg transition-colors border border-purple-500/30" title="Add Friend">
                            <UserPlus size={14} />
                        </button>
                    )}
                </h2>
                <div className="flex flex-col items-end gap-1">
                    <div className="flex items-center gap-1 bg-black/40 px-1.5 py-0.5 rounded border border-white/5">
                        <span className="text-[7px] text-gray-500 uppercase tracking-widest font-bold hidden sm:inline mr-1">Skips</span>
                        {[...Array(player.skips)].map((_, i) => <div key={`s-${i}`} className="w-1 h-1 rounded-full bg-rose-500 shadow-[0_0_5px_rgba(244,63,94,0.5)]"></div>)}
                        {[...Array(2 - player.skips)].map((_, i) => <div key={`e-${i}`} className="w-1 h-1 rounded-full bg-gray-800"></div>)}
                    </div>
                    {misses > 0 && (
                        <div className="flex items-center gap-1 bg-red-950/30 px-1.5 py-0.5 rounded border border-red-500/20">
                            <span className="text-[7px] text-red-500 uppercase tracking-widest font-bold hidden sm:inline mr-1">Strikes</span>
                            {[...Array(misses)].map((_, i) => (
                                <motion.div
                                    key={`m-${i}`}
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    className="w-1 h-1 rounded-full bg-red-500 shadow-[0_0_5px_rgba(239,68,68,0.8)]"
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <div className="flex justify-center w-full">
                <div className="grid grid-cols-8 lg:grid-cols-4 gap-1 sm:gap-1.5 w-full max-w-[400px] lg:max-w-none">
                    {roles.map(role => {
                        const char = player.team[role];
                        return (
                            <div
                                key={role}
                                title={char ? `${role}: ${char.name}` : role}
                                className={`relative aspect-square w-full flex flex-col items-center justify-center rounded-md border overflow-hidden transition-all group ${char ? 'border-green-500/30 bg-black' : 'border-white/5 bg-black/40 opacity-70'}`}
                            >
                                {char && char.img ? (
                                    <>
                                        <img src={char.img} alt={char.name} className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20"></div>
                                        <div className="absolute bottom-0 right-0 p-0.5 opacity-90 scale-[0.6] origin-bottom-right">
                                            {roleIconsMapping[role]}
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <span className="text-gray-500 mb-0.5 opacity-50 scale-[0.6]">{roleIconsMapping[role]}</span>
                                        <span className="text-[7px] font-bold text-gray-600 uppercase tracking-tighter text-center leading-none px-0.5" style={{ fontSize: '0.5rem' }}>
                                            {role.split(' ').map(w => w[0]).join('')}
                                        </span>
                                    </>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
});
