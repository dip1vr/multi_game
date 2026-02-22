import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Send, Globe, Users, ArrowLeft, MessageSquareDashed, Search, Activity } from 'lucide-react';
import { collection, query, orderBy, limit, onSnapshot, addDoc, serverTimestamp, where, getDocs, setDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';

interface Friend {
    id: string;
    friendId: string;
    friendName: string;
    timestamp?: any;
}

interface GlobalChatProps {
    currentUserId: string | null;
    currentUsername: string;
}

type TabState = 'global' | 'friends' | 'unknown';

const GlobalChat: React.FC<GlobalChatProps> = ({ currentUserId, currentUsername }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<TabState>('global');

    // Global Chat State
    const [globalMessages, setGlobalMessages] = useState<any[]>([]);
    const [newGlobalMessage, setNewGlobalMessage] = useState("");
    const globalEndRef = useRef<HTMLDivElement>(null);

    // Friend Chat State
    const [friends, setFriends] = useState<Friend[]>([]);
    const [friendSearchQuery, setFriendSearchQuery] = useState('');
    const [activeChatFriend, setActiveChatFriend] = useState<Friend | null>(null);
    const [dmMessages, setDmMessages] = useState<any[]>([]);
    const [newDmMessage, setNewDmMessage] = useState("");
    const dmEndRef = useRef<HTMLDivElement>(null);

    // Unknown/Search State
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [unknownChats, setUnknownChats] = useState<Friend[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [searchError, setSearchError] = useState<string | null>(null);

    // ==========================================
    // GLOBAL CHAT LISTENER
    // ==========================================
    useEffect(() => {
        if (!isOpen) return;
        const q = query(collection(db, 'globalChat'), orderBy('timestamp', 'asc'), limit(50));
        const unsub = onSnapshot(q, (snapshot) => {
            const msgs: any[] = [];
            snapshot.forEach(doc => msgs.push({ id: doc.id, ...doc.data() }));
            setGlobalMessages(msgs);
            setTimeout(() => globalEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        });
        return () => unsub();
    }, [isOpen]);

    const handleSendGlobalMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        const msgText = newGlobalMessage.trim();
        if (!msgText || !currentUserId) {
            if (!currentUserId) alert("You must be signed in to chat globally!");
            return;
        }
        setNewGlobalMessage("");
        try {
            await addDoc(collection(db, 'globalChat'), {
                text: msgText,
                senderId: currentUserId,
                senderName: currentUsername,
                timestamp: serverTimestamp()
            });
        } catch (err) {
            console.error("Failed to send global message", err);
        }
    };

    // ==========================================
    // FRIENDS LISTENER (Official Friends)
    // ==========================================
    useEffect(() => {
        if (!currentUserId || !isOpen) return;
        const q = query(collection(db, 'friends'), where('userIds', 'array-contains', currentUserId));

        const unsub = onSnapshot(q, (snapshot) => {
            const parsedFriends: Friend[] = [];
            snapshot.forEach(docSnap => {
                const data = docSnap.data();
                const friendId = data.userIds?.find((id: string) => id !== currentUserId);
                if (friendId) {
                    const friendName = data.userNames?.[friendId] || "Unknown Player";
                    parsedFriends.push({
                        id: docSnap.id,
                        friendId,
                        friendName,
                        timestamp: data.createdAt
                    });
                }
            });
            setFriends(parsedFriends);
        });

        return () => unsub();
    }, [currentUserId, isOpen]);

    // ==========================================
    // UNKNOWN CHATS LISTENER (Recent Non-Friend DMs)
    // ==========================================
    useEffect(() => {
        if (!currentUserId || !isOpen) return;
        const q1 = query(collection(db, 'friends'), where('user1Id', '==', currentUserId), where('isOfficialFriend', '==', false));
        const q2 = query(collection(db, 'friends'), where('user2Id', '==', currentUserId), where('isOfficialFriend', '==', false));

        const handleSnap = (snapshot: any, isUser1: boolean, currentMap: Map<string, Friend>) => {
            snapshot.docChanges().forEach((change: any) => {
                const data = change.doc.data();
                const friendId = isUser1 ? data.user2Id : data.user1Id;
                const friendName = isUser1 ? data.user2Name : data.user1Name;
                if (change.type === 'added' || change.type === 'modified') {
                    currentMap.set(change.doc.id, { id: change.doc.id, friendId, friendName, timestamp: data.timestamp });
                } else if (change.type === 'removed') {
                    currentMap.delete(change.doc.id);
                }
            });
            return new Map(currentMap);
        };

        let map1 = new Map<string, Friend>();
        let map2 = new Map<string, Friend>();

        const unsub1 = onSnapshot(q1, snap => {
            map1 = handleSnap(snap, true, map1);
            setUnknownChats(Array.from(new Map([...map1, ...map2]).values()));
        });
        const unsub2 = onSnapshot(q2, snap => {
            map2 = handleSnap(snap, false, map2);
            setUnknownChats(Array.from(new Map([...map1, ...map2]).values()));
        });

        return () => { unsub1(); unsub2(); };
    }, [currentUserId, isOpen]);

    // ==========================================
    // DM LISTENER
    // ==========================================
    useEffect(() => {
        if (!activeChatFriend || !currentUserId || activeTab !== 'friends') return;
        const pairId = [currentUserId, activeChatFriend.friendId].sort().join('_');
        const q = query(collection(db, 'friends', pairId, 'messages'), orderBy('timestamp', 'asc'), limit(50));

        const unsub = onSnapshot(q, (snapshot) => {
            const msgs: any[] = [];
            snapshot.forEach(doc => msgs.push({ id: doc.id, ...doc.data() }));
            setDmMessages(msgs);
            setTimeout(() => dmEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        });
        return () => unsub();
    }, [activeChatFriend, currentUserId, activeTab]);

    // Live Search Effect
    useEffect(() => {
        const term = searchQuery.trim();
        if (!term) {
            setSearchResults([]);
            setSearchError(null);
            return;
        }

        const timer = setTimeout(async () => {
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
                    if (docSnap.id !== currentUserId) {
                        results.push({ id: docSnap.id, ...docSnap.data() });
                    }
                });
                setSearchResults(results);

                // Fallback: If no exact case results, try case-insensitive search
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
                        if (docSnap.id !== currentUserId) {
                            results.push({ id: docSnap.id, ...docSnap.data() });
                        }
                    });
                    setSearchResults(results);
                }

                if (results.length === 0) {
                    setSearchError("No players found.");
                }
            } catch (err) {
                console.error("Search error", err);
                setSearchError("Search failed.");
            } finally {
                setIsSearching(false);
            }
        }, 400); // 400ms debounce

        return () => clearTimeout(timer);
    }, [searchQuery, currentUserId]);

    const handleSendDm = async (e: React.FormEvent) => {
        e.preventDefault();
        const dmText = newDmMessage.trim();
        if (!dmText || !activeChatFriend || !currentUserId) return;
        const pairId = [currentUserId, activeChatFriend.friendId].sort().join('_');

        setNewDmMessage("");

        try {
            // Ensure friend doc exists so they show up in each other's lists
            await setDoc(doc(db, 'friends', pairId), {
                user1Id: currentUserId,
                user1Name: currentUsername,
                user2Id: activeChatFriend.friendId,
                user2Name: activeChatFriend.friendName,
                timestamp: serverTimestamp(),
                isOfficialFriend: false // Mark as unknown chat
            }, { merge: true });

            await addDoc(collection(db, 'friends', pairId, 'messages'), {
                text: dmText,
                senderId: currentUserId,
                senderName: currentUsername,
                timestamp: serverTimestamp()
            });
        } catch (err) {
            console.error("Failed to send DM", err);
        }
    };

    return (
        <div className="fixed bottom-4 right-4 sm:right-6 z-[60] flex flex-col items-end shadow-2xl">
            <AnimatePresence>
                {isOpen && (
                    <motion.div initial={{ opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.95 }} className="bg-gray-900/95 backdrop-blur-xl border border-white/10 w-80 h-[400px] rounded-2xl mb-3 flex flex-col overflow-hidden shadow-2xl origin-bottom-right">

                        {/* HEADER */}
                        <div className="bg-black/40 p-3 text-xs font-black tracking-widest uppercase text-gray-400 border-b border-white/5 flex justify-between items-center">
                            {activeChatFriend && activeTab === 'friends' ? (
                                <button onClick={() => setActiveChatFriend(null)} className="flex items-center gap-2 hover:text-white transition-colors">
                                    <ArrowLeft size={14} className="text-emerald-400" /> {activeChatFriend.friendName}
                                </button>
                            ) : (
                                <span className="flex items-center gap-2">
                                    {activeTab === 'global' && <><Globe size={14} className="text-blue-400" /> Global</>}
                                    {activeTab === 'friends' && <><Users size={14} className="text-emerald-400" /> Friends</>}
                                    {activeTab === 'unknown' && <><MessageSquareDashed size={14} className="text-rose-400" /> Unknown</>}
                                </span>
                            )}
                            <button onClick={() => setIsOpen(false)} className="hover:text-white transition-colors"><ChevronDown size={14} /></button>
                        </div>

                        {/* TABS (Hidden when in DM) */}
                        {!(activeChatFriend && activeTab === 'friends') && (
                            <div className="flex border-b border-white/5 bg-black/20">
                                <button onClick={() => setActiveTab('global')} className={`flex-1 py-3 text-[10px] font-black tracking-widest uppercase transition-colors ${activeTab === 'global' ? 'text-blue-400 bg-blue-500/10 border-b-2 border-blue-500' : 'text-gray-500 hover:bg-white/5 border-b-2 border-transparent'}`}>Global</button>
                                <button onClick={() => setActiveTab('friends')} className={`flex-1 py-3 text-[10px] font-black tracking-widest uppercase transition-colors ${activeTab === 'friends' ? 'text-emerald-400 bg-emerald-500/10 border-b-2 border-emerald-500' : 'text-gray-500 hover:bg-white/5 border-b-2 border-transparent'}`}>Friends</button>
                                <button onClick={() => setActiveTab('unknown')} className={`flex-1 py-3 text-[10px] font-black tracking-widest uppercase transition-colors ${activeTab === 'unknown' ? 'text-rose-400 bg-rose-500/10 border-b-2 border-rose-500' : 'text-gray-500 hover:bg-white/5 border-b-2 border-transparent'}`}>Unknown</button>
                            </div>
                        )}

                        {/* CONTENT AREA */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col relative bg-gradient-to-b from-transparent to-black/20">

                            {/* GLOBAL TAB */}
                            {activeTab === 'global' && (
                                <div className="p-3 flex flex-col gap-2 min-h-full">
                                    {globalMessages.length === 0 && <div className="text-center text-gray-500 text-xs mt-4 font-bold uppercase tracking-widest">Welcome to Global Chat!</div>}
                                    {globalMessages.map((msg, i) => {
                                        const isMe = msg.senderId === currentUserId;
                                        return (
                                            <div key={msg.id || i} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} animate-fade-in-up`}>
                                                <span className="text-[9px] text-gray-500 font-bold mb-0.5 px-1 uppercase tracking-wider">{isMe ? 'You' : msg.senderName}</span>
                                                <div className={`px-2.5 py-1.5 rounded-lg text-sm max-w-[85%] break-words shadow-sm ${isMe ? 'bg-blue-600 text-white rounded-br-none' : 'bg-gray-800 text-gray-200 border border-white/5 rounded-bl-none'}`}>
                                                    {msg.text}
                                                </div>
                                            </div>
                                        )
                                    })}
                                    <div ref={globalEndRef} />
                                </div>
                            )}

                            {/* FRIENDS TAB */}
                            {activeTab === 'friends' && !activeChatFriend && (
                                <div className="p-3 flex flex-col gap-3">
                                    <div className="relative">
                                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                                        <input
                                            type="text"
                                            placeholder="Search friends..."
                                            value={friendSearchQuery}
                                            onChange={(e) => setFriendSearchQuery(e.target.value)}
                                            className="w-full bg-black/40 text-white rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500/50 font-medium tracking-wide placeholder:text-gray-600 border border-white/5"
                                        />
                                    </div>

                                    <div className="flex flex-col gap-2">
                                        {friends.filter(f => f.friendName.toLowerCase().includes(friendSearchQuery.toLowerCase())).length === 0 && (
                                            <div className="text-center text-gray-500 text-xs mt-4 font-bold uppercase tracking-widest">
                                                {friends.length === 0 ? "No friends yet." : "No matching friends."}
                                            </div>
                                        )}
                                        {friends
                                            .filter(f => f.friendName.toLowerCase().includes(friendSearchQuery.toLowerCase()))
                                            .map(f => (
                                                <button
                                                    key={f.id}
                                                    onClick={() => setActiveChatFriend(f)}
                                                    className="flex items-center justify-between p-3 bg-black/40 hover:bg-white/5 border border-white/5 rounded-xl transition-colors text-left group"
                                                >
                                                    <span className="font-black text-gray-200 uppercase tracking-widest text-sm truncate">{f.friendName}</span>
                                                    <div className="p-1.5 bg-emerald-500/10 group-hover:bg-emerald-500/20 text-emerald-400 rounded-lg transition-colors">
                                                        <Users size={14} />
                                                    </div>
                                                </button>
                                            ))}
                                    </div>
                                </div>
                            )}

                            {/* DM VIEW */}
                            {activeTab === 'friends' && activeChatFriend && (
                                <div className="p-3 flex flex-col gap-2 min-h-full">
                                    {dmMessages.length === 0 && <div className="text-center text-gray-500 text-xs mt-4 font-bold uppercase tracking-widest">Say hi to {activeChatFriend.friendName}!</div>}
                                    {dmMessages.map((msg, i) => {
                                        const isMe = msg.senderId === currentUserId;
                                        return (
                                            <div key={msg.id || i} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} animate-fade-in-up`}>
                                                <span className="text-[9px] text-gray-500 font-bold mb-0.5 px-1 uppercase tracking-wider">{isMe ? 'You' : msg.senderName}</span>
                                                <div className={`px-2.5 py-1.5 rounded-lg text-sm max-w-[85%] break-words shadow-sm ${isMe ? 'bg-emerald-600 text-white rounded-br-none' : 'bg-gray-800 text-gray-200 border border-white/5 rounded-bl-none'}`}>
                                                    {msg.text}
                                                </div>
                                            </div>
                                        )
                                    })}
                                    <div ref={dmEndRef} />
                                </div>
                            )}

                            {/* UNKNOWN TAB */}
                            {activeTab === 'unknown' && (
                                <div className="p-4 flex flex-col gap-4">
                                    <form onSubmit={(e) => e.preventDefault()} className="flex gap-2 relative shrink-0">
                                        <input
                                            type="text"
                                            placeholder="Search by spelling..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            autoFocus
                                            className="flex-1 bg-black/40 text-white rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-rose-500/50 font-medium tracking-wide placeholder:text-gray-600 border border-white/5"
                                        />
                                        <div className="flex items-center justify-center px-4 py-2 bg-rose-500/20 text-rose-400 rounded-xl font-black uppercase text-xs tracking-widest border border-rose-500/30 transition-colors">
                                            {isSearching ? <Activity className="animate-spin w-4 h-4" /> : <Search className="w-4 h-4" />}
                                        </div>
                                    </form>

                                    {searchError && (
                                        <p className="text-rose-400 text-xs text-center font-bold tracking-widest uppercase">{searchError}</p>
                                    )}

                                    {/* Recent Unknown Chats List */}
                                    {!searchQuery.trim() && unknownChats.length > 0 && (
                                        <div className="flex flex-col gap-2">
                                            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1 shadow-sm px-1">Recent Chats</p>
                                            <div className="flex flex-col gap-2">
                                                {unknownChats.map(chat => (
                                                    <button
                                                        key={chat.id}
                                                        onClick={() => {
                                                            setActiveChatFriend(chat);
                                                            setActiveTab('friends');
                                                        }}
                                                        className="flex items-center justify-between p-3 bg-black/40 hover:bg-white/5 border border-white/5 rounded-xl transition-colors text-left group"
                                                    >
                                                        <span className="font-black text-gray-200 uppercase tracking-widest text-sm truncate">{chat.friendName}</span>
                                                        <div className="p-1.5 bg-rose-500/10 group-hover:bg-rose-500/20 text-rose-400 rounded-lg transition-colors">
                                                            <MessageSquareDashed size={14} />
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {searchResults.length === 0 && !isSearching && !searchError && !searchQuery.trim() && unknownChats.length === 0 && (
                                        <div className="flex flex-col items-center justify-center text-center mt-6 opacity-60">
                                            <div className="w-12 h-12 bg-rose-500/10 text-rose-400 rounded-full flex items-center justify-center border border-rose-500/20 mb-3">
                                                <Search size={20} />
                                            </div>
                                            <p className="text-xs font-black text-white uppercase tracking-widest mb-1 shadow-sm">Find Players</p>
                                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider max-w-[200px]">Search for anyone by their exact codename to start chatting.</p>
                                        </div>
                                    )}

                                    {searchResults.length > 0 && searchQuery.trim() && (
                                        <div className="space-y-2">
                                            {searchResults.map(user => (
                                                <button
                                                    key={user.id}
                                                    onClick={() => {
                                                        setActiveChatFriend({ id: `${currentUserId}_${user.id}`.split('_').sort().join('_'), friendId: user.id, friendName: user.displayName });
                                                        setActiveTab('friends');
                                                    }}
                                                    className="w-full flex items-center justify-between p-3 bg-black/40 hover:bg-white/5 border border-white/5 rounded-xl transition-colors text-left group"
                                                >
                                                    <span className="font-black text-gray-200 uppercase tracking-widest text-sm truncate">{user.displayName || 'Unknown'}</span>
                                                    <div className="px-3 py-1.5 bg-rose-500/10 group-hover:bg-rose-500/20 text-rose-400 rounded-lg text-xs font-black uppercase tracking-widest border border-rose-500/20 transition-colors">
                                                        Message
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                        </div>

                        {/* INPUT FORMS */}
                        {activeTab === 'global' && (
                            <form onSubmit={handleSendGlobalMessage} className="p-2 bg-black/60 border-t border-white/5 flex gap-2 shrink-0">
                                <input
                                    type="text"
                                    value={newGlobalMessage}
                                    onChange={e => setNewGlobalMessage(e.target.value)}
                                    placeholder={currentUserId ? "Type globally..." : "Sign in to chat..."}
                                    disabled={!currentUserId}
                                    className="flex-1 bg-gray-900 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50 placeholder-gray-500 transition-colors disabled:opacity-50"
                                />
                                <button type="submit" disabled={!newGlobalMessage.trim() || !currentUserId} className="p-2 flex items-center justify-center bg-blue-500 hover:bg-blue-600 border border-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl transition-colors">
                                    <Send size={16} />
                                </button>
                            </form>
                        )}
                        {activeTab === 'friends' && activeChatFriend && (
                            <form onSubmit={handleSendDm} className="p-2 bg-black/60 border-t border-white/5 flex gap-2 shrink-0">
                                <input
                                    type="text"
                                    value={newDmMessage}
                                    onChange={e => setNewDmMessage(e.target.value)}
                                    placeholder={`Message ${activeChatFriend.friendName}...`}
                                    className="flex-1 bg-gray-900 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50 placeholder-gray-500 transition-colors"
                                />
                                <button type="submit" disabled={!newDmMessage.trim()} className="p-2 flex items-center justify-center bg-emerald-500 hover:bg-emerald-600 border border-emerald-500/30 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl transition-colors">
                                    <Send size={16} />
                                </button>
                            </form>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {!isOpen && (
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setIsOpen(true)} className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-3 sm:px-5 sm:py-3.5 rounded-full shadow-2xl flex items-center justify-center gap-2 border border-white/10 relative group">
                    <Globe size={20} className="group-hover:animate-pulse" />
                    <span className="hidden sm:inline font-black text-xs tracking-widest uppercase">Chat Hub</span>
                </motion.button>
            )}
        </div>
    );
};

export default GlobalChat;
