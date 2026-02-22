import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Trash2, Shield, Sword, UserPlus, Trophy,
  Crown, Zap, Activity, ChevronDown, Check, Handshake, Edit2,
  LogOut, Info, ShieldAlert, MessageSquare, XCircle
} from 'lucide-react';
import { db, auth, googleProvider } from './firebase';
import {
  doc, setDoc, onSnapshot, getDoc, updateDoc, collection,
  query, where, limit, increment, getDocs, serverTimestamp, addDoc, arrayUnion
} from 'firebase/firestore';
import { signInWithPopup, signInAnonymously, onAuthStateChanged, signOut, linkWithPopup, User as FirebaseAuthUser } from 'firebase/auth';

import { datasets } from './dataStore';
import { Character, GameState, Player, GameMode, PlayerRole, Room } from './types';
import { getRolesForMode, calculateBattle } from './gameLogic';
import { SetupScreen } from './components/SetupScreen';
import { TeamDisplay, roleIconsMapping } from './components/TeamDisplay';
import Leaderboard from './components/Leaderboard';
import FriendsModal from './components/FriendsModal';
import GlobalChat from './components/GlobalChat';


const INITIAL_PLAYER = (name: string): Player => ({
  name,
  team: {},
  skips: 2,
});

const generateRoomCode = () => {
  return Math.random().toString(36).substring(2, 7).toUpperCase();
};

// roleIconsMapping moved to src/components/TeamDisplay.tsx


// SearchableSelect moved to src/components/SearchableSelect.tsx


// SetupScreen moved to src/components/SetupScreen.tsx


// TeamDisplay moved to src/components/TeamDisplay.tsx


