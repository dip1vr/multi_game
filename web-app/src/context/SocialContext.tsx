import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, limit, getDocs, doc, setDoc, deleteDoc, serverTimestamp, getDoc } from 'firebase/firestore';

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

interface SocialContextType {
    friends: Friend[];
    incomingRequests: FriendRequest[];
    outgoingRequests: Set<string>;
    loading: boolean;
    searchResults: any[];
    isSearching: boolean;
    searchError: string | null;
    searchUsers: (term: string) => Promise<void>;
    sendFriendRequest: (targetUserId: string, targetUsername: string) => Promise<void>;
    acceptFriendRequest: (request: FriendRequest) => Promise<void>;
    rejectFriendRequest: (requestId: string) => Promise<void>;
    challengeFriend: (friendId: string, friendName: string) => Promise<void>;
}

const SocialContext = createContext<SocialContextType | undefined>(undefined);

export const SocialProvider: React.FC<{ children: ReactNode; currentUserId: string; currentUsername: string }> = ({ children, currentUserId, currentUsername }) => {
    const [friends, setFriends] = useState<Friend[]>([]);
    const [incomingRequests, setIncomingRequests] = useState<FriendRequest[]>([]);
    const [outgoingRequests, setOutgoingRequests] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [searchError, setSearchError] = useState<string | null>(null);

    useEffect(() => {
        if (!currentUserId) {
            setLoading(false);
            return;
        }

        // Friends Listener
        const friendsQuery = query(collection(db, 'friends'), where('userIds', 'array-contains', currentUserId));
        const unsubFriends = onSnapshot(friendsQuery, (snapshot) => {
            const parsedFriends: Friend[] = [];
            snapshot.forEach(docSnap => {
                const data = docSnap.data();
                const friendId = data.userIds?.find((id: string) => id !== currentUserId);
                if (friendId) {
                    parsedFriends.push({
                        id: docSnap.id,
                        friendId,
                        friendName: data.userNames?.[friendId] || "Unknown Player"
                    });
                }
            });
            setFriends(parsedFriends);
            setLoading(false);
        });

        // Incoming Requests Listener
        const incomingQuery = query(collection(db, 'friendRequests'), where('receiverId', '==', currentUserId), where('status', '==', 'pending'));
        const unsubIncoming = onSnapshot(incomingQuery, (snapshot) => {
            const reqs: FriendRequest[] = [];
            snapshot.forEach(doc => reqs.push({ id: doc.id, ...doc.data() } as FriendRequest));
            setIncomingRequests(reqs.sort((a, b) => (b.timestamp?.toMillis() || 0) - (a.timestamp?.toMillis() || 0)));
        });

        // Outgoing Requests Listener
        const outgoingQuery = query(collection(db, 'friendRequests'), where('senderId', '==', currentUserId), where('status', '==', 'pending'));
        const unsubOutgoing = onSnapshot(outgoingQuery, (snapshot) => {
            const outs = new Set<string>();
            snapshot.forEach(doc => outs.add(doc.data().receiverId));
            setOutgoingRequests(outs);
        });

        return () => {
            unsubFriends();
            unsubIncoming();
            unsubOutgoing();
        };
    }, [currentUserId]);

    const searchUsers = async (term: string) => {
        if (!term.trim()) return;
        setIsSearching(true);
        setSearchError(null);
        try {
            const q = query(
                collection(db, 'users'),
                where('displayNameLowercase', '>=', term.toLowerCase()),
                where('displayNameLowercase', '<=', term.toLowerCase() + '\uf8ff'),
                limit(10)
            );
            const snapshot = await getDocs(q);
            const results: any[] = [];
            snapshot.forEach(docSnap => results.push({ id: docSnap.id, ...docSnap.data() }));
            setSearchResults(results);
            if (results.length === 0) setSearchError("NO OPERATIVE FOUND WITH THAT ALIAS.");
        } catch (err) {
            console.error(err);
            setSearchError("FAILED TO ACCESS GLOBAL DATABASE.");
        } finally {
            setIsSearching(false);
        }
    };

    const sendFriendRequest = async (targetUserId: string, _targetUsername: string) => {
        try {
            const friendPairId = [currentUserId, targetUserId].sort().join('_');
            const friendDoc = await getDoc(doc(db, 'friends', friendPairId));
            if (friendDoc.exists()) {
                throw new Error("Already in your neural network!");
            }
            await setDoc(doc(collection(db, 'friendRequests')), {
                senderId: currentUserId,
                senderName: currentUsername,
                receiverId: targetUserId,
                status: 'pending',
                timestamp: serverTimestamp()
            });
        } catch (err: any) {
            throw err;
        }
    };

    const acceptFriendRequest = async (request: FriendRequest) => {
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
    };

    const rejectFriendRequest = async (requestId: string) => {
        await deleteDoc(doc(db, 'friendRequests', requestId));
    };

    const challengeFriend = async (friendId: string, _friendName: string) => {
        try {
            const inviteRef = doc(collection(db, 'gameInvites'));
            await setDoc(inviteRef, {
                senderId: currentUserId,
                senderName: currentUsername,
                receiverId: friendId,
                status: 'pending',
                timestamp: serverTimestamp()
            });
            const event = new CustomEvent('initiate_challenge', {
                detail: {
                    inviteId: inviteRef.id,
                    friendId: friendId
                }
            });
            window.dispatchEvent(event);
        } catch (e) {
            console.error("Failed to challenge friend", e);
            throw e;
        }
    };

    return (
        <SocialContext.Provider value={{
            friends, incomingRequests, outgoingRequests, loading,
            searchResults, isSearching, searchError, searchUsers,
            sendFriendRequest, acceptFriendRequest, rejectFriendRequest,
            challengeFriend
        }}>
            {children}
        </SocialContext.Provider>
    );
};

export const useSocial = () => {
    const context = useContext(SocialContext);
    if (!context) throw new Error('useSocial must be used within a SocialProvider');
    return context;
};
