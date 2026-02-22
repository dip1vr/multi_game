import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Users, X, UserPlus, Check, XCircle, Search, Sword, Activity, Trophy, Frown, Equal, UserCheck, Clock } from 'lucide-react';
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
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

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
                setErrorMsg("Loading timed out. Check network or database rules.");
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
            setErrorMsg(`Requests Query Error: ${error.message}`);
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
            setErrorMsg(`Friends Query Error: ${error.message}`);
            setLoading(false);
        });

        return () => unsubFriends();
    }, [currentUserId]);

    const handleAcceptRequest = async (request: FriendRequest) => {
        try {
            // Create friendship document
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

            // Delete request
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
            // Create an invite document for the friend
            const inviteRef = doc(collection(db, 'gameInvites'));
            await setDoc(inviteRef, {
                senderId: currentUserId,
                senderName: currentUsername,
                receiverId: friend.friendId,
                status: 'pending',
                timestamp: serverTimestamp()
            });

            // Close modal and let the main app handle room creation
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
                where('displayName', '==', term),
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
            if (results.length === 0) {
                setSearchError("No players found with that exact name.");
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
            // Check if request already outgoing
            if (outgoingRequests.has(userResult.id)) {
                return;
            }

            // Check if already friends
            const friendPairId = [currentUserId, userResult.id].sort().join('_');
            const friendDoc = await getDoc(doc(db, 'friends', friendPairId));
            if (friendDoc.exists()) {
                alert("You are already friends!");
                return;
            }

            // Send request
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

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="w-full max-w-md bg-[#0a0a0c] border border-white/10 rounded-3xl shadow-2xl flex flex-col overflow-hidden relative max-h-[80vh]"
            >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 via-teal-500 to-cyan-500"></div>

                <div className="flex items-center justify-between p-6 border-b border-white/10 bg-white/5 pb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-500/20 rounded-xl border border-emerald-500/30">
                            <Users size={24} className="text-emerald-400" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-white italic tracking-widest uppercase leading-none">Friends</h2>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
                        <X size={24} />
                    </button>
                </div>


                <div className="flex px-4 pt-4 gap-2">
                    <button
                        onClick={() => setActiveTab('friends')}
                        className={`flex-1 py-2 text-sm font-black tracking-widest uppercase rounded-lg transition-all ${activeTab === 'friends' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-gray-500 hover:bg-white/5 border border-transparent'}`}
                    >
                        Friends List ({friends.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('requests')}
                        className={`flex-1 py-2 text-sm font-black tracking-widest uppercase rounded-lg transition-all relative ${activeTab === 'requests' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'text-gray-500 hover:bg-white/5 border border-transparent'}`}
                    >
                        Requests
                        {requests.length > 0 && (
                            <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white flex items-center justify-center text-[10px] rounded-full">{requests.length}</span>
                        )}
                    </button>
                    <button
                        onClick={() => setActiveTab('add')}
                        className={`flex-1 py-2 text-sm font-black tracking-widest uppercase rounded-lg transition-all ${activeTab === 'add' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'text-gray-500 hover:bg-white/5 border border-transparent'}`}
                    >
                        Add Friend
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                    {errorMsg && (
                        <div className="p-3 mb-4 text-xs font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl">
                            {errorMsg}
                        </div>
                    )}

                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-40 text-gray-500 space-y-4">
                            <Activity size={32} className="animate-spin text-emerald-500" />
                        </div>
                    ) : activeTab === 'friends' ? (
                        <div className="space-y-4">
                            <div className="relative">
                                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                                <input
                                    type="text"
                                    placeholder="Search friends..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="w-full bg-black/40 text-white rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500/50 font-medium tracking-wide placeholder:text-gray-600 border border-white/5"
                                />
                            </div>
                            {filteredFriends.length === 0 ? (
                                <div className="text-center py-10 text-gray-500">
                                    <p className="text-xs font-bold uppercase tracking-widest">No friends found.</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {filteredFriends.map(f => (
                                        <div key={f.id} className="flex items-center justify-between p-3 bg-black/40 border border-white/5 rounded-xl">
                                            <span className="font-black text-gray-200 uppercase tracking-widest truncate">{f.friendName}</span>
                                            <div className="flex gap-2">

                                                <button
                                                    onClick={() => handleChallenge(f)}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-lg text-xs font-black uppercase tracking-widest transition-colors"
                                                >
                                                    <Sword size={14} /> Challenge
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : activeTab === 'requests' ? (
                        <div className="space-y-2">
                            {requests.length === 0 ? (
                                <div className="text-center py-10 text-gray-500">
                                    <p className="text-xs font-bold uppercase tracking-widest">No pending requests.</p>
                                </div>
                            ) : (
                                requests.map(req => (
                                    <div key={req.id} className="flex items-center justify-between p-3 bg-blue-900/10 border border-blue-500/20 rounded-xl">
                                        <div className="flex flex-col">
                                            <span className="font-black text-gray-200 uppercase tracking-widest truncate">{req.senderName}</span>
                                            <span className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">Wants to be friends</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => handleRejectRequest(req.id)} className="p-2 text-gray-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors">
                                                <XCircle size={18} />
                                            </button>
                                            <button onClick={() => handleAcceptRequest(req)} className="p-2 text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-lg transition-colors">
                                                <Check size={18} />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    ) : activeTab === 'add' ? (
                        <div className="space-y-4">
                            <form onSubmit={handleGlobalSearch} className="flex gap-2 relative">
                                <input
                                    type="text"
                                    placeholder="Enter exact player name..."
                                    value={globalSearchQuery}
                                    onChange={(e) => setGlobalSearchQuery(e.target.value)}
                                    className="flex-1 bg-black/40 text-white rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500/50 font-medium tracking-wide placeholder:text-gray-600 border border-white/5"
                                />
                                <button type="submit" disabled={isSearching} className="px-4 py-2 bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 rounded-xl font-black uppercase text-xs tracking-widest border border-purple-500/30 transition-colors">
                                    {isSearching ? <Activity className="animate-spin w-4 h-4" /> : <Search className="w-4 h-4" />}
                                </button>
                            </form>

                            {searchError && (
                                <p className="text-rose-400 text-xs text-center font-bold tracking-widest uppercase">{searchError}</p>
                            )}

                            {searchResults.length > 0 && (
                                <div className="space-y-2">
                                    {searchResults.map(user => (
                                        <div key={user.id} className="p-3 bg-black/40 border border-white/5 rounded-xl flex items-center justify-between">
                                            <div className="flex flex-col">
                                                <span className="font-black text-gray-200 uppercase tracking-widest">{user.displayName || 'Unknown'}</span>
                                                <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-500 font-bold tracking-widest uppercase">
                                                    <span className="flex items-center gap-1 text-emerald-400"><Trophy size={10} /> {user.wins || 0}</span>
                                                    <span className="flex items-center gap-1 text-rose-400"><Frown size={10} /> {user.losses || 0}</span>
                                                    <span className="flex items-center gap-1 text-blue-400"><Equal size={10} /> {user.draws || 0}</span>
                                                </div>
                                            </div>
                                            {(() => {
                                                const isFriend = friends.some(f => f.friendId === user.id);
                                                const hasSent = outgoingRequests.has(user.id);
                                                const hasReceived = requests.some(req => req.senderId === user.id);

                                                if (isFriend) {
                                                    return (
                                                        <button disabled className="p-2 text-emerald-400 bg-emerald-500/10 rounded-lg border border-emerald-500/30 opacity-50 cursor-not-allowed" title="Already Friends">
                                                            <UserCheck size={16} />
                                                        </button>
                                                    );
                                                }
                                                if (hasSent) {
                                                    return (
                                                        <button disabled className="p-2 text-yellow-500 bg-yellow-500/10 rounded-lg border border-yellow-500/30 opacity-50 cursor-not-allowed" title="Request Sent">
                                                            <Clock size={16} />
                                                        </button>
                                                    );
                                                }
                                                if (hasReceived) {
                                                    return (
                                                        <button
                                                            onClick={() => {
                                                                const req = requests.find(r => r.senderId === user.id);
                                                                if (req) handleAcceptRequest(req);
                                                            }}
                                                            className="p-2 text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 rounded-lg border border-blue-500/30 transition-colors" title="Accept Request">
                                                            <Check size={16} />
                                                        </button>
                                                    );
                                                }
                                                return (
                                                    <button
                                                        onClick={() => handleSendGlobalRequest(user)}
                                                        className="p-2 text-purple-400 bg-purple-500/10 hover:bg-purple-500/20 rounded-lg transition-colors border border-purple-500/30" title="Add Friend">
                                                        <UserPlus size={16} />
                                                    </button>
                                                );
                                            })()}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : null}
                </div>
            </motion.div>
        </div>
    );
};

export default FriendsModal;
