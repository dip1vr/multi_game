import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, X, UserPlus, Check, Search, Sword, Activity, Trophy, Frown, Equal, UserCheck, Clock, Sparkles } from 'lucide-react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, doc, getDoc, setDoc, deleteDoc, serverTimestamp, getDocs, limit } from 'firebase/firestore';

interface FriendsModalProps {
    onClose: () => void;
    currentUserId: string;
    currentUsername: string;
}

interface FriendRequest {
    id: string;
    senderId: string;
    senderName: string;
    receiverId: string;
    status: 'pending';
    timestamp: any;
}

interface Friend {
    id: string;
    friendId: string;
    friendName: string;
}

const FriendsModal: React.FC<FriendsModalProps> = ({ onClose, currentUserId, currentUsername }) => {
    const [activeTab, setActiveTab] = useState<'friends' | 'requests' | 'add'>('friends');
    const [requests, setRequests] = useState<FriendRequest[]>([]);
    const [outgoingRequests, setOutgoingRequests] = useState<Set<string>>(new Set());
    const [friends, setFriends] = useState<Friend[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);

    // Global Search States
    const [globalSearchQuery, setGlobalSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [searchError, setSearchError] = useState<string | null>(null);

    // Timeout fallback just in case onSnapshot never fires
    useEffect(() => {
        const timer = setTimeout(() => {
            if (loading) {
                setLoading(false);
            }
        }, 5000);
        return () => clearTimeout(timer);
    }, [loading]);

    // Listen to incoming requests
    useEffect(() => {
        if (!currentUserId) return;
        const reqQuery = query(
            collection(db, 'friendRequests'),
            where('receiverId', '==', currentUserId),
            where('status', '==', 'pending')
        );

        const unsubReq = onSnapshot(reqQuery, (snapshot) => {
            const parsedReqs: FriendRequest[] = [];
            snapshot.forEach(doc => {
                parsedReqs.push({ id: doc.id, ...doc.data() } as FriendRequest);
            });
            setRequests(parsedReqs.sort((a, b) => (b.timestamp?.toMillis() || 0) - (a.timestamp?.toMillis() || 0)));
        }, (error) => {
            console.error("Error fetching friend requests:", error);
        });

        return () => unsubReq();
    }, [currentUserId]);

    // Listen to outgoing requests
    useEffect(() => {
        if (!currentUserId) return;
        const outQuery = query(
            collection(db, 'friendRequests'),
            where('senderId', '==', currentUserId),
            where('status', '==', 'pending')
        );

        const unsubOut = onSnapshot(outQuery, (snapshot) => {
            const outs = new Set<string>();
            snapshot.forEach(doc => outs.add(doc.data().receiverId));
            setOutgoingRequests(outs);
        }, (error) => {
            console.error("Error fetching outgoing requests:", error);
        });

        return () => unsubOut();
    }, [currentUserId]);

    // Listen to friends list
    useEffect(() => {
        if (!currentUserId) return;
        const friendsQuery = query(
            collection(db, 'friends'),
            where('userIds', 'array-contains', currentUserId)
        );

        const unsubFriends = onSnapshot(friendsQuery, (snapshot) => {
            const parsedFriends: Friend[] = [];
            snapshot.forEach(docSnap => {
                try {
                    const data = docSnap.data();
                    const friendId = data.userIds?.find((id: string) => id !== currentUserId);
                    if (!friendId) return;
                    const friendName = data.userNames?.[friendId] || "Unknown Player";
                    parsedFriends.push({
                        id: docSnap.id,
                        friendId,
                        friendName
                    });
                } catch (err) {
                    console.error("Failed to parse friend document", err);
                }
            });
            setFriends(parsedFriends);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching friends list:", error);
            setLoading(false);
        });

        return () => unsubFriends();
    }, [currentUserId]);

    const handleAcceptRequest = async (request: FriendRequest) => {
        try {
            const friendPairId = [request.senderId, request.receiverId].sort().join('_');
            await setDoc(doc(db, 'friends', friendPairId), {
                userIds: [request.senderId, request.receiverId],
                userNames: {
                    [request.senderId]: request.senderName,
                    [request.receiverId]: currentUsername
                },
                createdAt: serverTimestamp(),
                isOfficialFriend: true
            });
            await deleteDoc(doc(db, 'friendRequests', request.id));
        } catch (e) {
            console.error("Error accepting request", e);
        }
    };

    const handleRejectRequest = async (requestId: string) => {
        try {
            await deleteDoc(doc(db, 'friendRequests', requestId));
        } catch (e) {
            console.error("Error rejecting request", e);
        }
    };

    const handleChallenge = async (friend: Friend) => {
        try {
            const inviteRef = doc(collection(db, 'gameInvites'));
            await setDoc(inviteRef, {
                senderId: currentUserId,
                senderName: currentUsername,
                receiverId: friend.friendId,
                status: 'pending',
                timestamp: serverTimestamp()
            });
            const event = new CustomEvent('initiate_challenge', { detail: { inviteId: inviteRef.id, friendId: friend.friendId } });
            window.dispatchEvent(event);
            onClose();
        } catch (e) {
            console.error("Failed to challenge friend", e);
        }
    };

    const filteredFriends = friends.filter(f => (f.friendName || "").toLowerCase().includes(searchQuery.toLowerCase()));

    const handleGlobalSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        const term = globalSearchQuery.trim();
        if (!term) return;
        setIsSearching(true);
        setSearchError(null);
        try {
            const usersRef = collection(db, 'users');
            const q = query(
                usersRef,
                where('displayName', '>=', term),
                where('displayName', '<=', term + '\uf8ff'),
                limit(10)
            );
            const snapshot = await getDocs(q);
            const results: any[] = [];
            snapshot.forEach(docSnap => {
                results.push({ id: docSnap.id, ...docSnap.data() });
            });
            setSearchResults(results);

            if (results.length === 0) {
                const lowerTerm = term.toLowerCase();
                const q2 = query(
                    usersRef,
                    where('displayNameLowercase', '>=', lowerTerm),
                    where('displayNameLowercase', '<=', lowerTerm + '\uf8ff'),
                    limit(10)
                );
                const snapshot2 = await getDocs(q2);
                snapshot2.forEach(docSnap => {
                    results.push({ id: docSnap.id, ...docSnap.data() });
                });
                setSearchResults(results);
            }

            if (results.length === 0) {
                setSearchError("No players found with that name.");
            }
        } catch (err) {
            console.error("Search error", err);
            setSearchError("Failed to search players.");
        } finally {
            setIsSearching(false);
        }
    };

    const handleSendGlobalRequest = async (userResult: any) => {
        try {
            if (outgoingRequests.has(userResult.id)) return;
            const friendPairId = [currentUserId, userResult.id].sort().join('_');
            const friendDoc = await getDoc(doc(db, 'friends', friendPairId));
            if (friendDoc.exists()) {
                alert("You are already friends!");
                return;
            }
            const newReqRef = doc(collection(db, 'friendRequests'));
            await setDoc(newReqRef, {
                senderId: currentUserId,
                senderName: currentUsername,
                receiverId: userResult.id,
                status: 'pending',
                timestamp: serverTimestamp()
            });
            alert(`Friend request sent to ${userResult.displayName}!`);
        } catch (err) {
            console.error("Failed to send request", err);
            alert("Failed to send request.");
        }
    };

    const tabs = [
        { id: 'friends', label: 'Friends', icon: <Users size={16} />, count: friends.length },
        { id: 'requests', label: 'Requests', icon: <Activity size={16} />, count: requests.length },
        { id: 'add', label: 'Add Player', icon: <UserPlus size={16} /> },
    ];

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 pointer-events-none"
        >
            <div
                onClick={onClose}
                className="absolute inset-0 bg-black/60 backdrop-blur-md cursor-pointer pointer-events-auto"
            />

            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 30 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 30 }}
                className="w-full max-w-lg bg-[#0d0d12]/90 border border-white/10 rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden relative z-10 backdrop-blur-3xl pointer-events-auto"
            >
                {/* Premium Gradient Top Border */}
                <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent"></div>
                <div className="absolute top-0 left-0 w-full h-32 bg-emerald-500/5 blur-[80px] pointer-events-none"></div>

                {/* Header */}
                <div className="flex items-center justify-between p-8 pb-4 relative">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-gradient-to-br from-emerald-500/20 to-teal-500/10 rounded-2xl border border-emerald-500/30 shadow-lg shadow-emerald-500/10">
                            <Users size={28} className="text-emerald-400" />
                        </div>
                        <div>
                            <h2 className="text-3xl font-black text-white italic tracking-[0.1em] uppercase leading-none drop-shadow-sm">Social <span className="text-emerald-500">Hub</span></h2>
                            <p className="text-[10px] font-black text-gray-500 uppercase tracking-[.4em] mt-2 flex items-center gap-1.5">
                                <Sparkles size={10} className="text-emerald-500/60" /> Elite Network
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-3 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all border border-white/5 hover:border-white/10 shadow-inner group"
                    >
                        <X size={20} className="group-hover:rotate-90 transition-transform duration-300" />
                    </button>
                </div>

                {/* Modern Tabs */}
                <div className="flex px-6 pt-4 relative">
                    <div className="flex-1 flex bg-black/40 p-1.5 rounded-2xl border border-white/5 shadow-inner">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`flex-1 relative py-2.5 flex items-center justify-center gap-2 rounded-xl transition-all duration-500 group`}
                            >
                                <AnimatePresence>
                                    {activeTab === tab.id && (
                                        <motion.div
                                            initial={{ opacity: 0, scale: 0.9 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.9 }}
                                            className="absolute inset-0 bg-gradient-to-r from-emerald-600/20 to-emerald-400/10 border border-emerald-500/20 rounded-xl"
                                        />
                                    )}
                                </AnimatePresence>
                                <span className={`relative z-10 transition-colors duration-300 ${activeTab === tab.id ? 'text-emerald-400' : 'text-gray-500 group-hover:text-gray-300'}`}>
                                    {tab.icon}
                                </span>
                                <span className={`relative z-10 text-[11px] font-black tracking-widest uppercase transition-colors duration-300 ${activeTab === tab.id ? 'text-white' : 'text-gray-500 group-hover:text-gray-300'}`}>
                                    {tab.label}
                                </span>
                                {tab.count !== undefined && tab.count > 0 && (
                                    <span className="relative z-10 bg-emerald-500 text-black text-[9px] font-black px-1.5 py-0.5 rounded-md min-w-[18px] text-center shadow-lg shadow-emerald-500/20 animate-pulse">
                                        {tab.count}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar min-h-[400px]">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={activeTab}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.3 }}
                        >
                            {activeTab === 'friends' && (
                                <div className="space-y-6">
                                    <div className="relative group">
                                        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-emerald-400 transition-colors" />
                                        <input
                                            type="text"
                                            placeholder="Find friends in your network..."
                                            value={searchQuery}
                                            onChange={e => setSearchQuery(e.target.value)}
                                            className="w-full bg-black/40 text-white rounded-2xl pl-12 pr-4 py-4 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500/30 font-medium tracking-wide placeholder:text-gray-600 border border-white/5 transition-all focus:bg-black/60 shadow-inner"
                                        />
                                    </div>

                                    {loading ? (
                                        <div className="flex flex-col items-center justify-center py-20 space-y-4">
                                            <div className="relative">
                                                <Activity size={40} className="animate-spin text-emerald-500/20" />
                                                <Activity size={40} className="absolute inset-0 animate-pulse text-emerald-500" />
                                            </div>
                                            <p className="text-[10px] font-black text-gray-500 uppercase tracking-[.4em]">Establishing Link...</p>
                                        </div>
                                    ) : filteredFriends.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                                            <div className="p-6 bg-white/5 rounded-full border border-white/5">
                                                <Users size={48} className="text-gray-700" />
                                            </div>
                                            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest leading-relaxed">Network isolation detected. <br /> Add players to begin.</p>
                                        </div>
                                    ) : (
                                        <div className="grid gap-3">
                                            {filteredFriends.map((f, i) => (
                                                <motion.div
                                                    initial={{ opacity: 0, x: -20 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    transition={{ delay: i * 0.05 }}
                                                    key={f.id}
                                                    className="group flex items-center justify-between p-4 bg-gradient-to-r from-white/[0.02] to-transparent border border-white/5 rounded-2xl hover:border-emerald-500/30 hover:bg-white/[0.04] transition-all duration-300 hover:scale-[1.01]"
                                                >
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center font-black text-emerald-400 text-sm">
                                                            {f.friendName.charAt(0).toUpperCase()}
                                                        </div>
                                                        <span className="font-black text-gray-100 uppercase tracking-widest text-sm">{f.friendName}</span>
                                                    </div>
                                                    <button
                                                        onClick={() => handleChallenge(f)}
                                                        className="flex items-center gap-2 px-5 py-2.5 bg-rose-600 text-white rounded-xl text-[10px] font-black uppercase tracking-[.2em] transition-all hover:bg-rose-500 hover:shadow-lg hover:shadow-rose-600/20 active:scale-95 border border-rose-500/50"
                                                    >
                                                        <Sword size={14} className="group-hover:rotate-12 transition-transform" /> Battle
                                                    </button>
                                                </motion.div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'requests' && (
                                <div className="space-y-3">
                                    {requests.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-24 text-center space-y-4">
                                            <div className="p-6 bg-white/5 rounded-full border border-white/5">
                                                <Activity size={48} className="text-gray-700" />
                                            </div>
                                            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">No signals received.</p>
                                        </div>
                                    ) : (
                                        requests.map((req, i) => (
                                            <motion.div
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: i * 0.05 }}
                                                key={req.id}
                                                className="flex items-center justify-between p-4 bg-blue-500/5 border border-blue-500/20 rounded-2xl hover:bg-blue-500/10 transition-colors"
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                                                        <UserPlus size={18} />
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="font-black text-white uppercase tracking-widest text-sm">{req.senderName}</span>
                                                        <span className="text-[9px] text-blue-400 font-black uppercase tracking-widest mt-0.5">Incoming Request</span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <button onClick={() => handleRejectRequest(req.id)} className="p-2.5 text-gray-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all border border-transparent hover:border-rose-500/20">
                                                        <X size={20} />
                                                    </button>
                                                    <button onClick={() => handleAcceptRequest(req)} className="p-2.5 text-emerald-400 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 rounded-xl transition-all shadow-lg hover:shadow-emerald-500/10">
                                                        <Check size={20} />
                                                    </button>
                                                </div>
                                            </motion.div>
                                        ))
                                    )}
                                </div>
                            )}

                            {activeTab === 'add' && (
                                <div className="space-y-6">
                                    <form onSubmit={handleGlobalSearch} className="flex gap-3">
                                        <div className="relative flex-1">
                                            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
                                            <input
                                                type="text"
                                                placeholder="Enter exact player alias..."
                                                value={globalSearchQuery}
                                                onChange={(e) => setGlobalSearchQuery(e.target.value)}
                                                className="w-full bg-black/40 text-white rounded-2xl pl-12 pr-4 py-4 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500/30 font-medium tracking-wide placeholder:text-gray-600 border border-white/5 transition-all"
                                            />
                                        </div>
                                        <button
                                            type="submit"
                                            disabled={isSearching}
                                            className="px-6 bg-gradient-to-br from-purple-600 to-indigo-600 text-white hover:from-purple-500 hover:to-indigo-500 rounded-2xl shadow-lg shadow-purple-600/20 border border-purple-500/30 transition-all active:scale-95 disabled:opacity-50"
                                        >
                                            {isSearching ? <Activity className="animate-spin w-5 h-5" /> : <Search className="w-5 h-5" />}
                                        </button>
                                    </form>

                                    {searchError && (
                                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 text-[10px] text-center font-black tracking-[.2em] uppercase">
                                            {searchError}
                                        </motion.div>
                                    )}

                                    <div className="space-y-3">
                                        {searchResults.map((user, i) => (
                                            <motion.div
                                                initial={{ opacity: 0, scale: 0.98 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                transition={{ delay: i * 0.05 }}
                                                key={user.id}
                                                className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl flex items-center justify-between hover:bg-white/[0.04] transition-colors group"
                                            >
                                                <div className="flex flex-col">
                                                    <span className="font-black text-white uppercase tracking-widest text-sm">{user.displayName || 'Unknown'}</span>
                                                    <div className="flex items-center gap-4 mt-2 text-[9px] font-black tracking-[.2em] uppercase">
                                                        <span className="flex items-center gap-1.5 text-emerald-400/80"><Trophy size={10} /> {user.wins || 0}</span>
                                                        <span className="flex items-center gap-1.5 text-rose-400/80"><Frown size={10} /> {user.losses || 0}</span>
                                                        <span className="flex items-center gap-1.5 text-blue-400/80"><Equal size={10} /> {user.draws || 0}</span>
                                                    </div>
                                                </div>

                                                {(() => {
                                                    const isFriend = friends.some(f => f.friendId === user.id);
                                                    const hasSent = outgoingRequests.has(user.id);
                                                    const hasReceived = requests.some(req => req.senderId === user.id);

                                                    if (user.id === currentUserId) {
                                                        return (
                                                            <div className="px-4 py-2 bg-white/5 rounded-xl text-[9px] font-black text-gray-500 uppercase tracking-widest border border-white/5">
                                                                Self
                                                            </div>
                                                        );
                                                    }
                                                    if (isFriend) {
                                                        return (
                                                            <div className="p-3 text-emerald-400 bg-emerald-500/10 rounded-xl border border-emerald-500/20" title="Already Friends">
                                                                <UserCheck size={18} />
                                                            </div>
                                                        );
                                                    }
                                                    if (hasSent) {
                                                        return (
                                                            <div className="p-3 text-yellow-500 bg-yellow-500/10 rounded-xl border border-yellow-500/20" title="Request Sent">
                                                                <Clock size={18} />
                                                            </div>
                                                        );
                                                    }
                                                    if (hasReceived) {
                                                        return (
                                                            <button
                                                                onClick={() => {
                                                                    const req = requests.find(r => r.senderId === user.id);
                                                                    if (req) handleAcceptRequest(req);
                                                                }}
                                                                className="p-3 text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 rounded-xl border border-blue-500/20 transition-all" title="Accept Request">
                                                                <Check size={18} />
                                                            </button>
                                                        );
                                                    }
                                                    return (
                                                        <button
                                                            onClick={() => handleSendGlobalRequest(user)}
                                                            className="p-3 text-purple-400 bg-purple-500/10 hover:bg-purple-500/20 rounded-xl transition-all border border-purple-500/20 group-hover:border-purple-500/40" title="Add Friend">
                                                            <UserPlus size={18} />
                                                        </button>
                                                    );
                                                })()}
                                            </motion.div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    </AnimatePresence>
                </div>

                <div className="absolute bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/5 to-transparent"></div>
            </motion.div>

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
        </motion.div >
    );
};

export default FriendsModal;
