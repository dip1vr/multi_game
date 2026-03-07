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
        // Fetch 50 most RECENT messages
        const q = query(collection(db, 'globalChat'), orderBy('timestamp', 'desc'), limit(50));
        const unsub = onSnapshot(q, (snapshot) => {
            const msgs: any[] = [];
            snapshot.forEach(doc => msgs.push({ id: doc.id, ...doc.data() }));
            // Reverse to show oldest-at-top
            setGlobalMessages(msgs.reverse());
            setTimeout(() => globalEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        });
        return () => unsub();
    }, [isOpen]);

    const handleSendGlobalMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        const msgText = newGlobalMessage.trim();

        // Diagnostic Alert
        console.log("[GlobalChat] Send button clicked");

        if (!msgText) return;

        if (!currentUserId) {
            console.warn("[GlobalChat] No currentUserId");
            alert("DEBUG: Clicked send but NO USER ID found in state. Please refresh.");
            return;
        }

        try {
            await addDoc(collection(db, 'globalChat'), {
                text: msgText,
                senderId: currentUserId,
                senderName: currentUsername,
                timestamp: serverTimestamp()
            });
            console.log("[GlobalChat] Message sent!");
            setNewGlobalMessage("");
        } catch (err: any) {
            console.error("[GlobalChat] Send error:", err);
            alert(`Chat Error: ${err.message || "Unknown error"}. Check console.`);
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
        const q = query(collection(db, 'friends', pairId, 'messages'), orderBy('timestamp', 'desc'), limit(50));

        const unsub = onSnapshot(q, (snapshot) => {
            const msgs: any[] = [];
            snapshot.forEach(doc => msgs.push({ id: doc.id, ...doc.data() }));
            setDmMessages(msgs.reverse());
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
                    results.push({ id: docSnap.id, ...docSnap.data() });
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
                        results.push({ id: docSnap.id, ...docSnap.data() });
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

    // Helper: get initials from name
    const getInitials = (name: string) => name ? name.slice(0, 2).toUpperCase() : '??';
    // Helper: deterministic gradient color from name
    const nameColor = (name: string) => {
        const colors = ['from-violet-500 to-purple-600', 'from-blue-500 to-indigo-600', 'from-emerald-500 to-teal-600', 'from-rose-500 to-pink-600', 'from-amber-500 to-orange-600', 'from-cyan-500 to-sky-600'];
        let hash = 0;
        for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
        return colors[Math.abs(hash) % colors.length];
    };

    return (
        <div className="fixed bottom-4 right-4 sm:right-6 z-[60] flex flex-col items-end">
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 24, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 24, scale: 0.96 }}
                        transition={{ type: 'spring', damping: 28, stiffness: 320 }}
                        className="bg-gray-950/98 backdrop-blur-2xl border border-white/10 w-[calc(100vw-2rem)] sm:w-[340px] h-[460px] max-h-[75vh] rounded-3xl mb-3 flex flex-col overflow-hidden shadow-[0_32px_80px_rgba(0,0,0,0.7)] origin-bottom-right ring-1 ring-white/5"
                    >
                        {/* ── HEADER ── */}
                        <div className="shrink-0 bg-black/50 px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
                            {activeChatFriend && activeTab === 'friends' ? (
                                <button onClick={() => setActiveChatFriend(null)} className="flex items-center gap-2.5 hover:text-white transition-colors group">
                                    <div className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-colors">
                                        <ArrowLeft size={13} className="text-emerald-400" />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className={`w-7 h-7 rounded-full bg-gradient-to-br ${nameColor(activeChatFriend.friendName)} flex items-center justify-center text-[9px] font-black text-white`}>
                                            {getInitials(activeChatFriend.friendName)}
                                        </div>
                                        <span className="text-[11px] font-black text-white tracking-widest uppercase truncate max-w-[140px]">{activeChatFriend.friendName}</span>
                                    </div>
                                </button>
                            ) : (
                                <span className="flex items-center gap-2">
                                    {activeTab === 'global' && <><div className="w-2 h-2 rounded-full bg-blue-400 shadow-[0_0_6px_rgba(96,165,250,0.8)] animate-pulse" /><span className="text-[11px] font-black text-white tracking-widest uppercase">Global</span></>}
                                    {activeTab === 'friends' && <><div className="w-2 h-2 rounded-full bg-emerald-400" /><span className="text-[11px] font-black text-white tracking-widest uppercase">Friends</span></>}
                                    {activeTab === 'unknown' && <><div className="w-2 h-2 rounded-full bg-rose-400" /><span className="text-[11px] font-black text-white tracking-widest uppercase">Unknown</span></>}
                                </span>
                            )}
                            <button onClick={() => setIsOpen(false)} className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors">
                                <ChevronDown size={14} className="text-gray-400" />
                            </button>
                        </div>

                        {/* ── TABS ── */}
                        {!(activeChatFriend && activeTab === 'friends') && (
                            <div className="shrink-0 flex bg-black/30 border-b border-white/[0.06]">
                                <button onClick={() => setActiveTab('global')} className={`flex-1 py-2.5 flex items-center justify-center gap-1.5 text-[10px] font-black tracking-widest uppercase border-b-2 transition-all ${activeTab === 'global' ? 'text-blue-400 border-blue-500 bg-blue-500/5' : 'text-gray-600 border-transparent hover:text-gray-400 hover:bg-white/[0.03]'}`}>
                                    <Globe size={12} /> Global
                                </button>
                                <button onClick={() => setActiveTab('friends')} className={`flex-1 py-2.5 flex items-center justify-center gap-1.5 text-[10px] font-black tracking-widest uppercase border-b-2 transition-all ${activeTab === 'friends' ? 'text-emerald-400 border-emerald-500 bg-emerald-500/5' : 'text-gray-600 border-transparent hover:text-gray-400 hover:bg-white/[0.03]'}`}>
                                    <Users size={12} /> Friends
                                </button>
                                <button onClick={() => setActiveTab('unknown')} className={`flex-1 py-2.5 flex items-center justify-center gap-1.5 text-[10px] font-black tracking-widest uppercase border-b-2 transition-all ${activeTab === 'unknown' ? 'text-rose-400 border-rose-500 bg-rose-500/5' : 'text-gray-600 border-transparent hover:text-gray-400 hover:bg-white/[0.03]'}`}>
                                    <MessageSquareDashed size={12} /> Unknown
                                </button>
                            </div>
                        )}

                        {/* ── CONTENT AREA ── */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col">

                            {/* GLOBAL TAB */}
                            {activeTab === 'global' && (
                                <div className="flex-1 p-3 flex flex-col gap-2.5">
                                    {globalMessages.length === 0 && (
                                        <div className="flex flex-col items-center justify-center flex-1 gap-2 opacity-40 mt-8">
                                            <Globe size={28} className="text-blue-400" />
                                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Welcome to Global Chat!</span>
                                        </div>
                                    )}
                                    {globalMessages.map((msg, i) => {
                                        const isMe = msg.senderId === currentUserId;
                                        const showSender = i === 0 || globalMessages[i - 1]?.senderId !== msg.senderId;
                                        return (
                                            <div key={msg.id || i} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                                                {showSender && !isMe && (
                                                    <div className="flex items-center gap-1.5 mb-1 ml-1">
                                                        <div className={`w-5 h-5 rounded-full bg-gradient-to-br ${nameColor(msg.senderName)} flex items-center justify-center text-[8px] font-black text-white shrink-0`}>
                                                            {getInitials(msg.senderName)}
                                                        </div>
                                                        <span className="text-[9px] text-gray-500 font-black uppercase tracking-wider">{msg.senderName}</span>
                                                    </div>
                                                )}
                                                <div className={`px-3 py-2 text-[13px] max-w-[82%] break-words leading-snug shadow-md ${isMe
                                                    ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-2xl rounded-br-sm'
                                                    : 'bg-gray-800/80 text-gray-100 border border-white/[0.06] rounded-2xl rounded-bl-sm'}`}>
                                                    {msg.text}
                                                </div>
                                            </div>
                                        );
                                    })}
                                    <div ref={globalEndRef} />
                                </div>
                            )}

                            {/* FRIENDS LIST */}
                            {activeTab === 'friends' && !activeChatFriend && (
                                <div className="p-3 flex flex-col gap-2">
                                    <div className="relative">
                                        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
                                        <input
                                            type="text"
                                            placeholder="Search friends..."
                                            value={friendSearchQuery}
                                            onChange={(e) => setFriendSearchQuery(e.target.value)}
                                            className="w-full bg-black/50 text-white rounded-2xl pl-9 pr-4 py-2.5 text-[12px] focus:outline-none focus:ring-1 focus:ring-emerald-500/40 font-medium tracking-wide placeholder:text-gray-600 border border-white/[0.07] transition-colors"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        {friends.filter(f => f.friendName.toLowerCase().includes(friendSearchQuery.toLowerCase())).length === 0 && (
                                            <div className="flex flex-col items-center gap-2 mt-6 opacity-40">
                                                <Users size={24} className="text-emerald-400" />
                                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{friends.length === 0 ? "No friends yet." : "No matching friends."}</span>
                                            </div>
                                        )}
                                        {friends.filter(f => f.friendName.toLowerCase().includes(friendSearchQuery.toLowerCase())).map(f => (
                                            <button key={f.id} onClick={() => setActiveChatFriend(f)} className="flex items-center gap-3 p-3 bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.06] rounded-2xl transition-all text-left group">
                                                <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${nameColor(f.friendName)} flex items-center justify-center text-[11px] font-black text-white shrink-0`}>
                                                    {getInitials(f.friendName)}
                                                </div>
                                                <span className="font-black text-gray-200 uppercase tracking-widest text-[12px] truncate flex-1">{f.friendName}</span>
                                                <div className="p-1.5 bg-emerald-500/10 group-hover:bg-emerald-500/20 text-emerald-400 rounded-xl transition-colors">
                                                    <Users size={13} />
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* DM VIEW */}
                            {activeTab === 'friends' && activeChatFriend && (
                                <div className="flex-1 p-3 flex flex-col gap-2.5">
                                    {dmMessages.length === 0 && (
                                        <div className="flex flex-col items-center gap-2 mt-8 opacity-40">
                                            <MessageSquareDashed size={28} className="text-emerald-400" />
                                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Say hi to {activeChatFriend.friendName}!</span>
                                        </div>
                                    )}
                                    {dmMessages.map((msg, i) => {
                                        const isMe = msg.senderId === currentUserId;
                                        const showSender = i === 0 || dmMessages[i - 1]?.senderId !== msg.senderId;
                                        return (
                                            <div key={msg.id || i} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                                                {showSender && !isMe && (
                                                    <div className="flex items-center gap-1.5 mb-1 ml-1">
                                                        <div className={`w-5 h-5 rounded-full bg-gradient-to-br ${nameColor(msg.senderName)} flex items-center justify-center text-[8px] font-black text-white shrink-0`}>
                                                            {getInitials(msg.senderName)}
                                                        </div>
                                                        <span className="text-[9px] text-gray-500 font-black uppercase tracking-wider">{msg.senderName}</span>
                                                    </div>
                                                )}
                                                <div className={`px-3 py-2 text-[13px] max-w-[82%] break-words leading-snug shadow-md ${isMe
                                                    ? 'bg-gradient-to-br from-emerald-600 to-emerald-700 text-white rounded-2xl rounded-br-sm'
                                                    : 'bg-gray-800/80 text-gray-100 border border-white/[0.06] rounded-2xl rounded-bl-sm'}`}>
                                                    {msg.text}
                                                </div>
                                            </div>
                                        );
                                    })}
                                    <div ref={dmEndRef} />
                                </div>
                            )}

                            {/* UNKNOWN TAB */}
                            {activeTab === 'unknown' && (
                                <div className="p-3 flex flex-col gap-3">
                                    <form onSubmit={(e) => e.preventDefault()} className="flex gap-2">
                                        <div className="relative flex-1">
                                            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
                                            <input
                                                type="text"
                                                placeholder="Search by codename..."
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                                autoFocus
                                                className="w-full bg-black/50 text-white rounded-2xl pl-9 pr-4 py-2.5 text-[12px] focus:outline-none focus:ring-1 focus:ring-rose-500/40 font-medium tracking-wide placeholder:text-gray-600 border border-white/[0.07] transition-colors"
                                            />
                                        </div>
                                        <div className="flex items-center justify-center w-10 h-10 shrink-0 bg-rose-500/15 text-rose-400 rounded-2xl border border-rose-500/20">
                                            {isSearching ? <Activity className="animate-spin w-3.5 h-3.5" /> : <Search className="w-3.5 h-3.5" />}
                                        </div>
                                    </form>

                                    {searchError && <p className="text-rose-400 text-[11px] text-center font-black tracking-widest uppercase">{searchError}</p>}

                                    {!searchQuery.trim() && unknownChats.length > 0 && (
                                        <div className="flex flex-col gap-1.5">
                                            <p className="text-[9px] font-black text-gray-600 uppercase tracking-widest px-1">Recent Chats</p>
                                            {unknownChats.map(chat => (
                                                <button key={chat.id} onClick={() => { setActiveChatFriend(chat); setActiveTab('friends'); }} className="flex items-center gap-3 p-3 bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.06] rounded-2xl transition-all text-left group">
                                                    <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${nameColor(chat.friendName)} flex items-center justify-center text-[11px] font-black text-white shrink-0`}>
                                                        {getInitials(chat.friendName)}
                                                    </div>
                                                    <span className="font-black text-gray-200 uppercase tracking-widest text-[12px] truncate flex-1">{chat.friendName}</span>
                                                    <div className="p-1.5 bg-rose-500/10 group-hover:bg-rose-500/20 text-rose-400 rounded-xl transition-colors">
                                                        <MessageSquareDashed size={13} />
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    {searchResults.length === 0 && !isSearching && !searchError && !searchQuery.trim() && unknownChats.length === 0 && (
                                        <div className="flex flex-col items-center text-center mt-4 gap-3 opacity-50">
                                            <div className="w-12 h-12 bg-rose-500/10 text-rose-400 rounded-2xl flex items-center justify-center border border-rose-500/20">
                                                <Search size={20} />
                                            </div>
                                            <div>
                                                <p className="text-[11px] font-black text-white uppercase tracking-widest mb-1">Find Players</p>
                                                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider max-w-[180px]">Search by codename to start chatting.</p>
                                            </div>
                                        </div>
                                    )}

                                    {searchResults.length > 0 && searchQuery.trim() && (
                                        <div className="flex flex-col gap-1.5">
                                            {searchResults.map(user => (
                                                <button key={user.id} onClick={() => { setActiveChatFriend({ id: `${currentUserId}_${user.id}`.split('_').sort().join('_'), friendId: user.id, friendName: user.displayName }); setActiveTab('friends'); }} className="w-full flex items-center gap-3 p-3 bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.06] rounded-2xl transition-all text-left group">
                                                    <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${nameColor(user.displayName || '')} flex items-center justify-center text-[11px] font-black text-white shrink-0`}>
                                                        {getInitials(user.displayName || '?')}
                                                    </div>
                                                    <span className="font-black text-gray-200 uppercase tracking-widest text-[12px] truncate flex-1">{user.displayName || 'Unknown'}</span>
                                                    <div className="px-3 py-1.5 bg-rose-500/10 group-hover:bg-rose-500/20 text-rose-400 rounded-xl text-[10px] font-black uppercase tracking-widest border border-rose-500/20 transition-colors shrink-0">Message</div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* ── INPUT FORMS ── */}
                        {activeTab === 'global' && (
                            <form onSubmit={handleSendGlobalMessage} className="shrink-0 p-3 bg-black/60 border-t border-white/[0.06] flex gap-2">
                                <input
                                    type="text"
                                    value={newGlobalMessage}
                                    onChange={e => setNewGlobalMessage(e.target.value)}
                                    placeholder="Type globally..."
                                    className="flex-1 bg-gray-900/80 border border-white/[0.08] rounded-2xl px-4 py-2.5 text-[13px] text-white focus:outline-none focus:border-blue-500/50 focus:bg-gray-900 placeholder-gray-600 transition-all"
                                />
                                <button type="submit" disabled={!newGlobalMessage.trim()} className="w-10 h-10 flex items-center justify-center bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-2xl transition-all shadow-lg shadow-blue-900/30 shrink-0">
                                    <Send size={15} />
                                </button>
                            </form>
                        )}
                        {activeTab === 'friends' && activeChatFriend && (
                            <form onSubmit={handleSendDm} className="shrink-0 p-3 bg-black/60 border-t border-white/[0.06] flex gap-2">
                                <input
                                    type="text"
                                    value={newDmMessage}
                                    onChange={e => setNewDmMessage(e.target.value)}
                                    placeholder={`Message ${activeChatFriend.friendName}...`}
                                    className="flex-1 bg-gray-900/80 border border-white/[0.08] rounded-2xl px-4 py-2.5 text-[13px] text-white focus:outline-none focus:border-emerald-500/50 focus:bg-gray-900 placeholder-gray-600 transition-all"
                                />
                                <button type="submit" disabled={!newDmMessage.trim()} className="w-10 h-10 flex items-center justify-center bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-2xl transition-all shadow-lg shadow-emerald-900/30 shrink-0">
                                    <Send size={15} />
                                </button>
                            </form>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {!isOpen && (
                <motion.button
                    aria-label="Open Global Chat"
                    whileHover={{ scale: 1.06 }}
                    whileTap={{ scale: 0.94 }}
                    onClick={() => setIsOpen(true)}
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-3 sm:px-5 rounded-full shadow-2xl shadow-blue-900/40 flex items-center justify-center gap-2 border border-white/10 relative overflow-hidden group"
                >
                    <div className="absolute inset-0 bg-white/0 group-hover:bg-white/5 transition-colors" />
                    <Globe size={18} className="shrink-0" />
                    <span className="hidden sm:inline font-black text-[11px] tracking-widest uppercase">Chat Hub</span>
                </motion.button>
            )}
        </div>
    );
};

export default GlobalChat;