const App: React.FC = () => {
  const [localRole, setLocalRole] = useState<PlayerRole>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState<string>('');

  const [username, setUsername] = useState<string>('');
  const [localUserId, setLocalUserId] = useState<string>('');
  const [isUsernameSet, setIsUsernameSet] = useState<boolean>(false);
  const [isEditingUsername, setIsEditingUsername] = useState<boolean>(false);
  const [tempUsername, setTempUsername] = useState<string>('');
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [showProfileMenu, setShowProfileMenu] = useState<boolean>(false);

  // Auth & Leaderboard State
  const [authUser, setAuthUser] = useState<FirebaseAuthUser | null>(null);
  const [showLeaderboard, setShowLeaderboard] = useState<boolean>(false);
  const [showFriendsModal, setShowFriendsModal] = useState<boolean>(false);
  const [incomingInvite, setIncomingInvite] = useState<any>(null);
  const [pendingRequestsCount, setPendingRequestsCount] = useState<number>(0);
  const [processedGameId, setProcessedGameId] = useState<string | null>(null);
  const [userStats, setUserStats] = useState<{ wins: number, losses: number, draws: number } | null>(null);
  const [matchToReconnect, setMatchToReconnect] = useState<Room | null>(null);


  // Listen for incoming Game Invites + Friend Requests count
  useEffect(() => {
    if (!localUserId) return;

    // Listen for Game Invites
    const invitesQuery = query(collection(db, 'gameInvites'), where('receiverId', '==', localUserId), where('status', '==', 'pending'));
    const unsubInvites = onSnapshot(invitesQuery, (snapshot) => {
      let latestInvite: any = null;
      snapshot.forEach(doc => {
        latestInvite = { id: doc.id, ...doc.data() };
      });
      setIncomingInvite(latestInvite);
    });

    // Listen for incoming Friend Requests to show a badge
    const reqsQuery = query(collection(db, 'friendRequests'), where('receiverId', '==', localUserId), where('status', '==', 'pending'));
    const unsubReqs = onSnapshot(reqsQuery, (snapshot) => {
      setPendingRequestsCount(snapshot.size);
    });

    return () => {
      unsubInvites();
      unsubReqs();
    };
  }, [localUserId]);

  const handleAcceptInvite = async () => {
    if (!incomingInvite) return;
    try {
      await updateDoc(doc(db, 'gameInvites', incomingInvite.id), { status: 'accepted' });
      if (incomingInvite.roomId) {
        await joinRoomWithCode(incomingInvite.roomId);
      } else {
        // Wait a moment if the host hasn't created the room document yet
        setTimeout(() => {
          getDoc(doc(db, 'gameInvites', incomingInvite.id)).then(snap => {
            if (snap.exists() && snap.data().roomId) {
              joinRoomWithCode(snap.data().roomId);
            }
          });
        }, 1500);
      }
      setIncomingInvite(null);
    } catch (e) {
      console.error("Failed to accept invite", e);
    }
  };

  const handleDeclineInvite = async () => {
    if (!incomingInvite) return;
    try {
      await updateDoc(doc(db, 'gameInvites', incomingInvite.id), { status: 'declined' });
      setIncomingInvite(null);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    let unsubSnapshot: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setAuthUser(currentUser);

      // Cleanup previous listener if auth state changes
      if (unsubSnapshot) {
        unsubSnapshot();
        unsubSnapshot = null;
      }

      if (currentUser) {
        const uid = currentUser.uid;
        const userRef = doc(db, 'users', uid);

        // 1. Listen Document Live for Existing Data
        unsubSnapshot = onSnapshot(userRef, async (snap) => {
          let dbName = null;

          if (snap.exists()) {
            const data = snap.data();
            dbName = data.displayName;
            setUserStats({
              wins: data?.wins || 0,
              losses: data?.losses || 0,
              draws: data?.draws || 0
            });

            // Auto-Migration: Populate missing displayNameLowercase for existing users
            if (dbName && !data.displayNameLowercase) {
              console.log("[Migration] User needs migration:", uid, dbName);
              setDoc(userRef, { displayNameLowercase: dbName.toLowerCase() }, { merge: true })
                .then(() => console.log("[Migration] Success for", uid))
                .catch(err => console.error("[Migration] Error for", uid, err));
            }

            // 5. Upgrade Photo URL if linked Google recently
            if (!currentUser.isAnonymous && currentUser.photoURL && data.photoURL !== currentUser.photoURL) {
              setDoc(userRef, { photoURL: currentUser.photoURL, displayName: currentUser.displayName }, { merge: true }).catch(console.error);
            }
          } else {
            const newStats = {
              displayName: currentUser.displayName || "",
              photoURL: currentUser.photoURL || "",
              wins: 0,
              losses: 0,
              draws: 0,
              isGuest: currentUser.isAnonymous,
              displayNameLowercase: (currentUser.displayName || "").toLowerCase()
            };
            await setDoc(userRef, newStats, { merge: true });
            setUserStats({ wins: 0, losses: 0, draws: 0 });
          }

          // 2. Resolve final display name (Google -> Firestore -> LocalStorage)
          let resolvedName = currentUser.displayName || dbName;

          if (!resolvedName || resolvedName === "Player") {
            const localName = localStorage.getItem('multi_battle_username');
            if (localName && localName !== "Player") {
              resolvedName = localName;
              // Sync up to Db
              setDoc(userRef, {
                displayName: localName,
                displayNameLowercase: localName.toLowerCase()
              }, { merge: true }).catch(console.error);
            }
          }

          // 3. Set standard identifiers
          setLocalUserId(uid);
          localStorage.setItem('multi_battle_userid', uid);

          // 4. Decide if user needs to go to Setup screen
          if (resolvedName && resolvedName !== "Player") {
            setUsername(resolvedName);
            localStorage.setItem('multi_battle_username', resolvedName);
            setIsUsernameSet(true);

            // 6. Check for Reconnection if not already in a room
            if (!roomId) {
              const savedRoomId = localStorage.getItem('multi_battle_roomid');
              const savedRole = localStorage.getItem('multi_battle_role') as PlayerRole;
              if (savedRoomId && savedRole) {
                getDoc(doc(db, "games", savedRoomId)).then(roomSnap => {
                  if (roomSnap.exists()) {
                    const roomData = roomSnap.data() as Room;
                    const activeStates = ["drafting", "ready"];
                    if (activeStates.includes(roomData.gameState.status)) {
                      setMatchToReconnect(roomData);
                    } else {
                      localStorage.removeItem('multi_battle_roomid');
                      localStorage.removeItem('multi_battle_role');
                    }
                  }
                });
              }
            }
          } else {
            setUsername("");
            setIsUsernameSet(false);
          }
        });
      } else {
        // Automatically attempt anonymous login if no session is found
        try {
          await signInAnonymously(auth);
        } catch (e) {
          console.error("Anonymous auth failed", e);
        }
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubSnapshot) unsubSnapshot();
    };
  }, []);

  // Persist Current Match Info
  useEffect(() => {
    if (roomId && localRole) {
      localStorage.setItem('multi_battle_roomid', roomId);
      localStorage.setItem('multi_battle_role', localRole);
    }
  }, [roomId, localRole]);

  const handleLogin = async () => {
    try {
      if (auth.currentUser && auth.currentUser.isAnonymous) {
        try {
          await linkWithPopup(auth.currentUser, googleProvider);
        } catch (linkError: any) {
          if (linkError.code === 'auth/credential-already-in-use') {
            // Account already linked elsewhere, just normal sign-in
            await signInWithPopup(auth, googleProvider);
          } else {
            throw linkError;
          }
        }
      } else {
        await signInWithPopup(auth, googleProvider);
      }
    } catch (error) {
      console.error("Login failed:", error);
      alert("Failed to sign in with Google.");
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setRoomId(null);
      setIsUsernameSet(false);
      setUsername("");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  // Old useEffect has been merged into auth listener.

  const handleSaveUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim().length > 0) {
      localStorage.setItem('multi_battle_username', username.trim());
      setIsUsernameSet(true);

      // If anonymous, update the database document with their chosen name
      if (authUser && authUser.isAnonymous) {
        try {
          const userRef = doc(db, 'users', authUser.uid);
          await setDoc(userRef, {
            displayName: username.trim(),
            displayNameLowercase: username.trim().toLowerCase()
          }, { merge: true });
        } catch (e) { }
      }
    }
  };

  const handleUpdateUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    if (tempUsername.trim().length > 0) {
      localStorage.setItem('multi_battle_username', tempUsername.trim());
      setUsername(tempUsername.trim());
      setIsEditingUsername(false);

      if (authUser) {
        try {
          const userRef = doc(db, 'users', authUser.uid);
          await setDoc(userRef, {
            displayName: tempUsername.trim(),
            displayNameLowercase: tempUsername.trim().toLowerCase()
          }, { merge: true });
        } catch (e) { }
      }
    }
  };

  const [gameState, setGameState] = useState<GameState>({
    config: { mode: "Anime", series: null },
    p1: INITIAL_PLAYER("Player 1"),
    p2: INITIAL_PLAYER("Player 2"),
    turn: "p1",
    currentDraw: null,
    nextDraws: [],
    turnStartTime: 0,
    status: "setup",
    winner: null,
    p1Misses: 0,
    p2Misses: 0,
    battleLog: [],
  });

  // Custom Event Listener for initiating a challenge from FriendsModal
  useEffect(() => {
    const handleInitiateChallenge = async (e: Event) => {
      const customEvent = e as CustomEvent;
      const { inviteId } = customEvent.detail;

      // We host a private room and update the invite with the roomId
      setLoadingAction('hosting-private');
      try {
        const code = generateRoomCode();
        const initialGameState = {
          ...gameState,
          p1: INITIAL_PLAYER(username)
        };
        const newRoom: Room = {
          id: code,
          host: username,
          hostId: localUserId,
          guest: null,
          gameState: initialGameState,
          createdAt: Date.now(),
          isPublic: false,
          intendedPublic: false
        };
        await setDoc(doc(db, "games", code), newRoom);
        setRoomId(code);
        setLocalRole("p1");

        // Update the invite with the generated room code
        await updateDoc(doc(db, "gameInvites", inviteId), {
          roomId: code
        });
      } catch (err) {
        console.error("Failed to create room for challenge", err);
        alert("Failed to initiate challenge.");
      } finally {
        setLoadingAction(null);
      }
    };

    window.addEventListener('initiate_challenge', handleInitiateChallenge);
    return () => window.removeEventListener('initiate_challenge', handleInitiateChallenge);
  }, [username, localUserId, gameState]);

  const [guestPlayer, setGuestPlayer] = useState<string | null>(null);
  const [hostId, setHostId] = useState<string | null>(null);
  const [guestId, setGuestId] = useState<string | null>(null);
  const [activeEmoji, setActiveEmoji] = useState<{ emoji: string, id: number } | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const lastEmojiTime = useRef<number>(0);
  const EMOJIS = ["🔥", "💀", "🤡", "🥶", "🤯", "🤣", "👍", "👎"];
  const [openRooms, setOpenRooms] = useState<Room[]>([]);
  const [roomChat, setRoomChat] = useState<{ senderId: string, senderName: string, text: string, timestamp: number }[]>([]);
  const [chatMessage, setChatMessage] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);

  useEffect(() => {
    if (isChatOpen) chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [roomChat, isChatOpen]);

  useEffect(() => {
    if (roomId) return; // Only fetch if not in a room

    const q = query(
      collection(db, "games"),
      where("isPublic", "==", true),
      where("guest", "==", null),
      limit(10)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const rooms: Room[] = [];
      snapshot.forEach((docSnap) => {
        rooms.push(docSnap.data() as Room);
      });
      setOpenRooms(rooms);
    });

    return () => unsub();
  }, [roomId]);

  useEffect(() => {
    if (!roomId) return;
    const unsub = onSnapshot(doc(db, "games", roomId), (docSnapshot) => {
      if (docSnapshot.exists()) {
        const data = docSnapshot.data() as Room;
        setGameState(data.gameState);
        setGuestPlayer(data.guest);
        setHostId(data.hostId);
        setGuestId(data.guestId || null);
        setRoomChat(data.chat || []);

        if (data.latestEmoji && data.latestEmoji.timestamp > lastEmojiTime.current) {
          lastEmojiTime.current = data.latestEmoji.timestamp;
          // Only show reaction for the receiver, not the sender
          if (data.latestEmoji.senderId !== localUserId) {
            setActiveEmoji({ emoji: data.latestEmoji.emoji, id: data.latestEmoji.timestamp });
            setTimeout(() => setActiveEmoji(null), 3000);
          }
        }

        // Auto-start draft if we were waiting for player
        if (data.guest && localRole === "p1" && data.gameState.status === "waiting_for_player") {
          updateFirestoreState({
            status: "drafting",
            turn: Math.random() > 0.5 ? "p1" : "p2",
            turnStartTime: Date.now(),
            p1Misses: 0,
            p2Misses: 0,
          });
        }
      }
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, localRole]);

  const updateFirestoreState = async (partialState: Partial<GameState>) => {
    if (!roomId) return;
    const updates: Record<string, any> = {};
    for (const [key, value] of Object.entries(partialState)) {
      updates[`gameState.${key}`] = value;
    }
    await updateDoc(doc(db, "games", roomId), updates);
  };

  const createRoom = async (isPublic: boolean) => {
    setLoadingAction(isPublic ? 'hosting-public' : 'hosting-private');
    try {
      const code = generateRoomCode();

      const initialGameState = {
        ...gameState,
        p1: INITIAL_PLAYER(username)
      };

      const newRoom: Room = {
        id: code,
        host: username,
        hostId: localUserId,
        guest: null,
        gameState: initialGameState,
        createdAt: Date.now(),
        isPublic: false,
        intendedPublic: isPublic
      };
      await setDoc(doc(db, "games", code), newRoom);
      setRoomId(code);
      setLocalRole("p1");
    } catch (error) {
      console.error("Failed to create room:", error);
      alert("Failed to create room. Please try again.");
    } finally {
      setLoadingAction(null);
    }
  };

  const joinRoomWithCode = async (codeToJoin: string, actionName: string = 'joining') => {
    if (!codeToJoin) return;
    setLoadingAction(actionName);
    try {
      const roomRef = doc(db, "games", codeToJoin.toUpperCase());
      const snap = await getDoc(roomRef);
      if (snap.exists()) {
        const roomData = snap.data() as Room;

        if (roomData.hostId === localUserId) {
          alert("You cannot join your own match!");
          return;
        }

        await updateDoc(roomRef, {
          guest: username,
          guestId: localUserId,
          'gameState.p2.name': username
        });
        setRoomId(codeToJoin.toUpperCase());
        setLocalRole("p2");
      } else {
        alert("Room not found!");
      }
    } catch (error) {
      console.error("Failed to join room:", error);
      alert("Failed to join room. Please try again.");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    joinRoomWithCode(joinCode);
  };

  const handleContinueMatch = () => {
    if (!matchToReconnect) return;
    const savedRole = localStorage.getItem('multi_battle_role') as PlayerRole;
    setRoomId(matchToReconnect.id);
    setLocalRole(savedRole);
    setMatchToReconnect(null);
  };

  const handleSurrender = async () => {
    if (!matchToReconnect) return;
    setLoadingAction('surrendering');
    try {
      const opponentName = localRole === 'p1' ? matchToReconnect.guest : matchToReconnect.host;
      await updateDoc(doc(db, "games", matchToReconnect.id), {
        'gameState.status': 'finished',
        'gameState.winner': opponentName || "Opponent",
        'gameState.p1Score': 0,
        'gameState.p2Score': 0,
        'gameState.battleLog': ["Match ended by surrender."]
      });
      localStorage.removeItem('multi_battle_roomid');
      localStorage.removeItem('multi_battle_role');
      setMatchToReconnect(null);
    } catch (err) {
      console.error("Failed to surrender:", err);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleInGameSurrender = async () => {
    if (!roomId) return;
    if (!window.confirm("Are you sure you want to surrender? You will lose this match.")) return;

    setLoadingAction('surrendering');
    try {
      await updateDoc(doc(db, "games", roomId), {
        'gameState.status': 'finished',
        'gameState.winner': opponentName || "Opponent",
        'gameState.p1Score': 0,
        'gameState.p2Score': 0,
        'gameState.battleLog': ["Match ended by surrender."]
      });
    } catch (err) {
      console.error("Failed to surrender:", err);
    } finally {
      setLoadingAction(null);
    }
  };

  const [pool, setPool] = useState<Character[]>([]);
  const [usedIndices, setUsedIndices] = useState<Set<number>>(new Set());

  const opponentId = localRole === 'p1' ? guestId : hostId;
  const opponentName = localRole === 'p1' ? gameState.p2.name : gameState.p1.name;

  const handleSendFriendRequest = async () => {
    if (!localUserId || !opponentId) return;
    try {
      const pairId = [localUserId, opponentId].sort().join('_');
      const friendDoc = await getDoc(doc(db, 'friends', pairId));
      if (friendDoc.exists()) {
        alert("You are already friends!");
        return;
      }

      const qOut = query(collection(db, 'friendRequests'), where('senderId', '==', localUserId), where('receiverId', '==', opponentId), where('status', '==', 'pending'));
      const outSnap = await getDocs(qOut);
      if (!outSnap.empty) {
        alert("Request already sent!");
        return;
      }

      const qIn = query(collection(db, 'friendRequests'), where('senderId', '==', opponentId), where('receiverId', '==', localUserId), where('status', '==', 'pending'));
      const inSnap = await getDocs(qIn);
      if (!inSnap.empty) {
        alert("They already sent you a friend request! Check your friends tab.");
        return;
      }

      await addDoc(collection(db, 'friendRequests'), {
        senderId: localUserId, senderName: username, receiverId: opponentId, receiverName: opponentName, status: 'pending', timestamp: serverTimestamp()
      });
      alert("Friend request sent!");
    } catch (err: any) {
      alert("Failed to send request: " + err.message);
    }
  };

  const sendEmoji = (emoji: string) => {
    setShowEmojiPicker(false);
    updateDoc(doc(db, 'games', roomId!), {
      latestEmoji: { senderId: localUserId, emoji, timestamp: Date.now() }
    }).catch(console.error);
  };

  const handleSendMatchChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim() || !roomId || !localUserId) return;
    try {
      await updateDoc(doc(db, 'games', roomId), {
        chat: arrayUnion({
          senderId: localUserId,
          senderName: username,
          text: chatMessage.trim(),
          timestamp: Date.now()
        })
      });
      setChatMessage("");
    } catch (err) {
      console.error("Failed to send chat", err);
    }
  };

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

    if (guestPlayer) {
      updateFirestoreState({
        config: { mode, series: series === "All" ? null : series },
        status: "drafting",
        turn: Math.random() > 0.5 ? "p1" : "p2",
        turnStartTime: Date.now(),
      });
    } else {
      updateFirestoreState({
        config: { mode, series: series === "All" ? null : series },
        p1Misses: 0,
        p2Misses: 0,
        status: "waiting_for_player",
      });

      if (roomId) {
        const roomRef = doc(db, "games", roomId);
        getDoc(roomRef).then((snap) => {
          if (snap.exists() && snap.data().intendedPublic) {
            updateDoc(roomRef, { isPublic: true });
          }
        }).catch(console.error);
      }
    }
  };

  const replenishQueue = () => {
    let needed = 4 - (gameState.nextDraws?.length || 0);
    if (!gameState.currentDraw) needed += 1;
    if (needed <= 0) return null;

    const drawn: Character[] = [];
    const newUsed = new Set(usedIndices);

    for (let i = 0; i < needed; i++) {
      if (newUsed.size >= pool.length) break;
      let index;
      let attempts = 0;
      do {
        index = Math.floor(Math.random() * pool.length);
        attempts++;
      } while (newUsed.has(index) && attempts < 100);
      newUsed.add(index);
      drawn.push(pool[index]);
    }

    if (drawn.length === 0) return null;
    setUsedIndices(newUsed);

    const updates: Partial<GameState> = {};
    let drawnIdx = 0;

    if (!gameState.currentDraw && drawnIdx < drawn.length) {
      updates.currentDraw = drawn[drawnIdx++];
    }

    if (drawnIdx < drawn.length) {
      updates.nextDraws = [...(gameState.nextDraws || []), ...drawn.slice(drawnIdx)];
    }

    return updates;
  };

  // Recovery Effect for Pool and Used Indices
  useEffect(() => {
    if ((gameState.status === 'drafting' || gameState.status === 'ready') && pool.length === 0 && gameState.config.mode) {
      console.log("[Recovery] Rebuilding character pool and used indices...");
      let chars = datasets[gameState.config.mode] as any[];
      const series = gameState.config.series;
      if (series && series !== "All") {
        if (gameState.config.mode === "Pokemon") {
          chars = chars.filter(c => c.region === series);
        } else {
          chars = chars.filter(c => c.series === series);
        }
      }
      chars = chars.filter(c => c.stats !== null);
      setPool(chars);

      // Reconstruct used indices to prevent duplicates
      const used = new Set<number>();
      const allPickedNames = new Set([
        ...Object.values(gameState.p1.team).map(c => c?.name),
        ...Object.values(gameState.p2.team).map(c => c?.name),
        gameState.currentDraw?.name,
        ...(gameState.nextDraws || []).map(c => c?.name)
      ].filter(Boolean));

      chars.forEach((c, idx) => {
        if (allPickedNames.has(c.name)) {
          used.add(idx);
        }
      });
      setUsedIndices(used);
    }
  }, [gameState.status, gameState.config.mode, gameState.config.series, pool.length, gameState.p1.team, gameState.p2.team, gameState.currentDraw?.name, gameState.nextDraws?.length]);

  useEffect(() => {
    if (localRole !== "p1") return; // Only host handles generating chars

    if (gameState.status === "drafting" && pool.length > 0) {
      const updates = replenishQueue();
      if (updates) {
        updateFirestoreState(updates);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState.status, gameState.currentDraw?.name, gameState.nextDraws?.length, pool, localRole]);

  const roles = getRolesForMode(gameState.config.mode);

  const assignRole = (role: string) => {
    if (!gameState.currentDraw) return;
    if (gameState.turn !== localRole) return; // Prevent out-of-turn assignment

    const currentPlayerKey = gameState.turn;
    const opponentPlayerKey = gameState.turn === "p1" ? "p2" : "p1";

    const updatedCurrentPlayer = {
      ...gameState[currentPlayerKey],
      team: { ...gameState[currentPlayerKey].team, [role]: gameState.currentDraw },
    };

    const isFinished =
      Object.keys(updatedCurrentPlayer.team).length === roles.length &&
      Object.keys(gameState[opponentPlayerKey].team).length === roles.length;

    const nextTurn = gameState.turn === "p1" ? "p2" : "p1";
    let nextChar = null;
    let nextQueue = gameState.nextDraws || [];

    if (!isFinished && nextQueue.length > 0) {
      nextChar = nextQueue[0];
      nextQueue = nextQueue.slice(1);
    }

    let newState: Partial<GameState> = {
      [currentPlayerKey]: updatedCurrentPlayer,
      turn: nextTurn,
      currentDraw: isFinished ? null : nextChar,
      nextDraws: nextQueue,
      turnStartTime: Date.now(),
    };

    if (isFinished) {
      const { s1, s2, log } = calculateBattle(
        gameState.config.mode,
        (currentPlayerKey === "p1" ? updatedCurrentPlayer : gameState.p1).team,
        (currentPlayerKey === "p2" ? updatedCurrentPlayer : gameState.p2).team,
        gameState.p1.name,
        gameState.p2.name
      );
      newState = {
        ...newState,
        status: "finished",
        winner: s1 > s2 ? gameState.p1.name : (s2 > s1 ? gameState.p2.name : "Draw"),
        p1Score: s1,
        p2Score: s2,
        battleLog: log,
      };
    }

    setGameState(prev => ({ ...prev, ...newState } as GameState));
    updateFirestoreState(newState);
  };

  const skipTurn = () => {
    if (gameState.turn !== localRole) return;
    const currentPlayer = gameState[gameState.turn];
    if (currentPlayer.skips <= 0) return;

    let nextChar = null;
    let nextQueue = gameState.nextDraws || [];

    if (nextQueue.length > 0) {
      nextChar = nextQueue[0];
      nextQueue = nextQueue.slice(1);
    }

    let newState: Partial<GameState> = {
      [gameState.turn]: { ...currentPlayer, skips: currentPlayer.skips - 1 },
      turn: gameState.turn === "p1" ? "p2" : "p1",
      currentDraw: nextChar,
      nextDraws: nextQueue,
      turnStartTime: Date.now(),
    };

    setGameState(prev => ({ ...prev, ...newState } as GameState));
    updateFirestoreState(newState);
  };

  const [timeLeft, setTimeLeft] = useState<number>(30);

  useEffect(() => {
    if (gameState.status !== "drafting") return;

    const interval = setInterval(() => {
      const elapsed = Date.now() - gameState.turnStartTime;
      const remaining = Math.max(0, 30 - Math.floor(elapsed / 1000));
      setTimeLeft(remaining);

      // Auto-assign logic if time runs out and it's our turn
      if (remaining === 0 && gameState.turn === localRole) {
        clearInterval(interval);

        // Timeout strike logic
        const currentMisses = localRole === 'p1' ? (gameState.p1Misses || 0) : (gameState.p2Misses || 0);
        const newMisses = currentMisses + 1;
        const missField = localRole === 'p1' ? 'p1Misses' : 'p2Misses';

        if (newMisses >= 3) {
          // Automatic loss due to inactivity
          const opponentName = localRole === 'p1' ? gameState.p2.name : gameState.p1.name;
          updateFirestoreState({
            status: 'finished',
            winner: opponentName || "Opponent",
            [missField]: newMisses,
            battleLog: [...gameState.battleLog, `Match ended: ${username} timed out 3 times.`]
          });
          return;
        }

        // Increment miss count but continue draft
        updateFirestoreState({ [missField]: newMisses });

        const currentPlayer = gameState[localRole];
        const availableRoles = roles.filter(r => !currentPlayer.team[r]);

        if (availableRoles.length > 0) {
          const randomRole = availableRoles[Math.floor(Math.random() * availableRoles.length)];
          assignRole(randomRole);
        } else {
          skipTurn();
        }
      }
    }, 100);

    return () => clearInterval(interval);
  }, [gameState.status, gameState.turnStartTime, gameState.turn, localRole, roles]);

  // Record Game Result
  useEffect(() => {
    // We only want to process this once per room when it finishes
    if (gameState.status === 'finished' && roomId && roomId !== processedGameId && authUser) {

      const isWinner = gameState.winner === username;
      const isDraw = gameState.winner === "Draw";

      let statToIncrement = "losses";
      if (isDraw) statToIncrement = "draws";
      else if (isWinner) statToIncrement = "wins";

      console.log(`[Game Finished] Processing Stats for ${username}: Result = ${statToIncrement}`);

      const userRef = doc(db, 'users', authUser.uid);
      updateDoc(userRef, {
        [statToIncrement]: increment(1)
      }).then(() => {
        setProcessedGameId(roomId); // Only mark as processed if DB update succeeds
        // Clear persistence since game is done
        localStorage.removeItem('multi_battle_roomid');
        localStorage.removeItem('multi_battle_role');
      }).catch(err => {
        console.error("Failed to update user stats:", err);
      });
    }
  }, [gameState.status, roomId, processedGameId, authUser, username, gameState.winner]);

  if (!isUsernameSet) {
    return (
      <div className="min-h-screen bg-[#050507] text-[#e0e0e6] p-4 flex items-center justify-center font-sans selection:bg-purple-500/30">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full mx-auto bg-gray-900/40 backdrop-blur-xl p-8 rounded-3xl border border-white/10 shadow-2xl text-center relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-rose-500"></div>
          <div className="inline-block p-4 rounded-full bg-white/5 border border-white/10 mb-6">
            <UserPlus size={40} className="text-purple-400" />
          </div>
          <h2 className="text-3xl font-black mb-2 italic tracking-tighter text-white">IDENTIFY YOURSELF</h2>
          <p className="text-gray-400 text-sm mb-8 font-medium">Enter a codename to display in multiplayer matches.</p>

          <form onSubmit={handleSaveUsername} className="space-y-4">
            <input
              autoFocus
              type="text"
              placeholder="ENTER USERNAME..."
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="w-full bg-black/40 border border-white/10 text-center text-xl font-black tracking-widest uppercase rounded-xl py-4 focus:outline-none focus:border-purple-500/50 transition-colors"
              maxLength={15}
            />
            <button
              type="submit"
              disabled={username.trim().length === 0}
              className="w-full flex items-center justify-center gap-3 py-4 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl font-black text-lg tracking-widest hover:scale-[1.02] transition-transform shadow-xl text-white disabled:opacity-50 disabled:cursor-not-allowed mb-4"
            >
              PLAY AS GUEST
            </button>

            <div className="relative flex items-center py-2">
              <div className="flex-grow border-t border-white/10"></div>
              <span className="flex-shrink-0 mx-4 text-gray-500 text-xs font-bold uppercase tracking-widest">Or</span>
              <div className="flex-grow border-t border-white/10"></div>
            </div>

            <button
              type="button"
              onClick={handleLogin}
              className="w-full flex items-center justify-center gap-3 py-4 bg-white text-gray-900 rounded-2xl font-black text-lg tracking-widest hover:scale-[1.02] transition-transform shadow-xl uppercase mt-4"
            >
              <svg className="w-6 h-6" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              SIGN IN WITH GOOGLE
            </button>
            <p className="text-gray-500 text-[10px] text-center uppercase tracking-widest font-bold mt-2">Sign in to track your stats on the leaderboard!</p>
          </form>
        </motion.div>
      </div>
    );
  }

  const isAppView = gameState.status === "drafting" || gameState.status === "ready";

  return (
    <div className={`${isAppView ? 'h-[100dvh] overflow-hidden' : 'min-h-[100dvh] overflow-x-hidden overflow-y-auto'} relative w-full bg-[#050507] text-[#e0e0e6] p-2 sm:p-4 font-sans selection:bg-purple-500/30 flex flex-col items-center`}>

      {/* Top Right Profile */}
      {!roomId && (
        <div className="absolute top-4 right-4 md:top-6 md:right-6 z-50 flex flex-col items-end">
          <div
            className="relative w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-black/60 border border-white/10 flex items-center justify-center shrink-0 overflow-hidden shadow-[0_0_20px_rgba(0,0,0,0.5)] group cursor-pointer backdrop-blur-md"
            onClick={() => setShowProfileMenu(p => !p)}
            title="User Profile"
          >
            {authUser && authUser.photoURL ? (
              <img src={authUser.photoURL} alt="Avatar" className="w-full h-full object-cover transition-transform group-hover:scale-110 group-hover:blur-[2px]" />
            ) : (
              <UserPlus size={22} className="text-gray-500 group-hover:text-blue-400 transition-colors" />
            )}
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
              <ChevronDown size={20} className={`text-white transition-transform duration-300 ${showProfileMenu ? 'rotate-180' : ''}`} />
            </div>
          </div>

          <AnimatePresence>
            {showProfileMenu && (
              <motion.div
                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                className="absolute top-full right-0 mt-4 w-72 bg-gray-900/95 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col origin-top-right ring-1 ring-white/5"
              >
                <div className="p-6 flex flex-col items-center border-b border-white/5 bg-black/20">
                  <div className="w-20 h-20 rounded-2xl bg-black/60 border border-white/10 flex items-center justify-center overflow-hidden shadow-inner mb-4 relative group">
                    {authUser && authUser.photoURL ? (
                      <img src={authUser.photoURL} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <UserPlus size={32} className="text-gray-500" />
                    )}
                    {!authUser && <div className="absolute inset-0 bg-black/40 flex items-center justify-center"><span className="text-[9px] font-black uppercase tracking-widest text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">Guest</span></div>}
                  </div>

                  <span className="text-xl font-black text-white tracking-widest uppercase truncate w-full text-center leading-none">{username}</span>
                  <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mt-1.5">Codename</span>

                  {/* Stats List */}
                  <div className="flex items-center gap-4 mt-5 select-none w-full justify-center">
                    <div className="flex flex-col items-center gap-1" title="Wins">
                      <span className="text-emerald-400 font-black text-xl leading-none drop-shadow-sm">{userStats?.wins || 0}</span>
                      <span className="text-[9px] text-emerald-500/70 font-bold uppercase tracking-widest">Wins</span>
                    </div>
                    <div className="w-px h-6 bg-white/10 shrink-0"></div>
                    <div className="flex flex-col items-center gap-1" title="Losses">
                      <span className="text-rose-400 font-black text-xl leading-none drop-shadow-sm">{userStats?.losses || 0}</span>
                      <span className="text-[9px] text-rose-500/70 font-bold uppercase tracking-widest">Losses</span>
                    </div>
                    <div className="w-px h-6 bg-white/10 shrink-0"></div>
                    <div className="flex flex-col items-center gap-1" title="Draws">
                      <span className="text-gray-400 font-black text-xl leading-none drop-shadow-sm">{userStats?.draws || 0}</span>
                      <span className="text-[9px] text-gray-500/70 font-bold uppercase tracking-widest">Draws</span>
                    </div>
                  </div>
                </div>

                <div className="p-2 flex flex-col gap-1">
                  {/* Google Sign In Call to Action for Guests */}
                  {authUser?.isAnonymous && (
                    <button onClick={() => { handleLogin(); setShowProfileMenu(false); }} className="flex items-center flex-wrap gap-x-3 gap-y-1 px-4 py-3 bg-white/5 hover:bg-white/10 rounded-2xl transition-colors text-left text-sm font-bold text-white w-full group mb-1 border border-white/5">
                      <img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" className="w-4 h-4 bg-white/10 p-1 rounded-full group-hover:bg-white/20 transition-colors" alt="G" />
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[11px] leading-none uppercase tracking-widest font-black">Login with Google</span>
                        <span className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">Keep your progress & rank</span>
                      </div>
                    </button>
                  )}

                  <button onClick={() => { handleLogout(); setShowProfileMenu(false); }} className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 rounded-2xl transition-colors text-left text-sm font-bold text-gray-400 hover:text-red-400 w-full group">
                    <LogOut size={18} className="text-gray-500 group-hover:text-red-400 transition-colors" /> Sign Out
                  </button>

                  <div className="h-px w-full bg-white/5 my-1"></div>

                  <button onClick={() => { setShowProfileMenu(false); alert("Multi Anime Battle v1.0.0\nBuilt by Yash."); }} className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 rounded-2xl transition-colors text-left text-sm font-bold text-gray-400 hover:text-white w-full group">
                    <Info size={18} className="text-gray-500 group-hover:text-blue-400 transition-colors" /> About
                  </button>
                  <button onClick={() => { setShowProfileMenu(false); alert("No personal information is sold or shared. Only match statistics are tracked. Your email is securely handled via Google Firebase."); }} className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 rounded-2xl transition-colors text-left text-sm font-bold text-gray-400 hover:text-white w-full group">
                    <ShieldAlert size={18} className="text-gray-500 group-hover:text-emerald-400 transition-colors" /> Privacy Policy
                  </button>
                </div>

                <div className="px-6 py-4 bg-black/40 border-t border-white/5 text-center mt-auto">
                  <span className="text-[10px] text-gray-600 font-bold tracking-widest uppercase">Version 1.0.0</span>
                </div>

              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      <div className={`w-full max-w-5xl flex-1 flex flex-col min-h-0 ${isAppView ? 'overflow-hidden' : ''}`}>
        {/* Hide giant header if we are drafting to save space */}
        {!isAppView && (
          <header className="text-center mb-10 relative shrink-0 pt-8">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-purple-600/10 blur-[120px] -z-10 animate-pulse"></div>
            <h1 className="text-4xl md:text-6xl font-black italic tracking-tighter text-white mb-3 drop-shadow-2xl">
              MULTI <span className="bg-gradient-to-r from-blue-400 via-purple-500 to-rose-500 bg-clip-text text-transparent">{gameState.config.mode.toUpperCase()}</span> BATTLE
            </h1>
            <div className="flex items-center justify-center gap-4">
              <span className="h-px w-16 bg-gradient-to-r from-transparent to-gray-600"></span>
              <p className="text-gray-400 tracking-[0.3em] uppercase text-xs md:text-sm font-bold leading-none">
                {gameState.config.series || "Legendary Arena"}
              </p>
              <span className="h-px w-16 bg-gradient-to-l from-transparent to-gray-600"></span>
            </div>
            {roomId && (
              <div className="mt-5 inline-flex items-center gap-3 bg-black/50 border border-white/10 rounded-full px-5 py-2 backdrop-blur-md shadow-xl">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Room Code</span>
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                <span className="text-sm font-black text-white tracking-[0.2em]">{roomId}</span>
              </div>
            )}
          </header>
        )}

        <AnimatePresence mode="wait">
          {!roomId && (
            <motion.div
              key="lobby"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              className="w-full flex-1 flex flex-col gap-6"
            >
              <div className="w-full max-w-lg mx-auto space-y-6">
                {/* Active Match Reconnection Alert */}
                <AnimatePresence>
                  {matchToReconnect && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9, y: -20 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9, y: -20 }}
                      className="bg-gradient-to-br from-purple-900/40 to-indigo-900/40 backdrop-blur-2xl border-2 border-purple-500/50 rounded-3xl p-8 shadow-[0_0_50px_rgba(168,85,247,0.2)] relative overflow-hidden group"
                    >
                      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-400 via-pink-500 to-purple-400 animate-pulse"></div>

                      <div className="flex flex-col items-center text-center">
                        <div className="w-16 h-16 bg-purple-500/20 rounded-full flex items-center justify-center border border-purple-500/30 mb-5 group-hover:scale-110 transition-transform duration-500">
                          <Activity size={32} className="text-purple-400 animate-pulse" />
                        </div>

                        <h3 className="text-2xl font-black text-white italic tracking-tighter uppercase mb-2">Battle in Progress!</h3>
                        <p className="text-gray-300 text-sm font-bold uppercase tracking-widest mb-8 px-4 leading-relaxed">
                          We found an unfinished match. You can jump back in or surrender now.
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
                          <button
                            onClick={handleContinueMatch}
                            className="py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase tracking-[0.2em] rounded-2xl transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:scale-[1.03] active:scale-95 text-xs flex items-center justify-center gap-2"
                          >
                            <Zap size={16} className="fill-current" /> Continue Battle
                          </button>
                          <button
                            onClick={handleSurrender}
                            disabled={loadingAction === 'surrendering'}
                            className="py-4 bg-gray-800/80 hover:bg-rose-900/40 text-gray-400 hover:text-rose-400 border border-white/5 hover:border-rose-500/30 font-black uppercase tracking-[0.2em] rounded-2xl transition-all active:scale-95 text-xs flex items-center justify-center gap-2"
                          >
                            {loadingAction === 'surrendering' ? (
                              <div className="relative w-4 h-4">
                                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="absolute inset-0 border-2 border-white/20 border-t-rose-400 rounded-full" />
                              </div>
                            ) : <XCircle size={16} />}
                            {loadingAction === 'surrendering' ? 'ENDING...' : 'Surrender'}
                          </button>
                        </div>

                        <div className="mt-6 flex items-center gap-2 px-3 py-1 bg-black/40 rounded-full border border-white/5">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                          <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest leading-none pt-0.5">Match Ref: {matchToReconnect.id}</span>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                {/* User Profile Section */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-[#0a0a0c]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-2xl relative overflow-hidden"
                >
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-purple-500 opacity-50"></div>

                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
                    {/* Name and Stats */}
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[10px] sm:text-xs font-bold text-gray-500 uppercase tracking-widest leading-none">Codename</span>
                        {!authUser && <span className="text-[9px] bg-amber-500/10 border border-amber-500/20 text-amber-500 px-1.5 py-0.5 rounded font-black tracking-widest leading-none">GUEST</span>}
                      </div>

                      {isEditingUsername ? (
                        <form onSubmit={handleUpdateUsername} className="flex items-center gap-2 mt-1">
                          <input
                            autoFocus
                            type="text"
                            value={tempUsername}
                            onChange={e => setTempUsername(e.target.value)}
                            className="bg-black/60 border border-white/20 text-white text-lg font-black tracking-widest uppercase rounded-lg px-2 py-1 w-full max-w-[180px] focus:outline-none focus:border-purple-500/50 shadow-inner"
                            maxLength={15}
                          />
                          <button type="submit" disabled={tempUsername.trim().length === 0} className="p-1.5 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 rounded-lg transition-colors disabled:opacity-50 shrink-0 border border-emerald-500/30">
                            <Check size={16} />
                          </button>
                        </form>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-2xl sm:text-3xl font-black text-white tracking-widest uppercase truncate max-w-[180px] sm:max-w-[220px] drop-shadow-sm leading-none pt-1">{username}</span>
                          <button onClick={() => { setTempUsername(username); setIsEditingUsername(true); }} className="p-1.5 bg-black/40 text-gray-400 hover:text-white hover:bg-white/10 border border-white/10 rounded-lg transition-all shrink-0 mt-1 shadow-sm" title="Edit Codename">
                            <Edit2 size={14} />
                          </button>
                        </div>
                      )}

                      {/* Condensed Stats for Logged In Users - MOVED TO PROFILE MENU */}
                    </div>

                    {/* Right Side: Rankings & Friends */}
                    <div className="flex items-center justify-end w-full sm:w-auto mt-2 sm:mt-0 relative z-10 gap-3">
                      {localUserId && (
                        <button
                          onClick={() => setShowFriendsModal(true)}
                          className="relative flex items-center justify-center gap-2 px-4 py-3 sm:py-4 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/30 rounded-2xl transition-all font-black text-sm uppercase tracking-widest hover:-translate-y-0.5 shadow-sm"
                        >
                          <Users size={18} />
                          <span className="hidden sm:inline">Friends</span>
                          {pendingRequestsCount > 0 && (
                            <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-rose-500 text-white rounded-full flex items-center justify-center text-[10px] font-black">{pendingRequestsCount}</span>
                          )}
                        </button>
                      )}

                      <button
                        onClick={() => setShowLeaderboard(true)}
                        className="flex items-center justify-center gap-2 px-4 py-3 sm:py-4 bg-gradient-to-br from-yellow-500/10 to-amber-500/5 hover:from-yellow-500/20 hover:to-amber-500/10 text-yellow-500 border border-yellow-500/30 rounded-2xl transition-all font-black text-sm uppercase tracking-widest hover:-translate-y-0.5 shadow-sm"
                      >
                        <Trophy size={18} />
                        <span className="hidden sm:inline">Rankings</span>
                      </button>
                    </div>
                  </div>
                </motion.div>

                {/* Multiplayer Arena Section */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.1 }}
                  className="bg-[#0a0a0c]/80 backdrop-blur-xl rounded-3xl border border-white/10 shadow-2xl relative"
                >
                  <div className="p-8">
                    <h2 className="text-3xl font-black mb-8 italic tracking-tighter text-center">MULTIPLAYER</h2>

                    <div className="grid grid-cols-2 gap-4 auto-rows-fr">
                      <button
                        onClick={async () => { setLoadingAction('hosting-public'); try { await createRoom(true); } finally { setLoadingAction(null); } }}
                        disabled={loadingAction !== null || matchToReconnect !== null}
                        className="group relative flex flex-col items-center justify-center gap-3 p-6 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl font-black tracking-widest hover:bg-emerald-500/20 transition-all shadow-lg text-emerald-400 overflow-hidden disabled:opacity-30 disabled:grayscale disabled:cursor-not-allowed h-full"
                      >
                        <div className="absolute inset-0 bg-gradient-to-br from-emerald-400/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        {loadingAction === 'hosting-public' ? (
                          <div className="relative w-7 h-7">
                            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="absolute inset-0 border-2 border-emerald-500/20 border-t-emerald-400 rounded-full" />
                            <motion.div animate={{ opacity: [0.2, 0.5, 0.2] }} transition={{ duration: 1.5, repeat: Infinity }} className="absolute inset-0 bg-emerald-400/20 rounded-full blur-md" />
                          </div>
                        ) : <Users size={28} className="group-hover:scale-110 transition-transform duration-300" />}
                        <span className="text-sm text-center uppercase leading-tight">
                          {loadingAction === 'hosting-public' ? 'CREATING...' : 'PUBLIC\nMATCH'}
                        </span>
                      </button>

                      <button
                        onClick={async () => { setLoadingAction('hosting-private'); try { await createRoom(false); } finally { setLoadingAction(null); } }}
                        disabled={loadingAction !== null || matchToReconnect !== null}
                        className="group relative flex flex-col items-center justify-center gap-3 p-6 bg-black/40 border border-white/10 rounded-2xl font-black tracking-widest hover:bg-white/5 hover:border-white/20 transition-all shadow-lg text-gray-300 overflow-hidden disabled:opacity-30 disabled:grayscale disabled:cursor-not-allowed h-full"
                      >
                        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        {loadingAction === 'hosting-private' ? (
                          <div className="relative w-7 h-7">
                            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="absolute inset-0 border-2 border-white/20 border-t-purple-400 rounded-full" />
                            <motion.div animate={{ opacity: [0.2, 0.5, 0.2] }} transition={{ duration: 1.5, repeat: Infinity }} className="absolute inset-0 bg-purple-400/20 rounded-full blur-md" />
                          </div>
                        ) : <Shield size={28} className="group-hover:scale-110 transition-transform duration-300 text-gray-400" />}
                        <span className="text-sm text-center uppercase leading-tight">
                          {loadingAction === 'hosting-private' ? 'CREATING...' : 'PRIVATE\nMATCH'}
                        </span>
                      </button>
                    </div>

                    <div className="relative flex items-center py-6 mt-2">
                      <div className="flex-grow border-t border-white/5"></div>
                      <span className="flex-shrink-0 mx-4 text-gray-600 text-[10px] font-bold uppercase tracking-widest">Or Join Private</span>
                      <div className="flex-grow border-t border-white/5"></div>
                    </div>

                    {matchToReconnect && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mb-4 p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl text-center"
                      >
                        <p className="text-[10px] font-black text-purple-400 uppercase tracking-widest leading-relaxed">
                          Resolve your current match to start a new battle.
                        </p>
                      </motion.div>
                    )}

                    <form onSubmit={handleJoinSubmit} className="space-y-4">
                      <div className="flex flex-col sm:flex-row gap-3">
                        <input
                          type="text"
                          placeholder="ENTER ROOM CODE..."
                          value={joinCode}
                          onChange={e => setJoinCode(e.target.value)}
                          className="w-full bg-black/40 border border-white/10 text-center sm:text-left text-xl font-black tracking-[0.3em] uppercase rounded-xl px-5 py-4 focus:outline-none focus:border-purple-500/50 transition-colors shadow-inner"
                          maxLength={5}
                        />
                        <button
                          type="submit"
                          disabled={joinCode.length < 5 || loadingAction !== null || matchToReconnect !== null}
                          className="px-6 py-4 bg-purple-600 hover:bg-purple-500 disabled:opacity-30 disabled:grayscale disabled:cursor-not-allowed text-white font-black rounded-2xl transition-all shadow-[0_0_20px_rgba(168,85,247,0.3)] flex items-center gap-2 uppercase tracking-widest text-xs"
                        >
                          {loadingAction === 'joining' ? (
                            <div className="relative w-4 h-4">
                              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="absolute inset-0 border-2 border-white/20 border-t-white rounded-full" />
                            </div>
                          ) : <Handshake size={20} />}
                          {loadingAction === 'joining' ? 'JOINING...' : 'JOIN'}
                        </button>
                      </div>
                    </form>
                  </div>
                </motion.div>
              </div>

              {!roomId && openRooms.length > 0 && (
                <div className="max-w-lg mx-auto w-full mt-0 bg-[#0a0a0c]/80 backdrop-blur-xl p-6 rounded-2xl border border-white/10 shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500/50"></div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                      <Activity size={16} className="text-emerald-400" /> LIVE OPEN MATCHES
                    </h3>
                    <span className="bg-emerald-500/20 text-emerald-400 text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest">{openRooms.length} Available</span>
                  </div>
                  <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-2">
                    {openRooms.map((room) => {
                      const isJoiningThisRoom = loadingAction === `joining-${room.id}`;
                      return (
                        <button
                          key={room.id}
                          onClick={() => joinRoomWithCode(room.id, `joining-${room.id}`)}
                          disabled={loadingAction !== null || matchToReconnect !== null}
                          className="w-full flex items-center justify-between p-3 bg-black/40 hover:bg-white/5 border border-white/5 hover:border-emerald-500/30 rounded-xl transition-all group text-left disabled:opacity-30 disabled:grayscale disabled:cursor-not-allowed"
                        >
                          <div className="flex flex-col items-start gap-1">
                            <div className="flex items-center gap-2">
                              <Crown size={12} className="text-emerald-500" />
                              <span className="text-gray-200 font-bold uppercase text-xs tracking-widest">{room.host}</span>
                            </div>
                            <div className="text-[9px] text-gray-500 font-bold tracking-widest uppercase flex items-center gap-2">
                              <span className="text-purple-400/80">{room.gameState?.config?.mode || "Unknown"}</span>
                              {room.gameState?.config?.series && (
                                <>
                                  <span className="text-white/20">•</span>
                                  <span className="text-blue-400/80 max-w-[100px] truncate">{room.gameState.config.series}</span>
                                </>
                              )}
                            </div>
                          </div>
                          <span className="flex items-center gap-2 text-emerald-400 font-black text-[10px] tracking-widest uppercase bg-emerald-500/10 px-3 py-1.5 rounded-lg group-hover:bg-emerald-500/20 group-hover:scale-105 transition-all outline outline-1 outline-emerald-500/20">
                            {isJoiningThisRoom ? (
                              <div className="relative w-3 h-3 mr-1">
                                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="absolute inset-0 border-2 border-emerald-500/20 border-t-emerald-400 rounded-full" />
                              </div>
                            ) : null}
                            {isJoiningThisRoom ? 'JOINING' : 'JOIN'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {roomId && gameState.status === "setup" && (
            <motion.div
              key="setup"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.3 }}
              className="w-full flex-1 flex flex-col"
            >
              {localRole === "p1" ? (
                <SetupScreen onStart={startDraft} />
              ) : (
                <div className="flex flex-col items-center justify-center py-20">
                  <div className="relative w-24 h-24 mb-10">
                    <motion.div
                      animate={{
                        rotate: 360,
                        borderRadius: ["25%", "50%", "25%"],
                        scale: [1, 1.2, 1]
                      }}
                      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                      className="absolute inset-0 border-2 border-purple-500/30 shadow-[0_0_20px_rgba(168,85,247,0.2)]"
                    />
                    <motion.div
                      animate={{
                        rotate: -360,
                        borderRadius: ["50%", "25%", "50%"],
                        scale: [1.2, 1, 1.2]
                      }}
                      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                      className="absolute inset-4 border border-blue-500/30 shadow-[0_0_20px_rgba(59,130,246,0.2)]"
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <motion.div
                        animate={{ opacity: [0.4, 1, 0.4] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      >
                        <ShieldAlert size={32} className="text-purple-400 opacity-50" />
                      </motion.div>
                    </div>
                  </div>
                  <h2 className="text-xl font-black text-white italic tracking-widest uppercase mb-2">Syncing with Host</h2>
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.3em] animate-pulse">Establishing encrypted link...</p>
                </div>
              )}
            </motion.div>
          )}
          {roomId && gameState.status === "waiting_for_player" && (
            <motion.div
              key="waiting"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.3 }}
              className="w-full flex-1 flex flex-col items-center justify-center -mt-20"
            >
              <div className="text-center p-12 bg-gray-900/40 backdrop-blur-xl border border-white/10 rounded-3xl max-w-xl mx-auto shadow-2xl w-full">
                <div className="inline-block animate-pulse rounded-full p-4 bg-purple-600/20 mb-6 border border-purple-500/30">
                  <Users size={48} className="text-purple-400" />
                </div>
                <h2 className="text-2xl font-black text-gray-200 tracking-widest uppercase mb-4">
                  Match Configured
                </h2>
                <p className="text-gray-400 mb-8 max-w-md mx-auto leading-relaxed">
                  Waiting for an opponent to join. Your game will begin automatically as soon as the second player connects.
                </p>
                <div className="inline-block bg-black/50 border border-white/10 rounded-2xl p-6">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Share Room Code</p>
                  <p className="text-4xl font-black text-white tracking-[0.3em] font-mono">{roomId}</p>
                </div>
              </div>
            </motion.div>
          )}
          {/* ZERO-SCROLL NATIVE DRAFT APP UI */}
          {(gameState.status === "drafting" || gameState.status === "ready") && (
            <motion.div
              key="game"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="w-full flex-1 flex flex-col lg:flex-row justify-between gap-2 sm:gap-4 lg:gap-8 overflow-hidden py-1 min-h-0 w-full max-w-7xl mx-auto"
            >

              {/* OPPONENT TEAM (TOP or LEFT) */}
              <div className="shrink-0 w-full lg:w-[280px] xl:w-[320px] animate-fade-in-down lg:order-1 flex flex-col justify-center">
                <TeamDisplay
                  player={localRole === 'p1' ? gameState.p2 : gameState.p1}
                  isLeft={localRole === 'p1' ? false : true}
                  roles={roles}
                  isLocal={false}
                  showAddFriend={!!opponentId}
                  onAddFriend={handleSendFriendRequest}
                  misses={localRole === 'p1' ? (gameState.p2Misses || 0) : (gameState.p1Misses || 0)}
                />
              </div>

              {/* ACTION ARENA (CENTER) */}
              <div className="flex-1 flex flex-col items-center justify-center w-full overflow-hidden relative lg:order-2">

                {/* Emoji Picker */}
                <div className="absolute top-2 right-2 sm:right-4 z-50 flex flex-col items-end gap-2">
                  <AnimatePresence>
                    {showEmojiPicker && (
                      <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} className="flex flex-col gap-2 bg-black/60 backdrop-blur-md p-2 rounded-2xl border border-white/10 shadow-2xl">
                        {EMOJIS.map(e => <button key={e} onClick={() => sendEmoji(e)} className="text-2xl hover:scale-125 transition-transform">{e}</button>)}
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <button onClick={() => setShowEmojiPicker(!showEmojiPicker)} className="bg-white/10 hover:bg-white/20 p-3 rounded-full backdrop-blur-md border border-white/10 transition-colors shadow-lg text-xl flex items-center justify-center relative">
                    😃
                  </button>

                  {/* Move Surrender button to top right for better access */}
                  <button
                    onClick={handleInGameSurrender}
                    className="p-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 rounded-lg border border-rose-500/30 transition-all flex items-center justify-center gap-2 font-black uppercase tracking-widest text-[10px]"
                    title="Surrender Match"
                  >
                    <XCircle size={14} /> Surrender
                  </button>
                </div>

                <div className="hidden">
                  {gameState.nextDraws?.map((char, index) => (
                    <img key={index} src={char.img} alt="preload" />
                  ))}
                </div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-gradient-to-b from-transparent via-purple-900/10 to-transparent -z-10 pointer-events-none"></div>

                <div className="text-center mb-2 shrink-0">
                  <span className="text-[9px] font-black text-white/40 uppercase tracking-[0.3em] bg-white/5 px-3 py-1 rounded-full border border-white/5 shadow-inner">NOW DRAFTING</span>
                  <h3 className={`text-xl sm:text-2xl font-black mt-2 transition-colors duration-500 ${gameState.turn === localRole ? 'text-purple-400 drop-shadow-[0_0_10px_rgba(168,85,247,0.5)]' : 'text-gray-500'}`}>
                    {gameState.turn === localRole ? "YOUR TURN" : `${gameState[gameState.turn].name}'S TURN`}
                  </h3>

                  <div className="w-full max-w-[200px] h-1.5 bg-black/50 rounded-full mx-auto mt-3 overflow-hidden border border-white/10">
                    <div
                      className={`h-full transition-all duration-200 ease-linear ${timeLeft <= 5 ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]' : timeLeft <= 10 ? 'bg-orange-500' : 'bg-purple-500'}`}
                      style={{ width: `${(timeLeft / 30) * 100}%` }}
                    ></div>
                  </div>
                  <div className={`text-[10px] font-black mt-1 tracking-widest ${timeLeft <= 5 ? 'text-red-400 animate-pulse' : 'text-gray-500'}`}>
                    {timeLeft <= 5 && <ShieldAlert size={10} className="inline mr-1 mb-0.5" />}
                    {timeLeft}s REMAINING {(localRole === gameState.turn) && timeLeft <= 10 && <span className="text-red-500 ml-1">(!) ALERT</span>}
                  </div>
                </div>

                <AnimatePresence mode="wait">
                  {gameState.currentDraw && (
                    <motion.div
                      key={gameState.currentDraw.name}
                      initial={{ opacity: 0, scale: 0.8, y: 30 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 1.1, y: -20, filter: "blur(10px)" }}
                      className="flex flex-col h-full w-full max-w-sm px-2 sm:px-0 py-2"
                    >
                      <div className="relative group flex-1 bg-[#0a0a0c] p-2 sm:p-3 rounded-2xl border border-white/10 shadow-2xl flex flex-col overflow-hidden max-h-full min-h-0">
                        {/* Image container limits height and ensures strict scaling */}
                        <div className="relative flex-1 items-center justify-center rounded-xl bg-black border border-white/5 overflow-hidden shadow-inner min-h-0">
                          <img
                            src={gameState.currentDraw.img}
                            alt={gameState.currentDraw.name}
                            className="absolute inset-0 w-full h-full object-cover object-top opacity-90 group-hover:opacity-100 transition-opacity duration-500"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0c] via-transparent to-black/20 pointer-events-none"></div>
                          <div className="absolute bottom-2 left-0 right-0 text-center px-2 z-10">
                            <h2 className="text-lg sm:text-xl font-black text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] leading-none">{gameState.currentDraw.name}</h2>
                            <p className="text-blue-400 text-[8px] sm:text-[10px] font-bold uppercase tracking-widest drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] mt-1">
                              {gameState.currentDraw.series || (gameState.config.mode === "Pokemon" ? gameState.currentDraw.region : "")}
                            </p>
                          </div>
                        </div>

                        {/* Action Grid (Always pinned bottom inside the card) */}
                        <div className="mt-2 sm:mt-3 shrink-0">
                          <div className="grid grid-cols-4 sm:grid-cols-4 gap-1 sm:gap-1.5 mb-2">
                            {roles.filter(r => !gameState[gameState.turn].team[r]).map(role => (
                              <button
                                key={role}
                                onClick={() => assignRole(role)}
                                disabled={gameState.turn !== localRole}
                                className="flex flex-col items-center justify-center gap-1 py-1.5 sm:py-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-purple-500/50 rounded-lg text-white transition-all active:scale-95 disabled:opacity-30 disabled:hover:border-white/10 disabled:cursor-not-allowed group/btn"
                              >
                                <span className="scale-[0.6] sm:scale-75 text-gray-400 group-hover/btn:text-purple-400 transition-colors drop-shadow-md">{roleIconsMapping[role]}</span>
                                <span className="text-[7px] font-bold uppercase tracking-tighter truncate w-full text-center px-1 overflow-hidden opacity-80">{role}</span>
                              </button>
                            ))}
                          </div>

                          <button
                            onClick={skipTurn}
                            disabled={gameState[gameState.turn].skips <= 0 || gameState.turn !== localRole}
                            className={`w-full flex items-center justify-center gap-1.5 py-1.5 sm:py-2 rounded-lg text-[9px] font-black transition-all uppercase tracking-[0.2em] shadow-lg border
                            ${gameState[gameState.turn].skips > 0 && gameState.turn === localRole
                                ? 'bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20 active:scale-95'
                                : 'bg-black/40 border-white/5 text-gray-600 disabled:cursor-not-allowed'}`}
                          >
                            <Trash2 size={12} /> SKIP
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* LOCAL PLAYER TEAM (BOTTOM or RIGHT) */}
              <div className="shrink-0 w-full lg:w-[280px] xl:w-[320px] animate-fade-in-up lg:order-3 flex flex-col justify-center">
                <TeamDisplay
                  player={localRole === 'p1' ? gameState.p1 : gameState.p2}
                  isLeft={localRole === 'p1' ? true : false}
                  roles={roles}
                  isLocal={true}
                  misses={localRole === 'p1' ? (gameState.p1Misses || 0) : (gameState.p2Misses || 0)}
                />
              </div>
            </motion.div>
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
              {gameState.battleLog.some((l: string) => l.includes("ended by surrender")) && (
                <div className="text-rose-500 font-black tracking-[0.3em] uppercase text-sm mb-4 animate-pulse">
                  Opponent Surrendered
                </div>
              )}
              <div className="flex justify-center items-center gap-8 mb-8 text-xl font-black italic tracking-widest opacity-80 relative">
                <span className="text-blue-400 flex items-center gap-2">
                  {gameState.p1.name}: {gameState.p1Score || 0} pts
                  {localRole === "p2" && localUserId && (
                    <button
                      onClick={async () => {
                        try {
                          const usersSnap = await getDocs(query(collection(db, 'users'), where('displayName', '==', gameState.p1.name), limit(1)));
                          if (!usersSnap.empty) {
                            const targetId = usersSnap.docs[0].id;
                            await setDoc(doc(collection(db, 'friendRequests')), {
                              senderId: localUserId,
                              senderName: username,
                              receiverId: targetId,
                              status: 'pending',
                              timestamp: serverTimestamp()
                            });
                            alert("Friend request sent!");
                          }
                        } catch (e) {
                          console.error("Failed to send request", e);
                        }
                      }}
                      title="Add Friend"
                      className="p-2 ml-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg transition-colors border border-emerald-500/30"
                    >
                      <UserPlus size={16} />
                    </button>
                  )}
                </span>
                <span className="text-gray-600">VS</span>
                <span className="text-red-400 flex items-center gap-2">
                  {localRole === "p1" && localUserId && (
                    <button
                      onClick={async () => {
                        try {
                          const usersSnap = await getDocs(query(collection(db, 'users'), where('displayName', '==', gameState.p2.name), limit(1)));
                          if (!usersSnap.empty) {
                            const targetId = usersSnap.docs[0].id;
                            await setDoc(doc(collection(db, 'friendRequests')), {
                              senderId: localUserId,
                              senderName: username,
                              receiverId: targetId,
                              status: 'pending',
                              timestamp: serverTimestamp()
                            });
                            alert("Friend request sent!");
                          }
                        } catch (e) {
                          console.error("Failed to send request", e);
                        }
                      }}
                      title="Add Friend"
                      className="p-2 mr-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg transition-colors border border-emerald-500/30"
                    >
                      <UserPlus size={16} />
                    </button>
                  )}
                  {gameState.p2.name}: {gameState.p2Score || 0} pts
                </span>
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

              <div className="flex flex-col sm:flex-row justify-center gap-4">
                <button
                  onClick={() => {
                    setRoomId(null);
                    setLocalRole(null);
                    setGameState({
                      status: "setup",
                      config: { mode: "Anime", series: null },
                      p1: INITIAL_PLAYER("Player 1"),
                      p2: INITIAL_PLAYER("Player 2"),
                      turn: "p1",
                      nextDraws: [],
                      currentDraw: null,
                      turnStartTime: Date.now(),
                      winner: null,
                      p1Score: 0,
                      p2Score: 0,
                      p1Misses: 0,
                      p2Misses: 0,
                      battleLog: [],
                    });
                  }}
                  className="px-8 py-4 bg-gray-800 hover:bg-gray-700 border border-white/10 rounded-full font-black text-gray-300 hover:text-white transition-all shadow-xl uppercase tracking-widest text-sm flex-1 max-w-[200px]"
                >
                  Exit Match
                </button>

                <button
                  onClick={() => {
                    if (localRole === "p1") {
                      updateFirestoreState({
                        status: "setup",
                        p1: INITIAL_PLAYER("Player 1"),
                        p2: INITIAL_PLAYER("Player 2"),
                        currentDraw: null,
                        winner: null,
                        battleLog: []
                      })
                    }
                  }}
                  disabled={localRole !== "p1"}
                  className="px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full font-black text-white hover:scale-105 transition-transform shadow-xl uppercase tracking-widest text-sm disabled:opacity-50 disabled:cursor-not-allowed flex-1 max-w-[300px]"
                >
                  {localRole === "p1" ? "Initiate New Conflict" : "Waiting for Host..."}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {/* Giant Emoji Overlay */}
        {activeEmoji && (
          <motion.div
            key={activeEmoji.id}
            initial={{ opacity: 0, scale: 0, y: 50 }}
            animate={{ opacity: 1, scale: [1, 1.2, 1], y: 0 }}
            exit={{ opacity: 0, scale: 0.5 }}
            transition={{ duration: 1.5, type: "spring" }}
            className="pointer-events-none fixed inset-0 flex items-center justify-center z-[100]"
          >
            <span className="text-[60px] sm:text-[100px] drop-shadow-[0_0_20px_rgba(255,255,255,0.4)]">{activeEmoji.emoji}</span>
          </motion.div>
        )}

        {showLeaderboard && (
          <Leaderboard
            currentUserId={localUserId}
            currentUsername={username}
            onClose={() => setShowLeaderboard(false)}
          />
        )}
        {showFriendsModal && (
          <FriendsModal
            currentUserId={localUserId}
            currentUsername={username}
            onClose={() => setShowFriendsModal(false)}
          />
        )}
      </AnimatePresence>

      {/* Match Chat Interface (Fixed Bottom Left) */}
      <AnimatePresence>
        {roomId && (gameState.status === "drafting" || gameState.status === "ready") && (
          <div className="fixed bottom-4 left-4 sm:left-6 z-[60] flex flex-col items-start shadow-2xl">
            <AnimatePresence>
              {isChatOpen && (
                <motion.div initial={{ opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.95 }} className="bg-gray-900/90 backdrop-blur-xl border border-white/10 w-72 h-80 sm:w-80 rounded-2xl mb-3 flex flex-col overflow-hidden shadow-2xl origin-bottom-left">
                  <div className="bg-black/40 p-3 text-xs font-black tracking-widest uppercase text-gray-400 border-b border-white/5 flex justify-between items-center">
                    <span className="flex items-center gap-2"><MessageSquare size={14} className="text-purple-400" /> Match Chat</span>
                    <button onClick={() => setIsChatOpen(false)} className="hover:text-white transition-colors"><ChevronDown size={14} /></button>
                  </div>
                  <div className="flex-1 p-3 overflow-y-auto custom-scrollbar flex flex-col gap-2 relative">
                    {roomChat.length === 0 && <div className="text-center text-gray-500 text-xs mt-4 uppercase tracking-widest font-bold">No messages yet. Say hello!</div>}
                    {roomChat.map((msg, i) => {
                      const isMe = msg.senderId === localUserId;
                      return (
                        <div key={i} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} animate-fade-in-up`}>
                          <span className="text-[9px] text-gray-500 font-bold mb-0.5 px-1 uppercase tracking-wider">{isMe ? 'You' : msg.senderName}</span>
                          <div className={`px-2.5 py-1.5 rounded-lg text-sm max-w-[85%] break-words shadow-sm ${isMe ? 'bg-purple-600 text-white rounded-br-none' : 'bg-gray-800 text-gray-200 border border-white/5 rounded-bl-none'}`}>
                            {msg.text}
                          </div>
                        </div>
                      )
                    })}
                    <div ref={chatEndRef} />
                  </div>
                  <form onSubmit={handleSendMatchChat} className="p-2 bg-black/60 border-t border-white/5 flex gap-2">
                    <input
                      type="text"
                      value={chatMessage}
                      onChange={e => setChatMessage(e.target.value)}
                      placeholder="Type a message..."
                      className="flex-1 bg-gray-800/80 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500/50 placeholder-gray-500 transition-colors"
                    />
                  </form>
                </motion.div>
              )}
            </AnimatePresence>
            {!isChatOpen && (
              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setIsChatOpen(true)} className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-3 rounded-full shadow-2xl flex items-center justify-center border border-white/10 relative">
                <MessageSquare size={20} />
                {roomChat.length > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center border border-gray-900">{roomChat.length}</span>}
              </motion.button>
            )}
          </div>
        )}
      </AnimatePresence>

      {/* Global Lobby Chat Overlay (Also show in setup/waiting for player) */}
      {(!roomId || gameState.status === "setup" || gameState.status === "waiting_for_player") && (
        <GlobalChat currentUserId={localUserId} currentUsername={username} />
      )}

      {/* Incoming Challenge Overlay */}
      <AnimatePresence>
        {incomingInvite && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 50 }}
            className="fixed bottom-6 right-6 z-50 bg-gray-900 border border-purple-500/50 rounded-2xl shadow-2xl p-5 w-80 backdrop-blur-xl"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center border border-purple-500/30">
                <Sword size={20} className="text-purple-400" />
              </div>
              <div>
                <h4 className="font-black tracking-widest uppercase text-white leading-none">Match Invite!</h4>
                <p className="text-xs text-purple-300 font-bold mt-1 uppercase"><span className="text-white">{incomingInvite.senderName}</span> challenges you!</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleDeclineInvite} className="flex-1 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 font-black uppercase tracking-widest text-xs transition-colors">
                Decline
              </button>
              <button onClick={handleAcceptInvite} className="flex-1 py-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-400 font-black uppercase tracking-widest text-xs transition-colors">
                Accept
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
