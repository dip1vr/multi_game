import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Medal, X, Activity, User, UserPlus } from 'lucide-react';
import { db } from '../firebase';
import { collection, query, orderBy, limit, getDocs, getCountFromServer, where, onSnapshot, setDoc, doc, serverTimestamp } from 'firebase/firestore';

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
    currentUsername: string;
}

const Leaderboard: React.FC<LeaderboardProps> = ({ onClose, currentUserId, currentUsername }) => {
    const [leaders, setLeaders] = useState<LeaderboardUser[]>([]);
    const [currentUserRank, setCurrentUserRank] = useState<number | null>(null);
    const [currentUserStats, setCurrentUserStats] = useState<LeaderboardUser | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let unsubLeaderboard: () => void;

        const fetchLeaderboard = async () => {
            setLoading(true);
            try {
                const usersRef = collection(db, 'users');

                // Fetch Top 20 Live
                const q = query(usersRef, orderBy('wins', 'desc'), limit(20));
                unsubLeaderboard = onSnapshot(q, async (querySnapshot) => {
                    const topUsers: LeaderboardUser[] = [];
                    querySnapshot.forEach((doc) => {
                        topUsers.push({ id: doc.id, ...doc.data() } as LeaderboardUser);
                    });
                    setLeaders(topUsers);

                    // Fetch Current User Rank if logged in
                    if (currentUserId) {
                        // Find stats for current user
                        const currentUserDoc = topUsers.find(u => u.id === currentUserId);
                        let stats = currentUserDoc;

                        if (!stats) {
                            // Unlikely to be in top 20, fetch their doc directly
                            const qCurrentUser = query(usersRef, where('__name__', '==', currentUserId));
                            const userSnap = await getDocs(qCurrentUser);
                            if (!userSnap.empty) {
                                stats = { id: userSnap.docs[0].id, ...userSnap.docs[0].data() } as LeaderboardUser;
                            }
                        }

                        if (stats) {
                            setCurrentUserStats(stats);
                            // Calculate rank by counting how many users have more wins
                            const countQuery = query(usersRef, where('wins', '>', stats.wins));
                            const snapshot = await getCountFromServer(countQuery);
                            // Rank is number of people with strictly more wins + 1
                            setCurrentUserRank(snapshot.data().count + 1);
                        }
                    }
                    setLoading(false);
                }, (error) => {
                    console.error("Error fetching leaderboard live:", error);
                    setLoading(false);
                });
            } catch (error) {
                console.error("Error setting up leaderboard listener:", error);
                setLoading(false);
            }
        };

        fetchLeaderboard();

        return () => {
            if (unsubLeaderboard) unsubLeaderboard();
        };
    }, [currentUserId]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="w-full max-w-2xl bg-[#0a0a0c] border border-white/10 rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden relative"
            >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-yellow-400 via-amber-500 to-orange-500"></div>

                <div className="flex items-center justify-between p-6 border-b border-white/10 bg-white/5">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-yellow-500/20 rounded-xl border border-yellow-500/30">
                            <Trophy size={24} className="text-yellow-400" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-white italic tracking-widest uppercase leading-none">Global Rankings</h2>
                            <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mt-1">Top 20 Commanders</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                    >
                        <X size={24} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-80 relative overflow-hidden">
                            {/* Scanning Animation Container */}
                            <div className="relative w-32 h-32 mb-8">
                                {/* Outer Pulse Ring */}
                                <motion.div
                                    animate={{
                                        scale: [1, 1.2, 1],
                                        opacity: [0.3, 0.6, 0.3],
                                        borderWidth: ["1px", "4px", "1px"]
                                    }}
                                    transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                                    className="absolute inset-0 rounded-full border border-purple-500/50"
                                />
                                {/* Inner Glowing Orb */}
                                <motion.div
                                    animate={{
                                        scale: [1, 0.8, 1],
                                        boxShadow: [
                                            "0 0 20px rgba(168,85,247,0.4)",
                                            "0 0 40px rgba(168,85,247,0.8)",
                                            "0 0 20px rgba(168,85,247,0.4)"
                                        ]
                                    }}
                                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                                    className="absolute inset-4 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg"
                                >
                                    <Activity size={24} className="text-white animate-pulse" />
                                </motion.div>
                                {/* Scan Line */}
                                <motion.div
                                    animate={{ top: ["0%", "100%", "0%"] }}
                                    transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                                    className="absolute left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-purple-400 to-transparent z-10 shadow-[0_0_10px_rgba(168,85,247,0.8)]"
                                />
                            </div>

                            {/* Staggered Loading Text */}
                            <div className="flex gap-1">
                                {"COMPILING INTELLIGENCE...".split("").map((char, i) => (
                                    <motion.span
                                        key={i}
                                        animate={{
                                            opacity: [0.2, 1, 0.2],
                                            color: ["#6b7280", "#a855f7", "#6b7280"]
                                        }}
                                        transition={{
                                            duration: 2,
                                            repeat: Infinity,
                                            delay: i * 0.05,
                                            ease: "easeInOut"
                                        }}
                                        className="text-[10px] font-black uppercase tracking-widest leading-none pt-1"
                                    >
                                        {char}
                                    </motion.span>
                                ))}
                            </div>

                            {/* Decorative Background Elements */}
                            <div className="absolute inset-0 pointer-events-none">
                                <motion.div
                                    animate={{ opacity: [0.1, 0.3, 0.1] }}
                                    transition={{ duration: 5, repeat: Infinity }}
                                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-purple-500/5 rounded-full blur-3xl"
                                />
                            </div>
                        </div>
                    ) : leaders.length === 0 ? (
                        <div className="text-center py-20 text-gray-500">
                            <Trophy size={48} className="mx-auto mb-4 opacity-20" />
                            <p className="text-sm font-bold uppercase tracking-widest">No rankings formulated yet.</p>
                        </div>
                    ) : (
                        <div className="space-y-2 relative">
                            {leaders.map((user, index) => {
                                const isCurrentUser = user.id === currentUserId;
                                const rank = index + 1;
                                let rankVisual = <span className="text-gray-500 font-bold">{rank}</span>;
                                if (rank === 1) rankVisual = <Medal size={20} className="text-yellow-400" />;
                                else if (rank === 2) rankVisual = <Medal size={20} className="text-gray-300" />;
                                else if (rank === 3) rankVisual = <Medal size={20} className="text-amber-600" />;

                                return (
                                    <div
                                        key={user.id}
                                        className={`flex items-center gap-4 p-3 rounded-xl border transition-colors ${isCurrentUser
                                            ? 'bg-purple-900/40 border-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.15)]'
                                            : 'bg-black/40 border-white/5 hover:bg-white/5'
                                            }`}
                                    >
                                        <div className="w-8 flex justify-center items-center shrink-0">
                                            {rankVisual}
                                        </div>
                                        <div className="w-10 h-10 rounded-full bg-gray-800 border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
                                            {user.photoURL ? (
                                                <img src={user.photoURL} alt={user.displayName} className="w-full h-full object-cover" />
                                            ) : (
                                                <User size={20} className="text-gray-400" />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <h3 className={`font-black uppercase tracking-widest truncate text-xs sm:text-base ${isCurrentUser ? 'text-purple-400' : 'text-gray-200'}`}>
                                                    {user.displayName || 'LEGENDARY COMMANDER'}
                                                </h3>
                                                {isCurrentUser && (
                                                    <span className="text-[8px] sm:text-[9px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded font-black uppercase tracking-widest whitespace-nowrap">You</span>
                                                )}
                                                {!isCurrentUser && currentUserId && (
                                                    <button
                                                        onClick={async () => {
                                                            try {
                                                                await setDoc(doc(collection(db, 'friendRequests')), {
                                                                    senderId: currentUserId,
                                                                    senderName: currentUsername,
                                                                    receiverId: user.id,
                                                                    status: 'pending',
                                                                    timestamp: serverTimestamp()
                                                                });
                                                                alert("Friend request sent!");
                                                            } catch (e) {
                                                                console.error(e);
                                                            }
                                                        }}
                                                        className="p-1 hover:bg-emerald-500/20 text-gray-500 hover:text-emerald-400 rounded transition-colors"
                                                        title="Add Friend"
                                                    >
                                                        <UserPlus size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex gap-2 sm:gap-6 shrink-0 text-right pr-1 sm:pr-2">
                                            <div className="flex flex-col items-center sm:items-end">
                                                <span className="text-[8px] sm:text-[10px] text-emerald-500/70 font-bold uppercase tracking-widest">W</span>
                                                <span className="text-emerald-400 font-black text-xs sm:text-sm">{user.wins || 0}</span>
                                            </div>
                                            <div className="flex flex-col items-center sm:items-end">
                                                <span className="text-[8px] sm:text-[10px] text-rose-500/70 font-bold uppercase tracking-widest">L</span>
                                                <span className="text-rose-400 font-black text-xs sm:text-sm">{user.losses || 0}</span>
                                            </div>
                                            <div className="flex flex-col items-center sm:items-end">
                                                <span className="text-[8px] sm:text-[10px] text-gray-500/70 font-bold uppercase tracking-widest">D</span>
                                                <span className="text-gray-400 font-black text-xs sm:text-sm">{user.draws || 0}</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Current User Stats Bar at the bottom if logged in, but not in top 20 or just want to show explicit rank */}
                {currentUserId && currentUserStats && (
                    <div className="p-4 bg-purple-900/20 border-t border-purple-500/30 shrink-0">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-[10px] text-purple-400 font-bold uppercase tracking-widest leading-none mb-1">Your Rank</p>
                                <div className="flex items-end gap-2 text-white font-black italic">
                                    <span className="text-3xl leading-none">#{currentUserRank || '-'}</span>
                                </div>
                            </div>
                            <div className="flex gap-4 sm:gap-8 bg-black/40 px-4 py-2 rounded-xl border border-white/5">
                                <div className="flex flex-col items-center">
                                    <span className="text-[10px] text-emerald-500/70 font-bold uppercase tracking-widest">Wins</span>
                                    <span className="text-emerald-400 font-black text-base">{currentUserStats.wins || 0}</span>
                                </div>
                                <div className="flex flex-col items-center">
                                    <span className="text-[10px] text-rose-500/70 font-bold uppercase tracking-widest">Losses</span>
                                    <span className="text-rose-400 font-black text-base">{currentUserStats.losses || 0}</span>
                                </div>
                                <div className="flex flex-col items-center">
                                    <span className="text-[10px] text-gray-500/70 font-bold uppercase tracking-widest">Draws</span>
                                    <span className="text-gray-400 font-black text-base">{currentUserStats.draws || 0}</span>
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
