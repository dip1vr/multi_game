import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, X, Activity, User, Shield, Zap, Target, Star } from 'lucide-react';
import { db } from '../firebase';
import { collection, query, orderBy, limit, onSnapshot, getDocs, getCountFromServer, where, documentId } from 'firebase/firestore';

interface LeaderboardUser {
    id: string;
    displayName: string;
    photoURL: string;
    wins: number;
    losses: number;
    draws: number;
}

interface LeaderboardProps {
    onClose: () => void;
    currentUserId: string | null;
}

const Leaderboard: React.FC<LeaderboardProps> = ({ onClose, currentUserId }) => {
    const [leaders, setLeaders] = useState<LeaderboardUser[]>([]);
    const [currentUserRank, setCurrentUserRank] = useState<number | null>(null);
    const [currentUserStats, setCurrentUserStats] = useState<LeaderboardUser | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let unsubLeaderboard: () => void;
        setLoading(true);

        const fetchLeaderboard = async () => {
            try {
                const usersRef = collection(db, 'users');
                const q = query(usersRef, orderBy('wins', 'desc'), limit(20));

                unsubLeaderboard = onSnapshot(q, async (querySnapshot) => {
                    const topUsers: LeaderboardUser[] = [];
                    querySnapshot.forEach((doc) => {
                        topUsers.push({ id: doc.id, ...doc.data() } as LeaderboardUser);
                    });
                    setLeaders(topUsers);

                    if (currentUserId) {
                        const topUserIndex = topUsers.findIndex(u => u.id === currentUserId);
                        let stats = topUserIndex !== -1 ? topUsers[topUserIndex] : null;

                        if (!stats) {
                            const qCurrentUser = query(usersRef, where('__name__', '==', currentUserId));
                            const userSnap = await getDocs(qCurrentUser);
                            if (!userSnap.empty) {
                                stats = { id: userSnap.docs[0].id, ...userSnap.docs[0].data() } as LeaderboardUser;
                            }
                        }

                        if (stats) {
                            setCurrentUserStats(stats);
                            if (topUserIndex !== -1) {
                                setCurrentUserRank(topUserIndex + 1);
                            } else {
                                const countQuery = query(usersRef, where('wins', '>', stats.wins || 0));
                                const snapshot = await getCountFromServer(countQuery);
                                const higherWinsCount = snapshot.data().count;

                                const equalQuery = query(
                                    usersRef,
                                    where('wins', '==', stats.wins || 0),
                                    where(documentId(), '>', stats.id)
                                );
                                const equalSnapshot = await getCountFromServer(equalQuery);
                                setCurrentUserRank(higherWinsCount + equalSnapshot.data().count + 1);
                            }
                        }
                    }
                    // Artificial delay for premium loading feel
                    setTimeout(() => setLoading(false), 2000);
                });
            } catch (error) {
                console.error("Leaderboard error:", error);
                setLoading(false);
            }
        };

        fetchLeaderboard();
        return () => unsubLeaderboard?.();
    }, [currentUserId]);

    const RankBadge = ({ rank }: { rank: number }) => {
        const colors = {
            1: "from-yellow-400 via-amber-200 to-yellow-500",
            2: "from-slate-300 via-white to-slate-400",
            3: "from-orange-400 via-orange-200 to-orange-600"
        };
        const glows = {
            1: "shadow-[0_0_15px_rgba(250,204,21,0.5)]",
            2: "shadow-[0_0_15px_rgba(203,213,225,0.5)]",
            3: "shadow-[0_0_15px_rgba(251,146,60,0.5)]"
        };

        if (rank <= 3) {
            return (
                <div className={`relative w-10 h-10 flex items-center justify-center`}>
                    <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                        className={`absolute inset-0 rounded-full bg-gradient-to-tr ${colors[rank as 1 | 2 | 3]} opacity-20 blur-sm`}
                    />
                    <div className={`relative z-10 w-8 h-8 rounded-full bg-gradient-to-tr ${colors[rank as 1 | 2 | 3]} flex items-center justify-center ${glows[rank as 1 | 2 | 3]} border border-white/20`}>
                        <Trophy size={14} className="text-black/80" />
                    </div>
                </div>
            );
        }
        return (
            <div className="w-10 h-10 flex items-center justify-center">
                <span className="text-gray-500 font-black text-sm italic tracking-tighter">#{rank}</span>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl">
            <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 40 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="w-full max-w-2xl bg-[#050508] border border-white/10 rounded-[2.5rem] shadow-[0_30px_100px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col max-h-[85vh] relative"
            >
                {/* Cyber Accents */}
                <div className="absolute top-0 right-10 w-24 h-1 bg-blue-500/50 blur-sm" />
                <div className="absolute top-0 left-10 w-24 h-1 bg-purple-500/50 blur-sm" />

                {/* Header */}
                <div className="flex items-center justify-between p-8 border-b border-white/5 bg-white/[0.02]">
                    <div className="flex items-center gap-5">
                        <div className="relative">
                            <motion.div
                                animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
                                transition={{ duration: 2, repeat: Infinity }}
                                className="absolute -inset-2 bg-purple-500/20 blur-xl rounded-full"
                            />
                            <div className="relative p-3 bg-gradient-to-br from-purple-500 to-blue-600 rounded-2xl border border-white/20">
                                <Star size={24} className="text-white fill-current" />
                            </div>
                        </div>
                        <div>
                            <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase leading-none">Global Ranks</h2>
                            <p className="text-purple-400/60 text-[10px] font-black uppercase tracking-[0.4em] mt-2">Elite Combatants Protocol</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-gray-400 hover:text-white transition-all group">
                        <X size={20} className="group-hover:rotate-90 transition-transform" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                    <AnimatePresence mode="wait">
                        {loading ? (
                            <motion.div
                                key="loading"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="h-96 flex flex-col items-center justify-center"
                            >
                                <div className="relative w-40 h-40 mb-10">
                                    <motion.div
                                        animate={{ rotate: 360 }}
                                        transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                                        className="absolute inset-0 border-t-2 border-r-2 border-transparent border-t-purple-500 border-r-blue-500 rounded-full"
                                    />
                                    <motion.div
                                        animate={{ rotate: -360 }}
                                        transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                                        className="absolute inset-4 border-b-2 border-l-2 border-transparent border-b-blue-400 border-l-purple-400 rounded-full opacity-50"
                                    />
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <Activity size={40} className="text-purple-500 animate-pulse" />
                                    </div>
                                </div>
                                <div className="flex flex-col items-center gap-2">
                                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.5em] animate-pulse">Syncing Leaderboard</span>
                                    <div className="flex gap-1">
                                        {[0, 1, 2].map(i => (
                                            <motion.div
                                                key={i}
                                                animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }}
                                                transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                                                className="w-1.5 h-1.5 rounded-full bg-purple-500"
                                            />
                                        ))}
                                    </div>
                                </div>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="list"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="space-y-4"
                            >
                                {leaders.map((user, index) => (
                                    <motion.div
                                        key={user.id}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: index * 0.05 }}
                                        className={`group relative flex items-center gap-5 p-4 rounded-[1.5rem] border transition-all duration-300 ${user.id === currentUserId
                                            ? 'bg-purple-500/10 border-purple-500/40 shadow-[0_0_30px_rgba(168,85,247,0.1)]'
                                            : 'bg-white/[0.03] border-white/5 hover:bg-white/[0.06] hover:border-white/10'
                                            }`}
                                    >
                                        <div className="shrink-0">
                                            <RankBadge rank={index + 1} />
                                        </div>

                                        <div className="relative w-14 h-14 shrink-0">
                                            <div className="w-full h-full rounded-2xl bg-black border border-white/10 p-0.5 overflow-hidden shadow-xl">
                                                {user.photoURL ? (
                                                    <img src={user.photoURL} className="w-full h-full object-cover rounded-xl" alt="" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center bg-gray-900 rounded-xl">
                                                        <User size={24} className="text-gray-600" />
                                                    </div>
                                                )}
                                            </div>
                                            {index === 0 && <Zap size={16} className="absolute -top-1 -right-1 text-yellow-400 fill-current animate-bounce" />}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-3 mb-1">
                                                <h3 className={`font-black uppercase tracking-widest text-sm sm:text-lg truncate ${user.id === currentUserId ? 'text-white' : 'text-gray-300'}`}>
                                                    {user.displayName || 'ANON-OPERATIVE'}
                                                </h3>
                                                {user.id === currentUserId && (
                                                    <span className="px-2 py-0.5 bg-white text-black text-[9px] font-black rounded italic flex items-center gap-1">
                                                        YOU
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-4 text-[9px] font-black uppercase tracking-widest text-gray-500">
                                                <span className="flex items-center gap-1"><Target size={10} className="text-purple-500" /> LVL {Math.floor(user.wins / 5) + 1}</span>
                                                <span className="flex items-center gap-1"><Shield size={10} className="text-blue-500" /> {user.wins + user.losses + user.draws} BATTLES</span>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-4 sm:gap-8 px-4 py-2 bg-black/40 border border-white/5 rounded-2xl shrink-0">
                                            <div className="flex flex-col items-center">
                                                <span className="text-[8px] text-emerald-500/50 font-black tracking-widest uppercase mb-0.5">W</span>
                                                <span className="text-emerald-400 font-black text-sm">{user.wins || 0}</span>
                                            </div>
                                            <div className="flex flex-col items-center">
                                                <span className="text-[8px] text-rose-500/50 font-black tracking-widest uppercase mb-0.5">L</span>
                                                <span className="text-rose-400 font-black text-sm">{user.losses || 0}</span>
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Footer HUD */}
                {currentUserId && currentUserStats && (
                    <div className="p-8 bg-[#0a0a12] border-t border-white/10">
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
                            <div className="flex items-center gap-6">
                                <div className="text-center sm:text-left px-6 py-3 bg-purple-500/10 border border-purple-500/30 rounded-3xl backdrop-blur-md">
                                    <p className="text-[10px] text-purple-400/80 font-black uppercase tracking-[0.3em] mb-1">Your Protocol Rank</p>
                                    <p className="text-4xl font-black text-white italic leading-none tracking-tighter shadow-purple-500/50">#{currentUserRank || '?'}</p>
                                </div>
                                <div className="h-10 w-px bg-white/10 hidden sm:block"></div>
                                <div className="hidden md:flex flex-col">
                                    <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">Combat Rating</span>
                                    <div className="flex gap-1">
                                        {[...Array(5)].map((_, i) => (
                                            <div key={i} className={`w-3 h-1.5 rounded-full ${i < Math.min(5, Math.floor(currentUserStats.wins / 10)) ? 'bg-purple-500' : 'bg-white/10'}`} />
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 px-6 py-4 bg-white/[0.02] border border-white/5 rounded-3xl backdrop-blur-md">
                                <div className="flex flex-col items-center px-4">
                                    <span className="text-[9px] text-emerald-500 font-black uppercase tracking-widest">Wins</span>
                                    <span className="text-xl font-black text-emerald-400">{currentUserStats.wins || 0}</span>
                                </div>
                                <div className="w-px h-8 bg-white/10 mx-2"></div>
                                <div className="flex flex-col items-center px-4">
                                    <span className="text-[9px] text-rose-500 font-black uppercase tracking-widest">Losses</span>
                                    <span className="text-xl font-black text-rose-400">{currentUserStats.losses || 0}</span>
                                </div>
                                <div className="w-px h-8 bg-white/10 mx-2"></div>
                                <div className="flex flex-col items-center px-4">
                                    <span className="text-[9px] text-gray-500 font-black uppercase tracking-widest">Draws</span>
                                    <span className="text-xl font-black text-gray-400">{currentUserStats.draws || 0}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </motion.div>
        </div>
    );
};

export default Leaderboard;
