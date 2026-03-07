import React, { useState, useEffect, useRef, useMemo, Suspense, lazy } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Trash2, UserPlus, Trophy,
  Zap, Activity, ChevronDown, Check, Edit2,
  ShieldAlert, MessageSquare, XCircle, ArrowLeft
} from 'lucide-react';
import { db, auth, googleProvider } from './firebase';
import {
  doc, setDoc, onSnapshot, getDoc, updateDoc, deleteDoc, collection,
  query, where, limit, increment, getDocs, serverTimestamp, addDoc, arrayUnion
} from 'firebase/firestore';
import { signInWithPopup, signInWithRedirect, getRedirectResult, signInAnonymously, onAuthStateChanged, signOut, linkWithPopup, linkWithRedirect, User as FirebaseAuthUser } from 'firebase/auth';

import { loadDataset } from './dataStore';
import { Character, GameState, Player, GameMode, PlayerRole, Room } from './types';
import { getRolesForMode, calculateBattle } from './gameLogic';
import { SetupScreen } from './components/SetupScreen';
import { TeamDisplay, roleIconsMapping } from './components/TeamDisplay';
const Leaderboard = lazy(() => import('./components/Leaderboard'));
const GlobalChat = lazy(() => import('./components/GlobalChat'));
const FriendsModal = lazy(() => import('./components/FriendsModal'));
import { useSocial } from './context/SocialContext';
import GamingBackground from './components/GamingBackground';
import AuthOverlay from './components/AuthOverlay';
import TopProfileBar from './components/TopProfileBar';
import AboutModal from './components/AboutModal';
import PrivacyPolicyModal from './components/PrivacyPolicyModal';
import MatchInviteOverlay from './components/MatchInviteOverlay';
import Lobby from './components/Lobby';
import { generateRoomCode, generateBotRooms, getDeterministicRoomImage, BOT_NAMES } from './utils/roomUtils';

const INITIAL_PLAYER = (name: string): Player => ({
  name,
  team: {},
  skips: 2,
});



const App: React.FC = () => {
  const [charactersPool, setCharactersPool] = useState<Record<string, any[]>>({});

  useEffect(() => {
    // Background load initial anime data
    loadDataset('Anime').then(data => {
      setCharactersPool(prev => ({ ...prev, Anime: data }));
    });
  }, []);



  const [localRole, setLocalRole] = useState<PlayerRole>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState<string>('');

  const [username, setUsername] = useState<string>('');
  const [localUserId, setLocalUserId] = useState<string>(localStorage.getItem('multi_battle_userid') || '');
  const [isUsernameSet, setIsUsernameSet] = useState<boolean>(false);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);
  const [isEditingUsername, setIsEditingUsername] = useState<boolean>(false);
  const [tempUsername, setTempUsername] = useState<string>('');
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [showProfileMenu, setShowProfileMenu] = useState<boolean>(false);
  const [visibleMatchesCount, setVisibleMatchesCount] = useState<number>(4);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);

  // Social Data from Context
  const { incomingRequests, friends } = useSocial();
  const friendIds = new Set(friends.map(f => f.friendId));

  // Auth & Leaderboard State
  const [authUser, setAuthUser] = useState<FirebaseAuthUser | null>(null);
  const [showLeaderboard, setShowLeaderboard] = useState<boolean>(false);
  const [showFriendsModal, setShowFriendsModal] = useState<boolean>(false);
  const [showAboutModal, setShowAboutModal] = useState<boolean>(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState<boolean>(false);
  const [incomingInvite, setIncomingInvite] = useState<any>(null);
  const [processedGameId, setProcessedGameId] = useState<string | null>(null);
  const [userStats, setUserStats] = useState<{ wins: number, losses: number, draws: number } | null>(null);
  const [userPhotoURL, setUserPhotoURL] = useState<string | null>(localStorage.getItem('multi_battle_avatar'));
  const [matchToReconnect, setMatchToReconnect] = useState<Room | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollThrottleRef = useRef<number>(0);


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

    return () => {
      unsubInvites();
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
        setLocalUserId(uid);
        localStorage.setItem('multi_battle_userid', uid);
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
            const pfp = data?.photoURL || null;
            if (pfp && pfp !== "") {
              setUserPhotoURL(pfp);
              localStorage.setItem('multi_battle_avatar', pfp);
            } else {
              setUserPhotoURL(null);
              localStorage.removeItem('multi_battle_avatar');
            }

            // Auto-Migration: Populate missing displayNameLowercase for existing users
            if (dbName && !data.displayNameLowercase) {
              console.log("[Migration] User needs migration:", uid, dbName);
              setDoc(userRef, { displayNameLowercase: dbName.toLowerCase() }, { merge: true })
                .then(() => console.log("[Migration] Success for", uid))
                .catch(err => console.error("[Migration] Error for", uid, err));
            }

            // 5. Upgrade Photo URL if NONE exists yet
            if (currentUser.photoURL && !data.photoURL) {
              setDoc(userRef, { photoURL: currentUser.photoURL }, { merge: true }).catch(console.error);
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
                    const activeStates = ["drafting", "ready", "setup", "waiting_for_player"];
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
          setIsAuthLoading(false);
        });
      } else {
        // Automatically attempt anonymous login if no session is found
        try {
          await signInAnonymously(auth);
        } catch (e) {
          console.error("Anonymous auth failed", e);
          setIsAuthLoading(false);
        }
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubSnapshot) unsubSnapshot();
    };
  }, []);

  // Handle Redirect Result (Auth / Link)
  useEffect(() => {
    getRedirectResult(auth)
      .then((result) => {
        if (result) {
          console.log("[Auth] Successfully signed in via redirect:", result.user.displayName);
        }
      })
      .catch((error) => {
        console.error("[Auth] Redirect sign-in error:", error);
        if (error.code !== 'auth/popup-closed-by-user') {
          alert(`Sign-in failed: ${error.message}`);
        }
      });
  }, []);

  // Persist Current Match Info
  useEffect(() => {
    if (roomId && localRole) {
      localStorage.setItem('multi_battle_roomid', roomId);
      localStorage.setItem('multi_battle_role', localRole);
    }
  }, [roomId, localRole]);

  // Reset once-only matchmaking flag whenever we enter a new room
  useEffect(() => {
    matchmakingShownRef.current = false;
  }, [roomId]);

  const handleLogin = async () => {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;

    try {
      if (auth.currentUser && auth.currentUser.isAnonymous) {
        try {
          if (isMobile) {
            await linkWithRedirect(auth.currentUser, googleProvider);
          } else {
            await linkWithPopup(auth.currentUser, googleProvider);
          }
        } catch (linkError: any) {
          if (linkError.code === 'auth/credential-already-in-use') {
            // Account already linked elsewhere, just normal sign-in
            if (isMobile) {
              await signInWithRedirect(auth, googleProvider);
            } else {
              await signInWithPopup(auth, googleProvider);
            }
          } else {
            throw linkError;
          }
        }
      } else {
        if (isMobile) {
          await signInWithRedirect(auth, googleProvider);
        } else {
          await signInWithPopup(auth, googleProvider);
        }
      }
    } catch (error: any) {
      console.error("Login Error Details:", error);
      alert(`Sign in failed. Error: ${error.code || 'Unknown'}`);
    }
  };

  const handleLogout = async () => {
    try {
      if (roomId) {
        try {
          if (localRole === 'p1') {
            await deleteDoc(doc(db, "games", roomId));
          } else if (localRole === 'p2') {
            await updateDoc(doc(db, "games", roomId), { guest: null, guestId: null, guestPhotoURL: null });
          }
        } catch (e) {
          console.error("Failed to cleanup room on logout", e);
        }
      }
      await signOut(auth);
      setRoomId(null);
      setIsUsernameSet(false);
      setUsername("");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !authUser) return;

    setIsUploadingAvatar(true);

    try {
      // 1. Client-side Compression
      const compressedBlob = await new Promise<Blob>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
          const img = new Image();
          img.src = event.target?.result as string;
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 250;
            const MAX_HEIGHT = 250;
            let width = img.width;
            let height = img.height;

            if (width > height) {
              if (width > MAX_WIDTH) {
                height *= MAX_WIDTH / width;
                width = MAX_WIDTH;
              }
            } else {
              if (height > MAX_HEIGHT) {
                width *= MAX_HEIGHT / height;
                height = MAX_HEIGHT;
              }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) return reject('Failed to get canvas context');
            ctx.drawImage(img, 0, 0, width, height);

            canvas.toBlob((blob) => {
              if (blob) resolve(blob);
              else reject('Failed to create blob');
            }, 'image/jpeg', 0.8);
          };
          img.onerror = () => reject('Failed to load image');
        };
        reader.onerror = () => reject('Failed to read file');
      });

      // 2. Upload Compressed Blob to ImgBB
      const formData = new FormData();
      formData.append('image', compressedBlob, 'avatar.jpg');

      const response = await fetch(`https://api.imgbb.com/1/upload?key=87ac08b1fe96f1eec8ec5a764548dd56`, {
        method: 'POST',
        body: formData
      });
      const result = await response.json();

      if (result.success) {
        const imageUrl = result.data.url;
        // Optimistic Update
        setUserPhotoURL(imageUrl);
        localStorage.setItem('multi_battle_avatar', imageUrl);

        const userRef = doc(db, 'users', authUser.uid);
        await updateDoc(userRef, { photoURL: imageUrl });
        console.log("Avatar updated successfully (compressed):", imageUrl);
      } else {
        alert("Upload failed: " + (result.error?.message || "Unknown error"));
      }
    } catch (error) {
      console.error("Failed to process/upload avatar:", error);
      alert("Failed to upload avatar. Please try a different image.");
    } finally {
      setIsUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Old useEffect has been merged into auth listener.

  const handleSaveUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim().length > 0) {
      if (BOT_NAMES.map(n => n.toLowerCase()).includes(username.trim().toLowerCase())) {
        alert("This codename is reserved for bots. Please choose another.");
        return;
      }

      const q = query(collection(db, 'users'), where('displayNameLowercase', '==', username.trim().toLowerCase()));
      const snap = await getDocs(q);

      const isTaken = !snap.empty && snap.docs[0].id !== authUser?.uid;

      if (isTaken) {
        alert("Codename is already taken. Please choose another one.");
        return;
      }

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

  const handleBackToLobby = async () => {
    if (localRole === 'p1' && roomId) {
      try {
        await deleteDoc(doc(db, "games", roomId));
        console.log("Room deleted successfully on cancellation:", roomId);
      } catch (err) {
        console.error("Failed to delete room on cancellation:", err);
      }
    } else if (localRole === 'p2' && roomId) {
      try {
        await updateDoc(doc(db, "games", roomId), { guest: null, guestId: null, guestPhotoURL: null });
      } catch (err) {
        console.error("Failed to update room on cancellation:", err);
      }
    }
    setRoomId(null);
    setLocalRole(null);
    localStorage.removeItem('multi_battle_roomid');
    localStorage.removeItem('multi_battle_role');
    setGameState({
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
    setPool([]);
    setUsedIndices(new Set());
  };

  const handleUpdateUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    if (tempUsername.trim().length > 0) {
      if (BOT_NAMES.map(n => n.toLowerCase()).includes(tempUsername.trim().toLowerCase())) {
        alert("This codename is reserved for bots. Please choose another.");
        return;
      }

      const q = query(collection(db, 'users'), where('displayNameLowercase', '==', tempUsername.trim().toLowerCase()));
      const snap = await getDocs(q);

      const isTaken = !snap.empty && snap.docs[0].id !== authUser?.uid;

      if (isTaken) {
        alert("Codename is already taken. Please choose another one.");
        return;
      }

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
          hostPhotoURL: userPhotoURL,
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
  const [hostPhotoURLState, setHostPhotoURLState] = useState<string | null>(null);
  const [guestPhotoURLState, setGuestPhotoURLState] = useState<string | null>(null);
  const [showMatchmakingAnim, setShowMatchmakingAnim] = useState(false);
  const matchmakingShownRef = useRef(false); // prevents re-trigger on subsequent snapshots
  const [activeEmoji, setActiveEmoji] = useState<{ emoji: string, id: number } | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const lastEmojiTime = useRef<number>(0);
  const EMOJIS = ["🔥", "💀", "🤡", "🥶", "🤯", "🤣", "👍", "👎"];
  const [openRooms, setOpenRooms] = useState<Room[]>([]);
  const [botRooms, setBotRooms] = useState<Room[]>([]);
  const [fakeActivePlayers, setFakeActivePlayers] = useState<number>(0);
  const [roomChat, setRoomChat] = useState<{ senderId: string, senderName: string, text: string, timestamp: number }[]>([]);
  const [chatMessage, setChatMessage] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [roomCreatedAt, setRoomCreatedAt] = useState<number | null>(null);

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
      const now = Date.now();
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as Room;
        // Filter out rooms older than 5 minutes (300,000 ms) AND hide own rooms
        if (now - data.createdAt < 300000 && data.hostId !== localUserId) {
          rooms.push(data);
        }
      });
      setOpenRooms(rooms);
    });

    setBotRooms(generateBotRooms(INITIAL_PLAYER));
    return () => unsub();
  }, [roomId]);

  useEffect(() => {
    if (roomId) return;

    const statsRef = doc(db, 'stats', 'activePlayers');

    // 1. Listen for real-time updates from Firebase
    const unsub = onSnapshot(statsRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setFakeActivePlayers(data.count || 1000);
      } else {
        // Initialize if first time
        setDoc(statsRef, {
          count: Math.floor(Math.random() * (1500 - 700 + 1)) + 700,
          lastUpdated: serverTimestamp()
        }).catch(console.error);
      }
    });

    // 2. Distributed Updater: Every client checks if data is stale (>5s)
    // Only one client will succeed in updating due to the 5s window
    const interval = setInterval(async () => {
      if (!authUser) return;

      try {
        const snap = await getDoc(statsRef);
        if (snap.exists()) {
          const data = snap.data();
          const lastUpdated = (data.lastUpdated as any)?.toMillis() || 0;
          const now = Date.now();

          if (now - lastUpdated > 5000) {
            const prevCount = data.count || 1000;
            const change = Math.floor(Math.random() * 31) - 15;
            let newValue = prevCount + change;

            if (newValue < 700) newValue = 700 + Math.floor(Math.random() * 20);
            if (newValue > 1500) newValue = 1500 - Math.floor(Math.random() * 20);

            await updateDoc(statsRef, {
              count: newValue,
              lastUpdated: serverTimestamp()
            });
          }
        }
      } catch (err) {
        // Silent catch for race conditions or permission issues
        console.error("Silent error:", err);
      }
    }, 5000);

    return () => {
      unsub();
      clearInterval(interval);
    };
  }, [roomId, authUser]);

  useEffect(() => {
    if (!roomId) return;
    // Reset the once-only guard synchronously each time roomId (or localRole) changes
    matchmakingShownRef.current = false;
    const unsub = onSnapshot(doc(db, "games", roomId), (docSnapshot) => {
      if (docSnapshot.exists()) {
        const data = docSnapshot.data() as Room;
        setGuestPlayer(data.guest || null);
        setHostId(data.hostId || null);
        setGuestId(data.guestId || null);
        setHostPhotoURLState(data.hostPhotoURL || null);
        setGuestPhotoURLState(data.guestPhotoURL || null);
        setRoomChat(data.chat || []);
        setRoomCreatedAt(data.createdAt || null);

        if (data.latestEmoji && data.latestEmoji.timestamp > lastEmojiTime.current) {
          lastEmojiTime.current = data.latestEmoji.timestamp;
          // Only show reaction for the receiver, not the sender
          if (data.latestEmoji.senderId !== localUserId) {
            setActiveEmoji({ emoji: data.latestEmoji.emoji, id: data.latestEmoji.timestamp });
            setTimeout(() => setActiveEmoji(null), 3000);
          }
        }

        // Host: when guest joins, immediately push "matchmaking" status to Firestore
        // so BOTH players react at the exact same time
        if (data.guest && localRole === "p1" && data.gameState.status === "waiting_for_player" && !matchmakingShownRef.current) {
          matchmakingShownRef.current = true;
          // Update guest name locally so it shows in the VS screen immediately
          setGameState(prev => ({ ...prev, p2: { ...prev.p2, name: data.guest! } }));
          // Push matchmaking status – both players' snapshots will pick this up simultaneously
          updateFirestoreState({ status: "matchmaking" });
          // After 3s, start the real draft
          setTimeout(() => {
            updateFirestoreState({
              status: "drafting",
              turn: Math.random() > 0.5 ? "p1" : "p2",
              turnStartTime: Date.now(),
              p1Misses: 0,
              p2Misses: 0,
            });
          }, 3000);
        }

        // Both players: show the animation overlay while Firestore status is "matchmaking"
        if (data.gameState.status === "matchmaking") {
          setShowMatchmakingAnim(true);
        } else {
          setShowMatchmakingAnim(false);
        }

        setGameState(data.gameState);
      } else {
        // Room was deleted by the host or otherwise removed
        if (localRole === 'p2') {
          alert("The match was closed by the host.");
          setRoomId(null);
          setLocalRole(null);
          localStorage.removeItem('multi_battle_roomid');
          localStorage.removeItem('multi_battle_role');
          setGameState({
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
          setPool([]);
          setUsedIndices(new Set());
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
        hostPhotoURL: userPhotoURL,
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
      if (codeToJoin.startsWith('BOT-')) {
        const botRoom = botRooms.find(r => r.id === codeToJoin);
        if (!botRoom) {
          alert("Bot room no longer available!");
          setLoadingAction(null);
          return;
        }

        const newCode = generateRoomCode();
        const draftState: GameState = {
          ...botRoom.gameState,
          p2: INITIAL_PLAYER(username) as Player,
          status: "matchmaking" as const,
          turn: Math.random() > 0.5 ? "p1" : "p2",
          turnStartTime: Date.now()
        };
        const newRoom: Room = {
          id: newCode,
          host: botRoom.host,
          hostId: botRoom.hostId,
          hostPhotoURL: botRoom.hostPhotoURL || null,
          guest: username,
          guestId: localUserId,
          guestPhotoURL: userPhotoURL || null,
          gameState: draftState,
          createdAt: Date.now(),
          isPublic: false,
          intendedPublic: false
        };
        await setDoc(doc(db, "games", newCode), newRoom);

        setRoomId(newCode);
        setLocalRole("p2");
        setLoadingAction(null);

        // Transition to drafting after matchmaking animation duration
        setTimeout(async () => {
          try {
            await updateDoc(doc(db, "games", newCode), {
              'gameState.status': 'drafting',
              'gameState.turnStartTime': Date.now()
            });
          } catch (_) { }
        }, 3000);
        return;
      }

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
          guestPhotoURL: userPhotoURL || null,
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

  const handleCancelMatch = async () => {
    if (!matchToReconnect) return;
    if (!window.confirm("Are you sure you want to cancel this match?")) return;

    setLoadingAction('canceling');
    try {
      await deleteDoc(doc(db, "games", matchToReconnect.id));
      localStorage.removeItem('multi_battle_roomid');
      localStorage.removeItem('multi_battle_role');
      setMatchToReconnect(null);
      setGameState({
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
      setPool([]);
      setUsedIndices(new Set());
    } catch (err) {
      console.error("Failed to cancel match:", err);
    } finally {
      setLoadingAction(null);
    }
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

  const [showSurrenderConfirm, setShowSurrenderConfirm] = useState(false);

  const confirmInGameSurrender = async () => {
    setShowSurrenderConfirm(false);
    if (!roomId) return;

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

  const handleInGameSurrender = () => {
    setShowSurrenderConfirm(true);
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

  const startDraft = async (mode: GameMode, series: string | null) => {
    let chars = charactersPool[mode];
    if (!chars) {
      setLoadingAction('loading-data');
      chars = await loadDataset(mode);
      setCharactersPool(prev => ({ ...prev, [mode]: chars }));
      setLoadingAction(null);
    }

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
          if (snap.exists()) {
            const updates: any = { createdAt: Date.now() };
            if (snap.data().intendedPublic) {
              updates.isPublic = true;
            }
            updateDoc(roomRef, updates);
          }
        }).catch(console.error);
      }
    }
  };

  const replenishQueue = () => {
    const currentNextCount = gameState.nextDraws?.length || 0;
    let needed = 4 - currentNextCount;
    if (!gameState.currentDraw) needed += 1;
    if (needed <= 0) return null;

    const drawn: Character[] = [];
    const newUsed = new Set(usedIndices);

    for (let i = 0; i < needed; i++) {
      if (newUsed.size >= pool.length) {
        newUsed.clear(); // Recycling characters if the pool exhausts to prevent lockups
      }
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
    const runRecovery = async () => {
      if ((gameState.status === 'drafting' || gameState.status === 'ready') && pool.length === 0 && gameState.config.mode) {
        console.log("[Recovery] Rebuilding character pool and used indices...");

        let chars: any[] = charactersPool[gameState.config.mode];
        if (!chars) {
          chars = await loadDataset(gameState.config.mode);
          setCharactersPool(prev => ({ ...prev, [gameState.config.mode]: chars }));
        }

        const series = gameState.config.series;
        if (series && series !== "All") {
          if (gameState.config.mode === "Pokemon") {
            chars = chars.filter((c: any) => c.region === series);
          } else {
            chars = chars.filter((c: any) => c.series === series);
          }
        }
        chars = chars.filter((c: any) => c.stats !== null);
        setPool(chars);

        // Reconstruct used indices to prevent duplicates
        const used = new Set<number>();
        const allPickedNames = new Set([
          ...Object.values(gameState.p1.team).map((c: any) => c?.name),
          ...Object.values(gameState.p2.team).map((c: any) => c?.name),
          gameState.currentDraw?.name,
          ...(gameState.nextDraws || []).map((c: any) => c?.name)
        ].filter(Boolean));

        chars.forEach((c: any, idx: number) => {
          if (allPickedNames.has(c.name)) {
            used.add(idx);
          }
        });
        setUsedIndices(used);
      }
    };
    runRecovery();
  }, [gameState.status, gameState.config.mode, gameState.config.series, pool.length, gameState.p1.team, gameState.p2.team, gameState.currentDraw?.name, gameState.nextDraws?.length]);

  useEffect(() => {
    // Only host handles generating chars, UNLESS the host is a bot, then p2 handles it
    const isHostBot = hostId?.startsWith("BOT_ID_");
    if (localRole !== "p1" && !isHostBot) return;

    if (gameState.status === "drafting" && pool.length > 0) {
      const updates = replenishQueue();
      if (updates) {
        updateFirestoreState(updates);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState.status, gameState.currentDraw?.name, gameState.nextDraws?.length, pool, localRole, hostId, guestId]);

  const roles = useMemo(() => getRolesForMode(gameState.config.mode), [gameState.config.mode]);

  const assignRole = (role: string, force: boolean = false) => {
    if (!gameState.currentDraw) return;
    if (!force && gameState.turn !== localRole) return; // Prevent out-of-turn assignment

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

  const skipTurn = (force: boolean = false) => {
    if (!force && gameState.turn !== localRole) return;
    const currentPlayer = gameState[gameState.turn];

    // If the team is completely full, they must discard the card (burn it)
    // This doesn't cost a skip point.
    const isBoardFull = Object.keys(currentPlayer.team).length === roles.length;

    if (!isBoardFull && currentPlayer.skips <= 0) return;

    let nextChar = null;
    let nextQueue = gameState.nextDraws || [];

    if (nextQueue.length > 0) {
      nextChar = nextQueue[0];
      nextQueue = nextQueue.slice(1);
    }

    const newState: Partial<GameState> = {
      [gameState.turn]: { ...currentPlayer, skips: isBoardFull ? currentPlayer.skips : currentPlayer.skips - 1 },
      turn: gameState.turn === "p1" ? "p2" : "p1",
      currentDraw: nextChar,
      nextDraws: nextQueue,
      turnStartTime: Date.now(),
    };

    setGameState(prev => ({ ...prev, ...newState } as GameState));
    updateFirestoreState(newState);
  };

  const [timeLeft, setTimeLeft] = useState<number>(30);
  const [roomExpiryTimeLeft, setRoomExpiryTimeLeft] = useState<number | null>(null);

  useEffect(() => {
    const activeDoc = roomId
      ? { id: roomId, status: gameState.status, role: localRole, createdAt: roomCreatedAt }
      : matchToReconnect
        ? { id: matchToReconnect.id, status: matchToReconnect.gameState.status, role: matchToReconnect.hostId === localUserId ? 'p1' : 'p2', createdAt: matchToReconnect.createdAt }
        : null;

    if (!activeDoc || activeDoc.role !== 'p1' || !activeDoc.createdAt) {
      setRoomExpiryTimeLeft(null);
      return;
    }

    if (!["setup", "waiting_for_player"].includes(activeDoc.status)) {
      setRoomExpiryTimeLeft(null);
      return;
    }

    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = now - activeDoc.createdAt!;
      const remaining = Math.max(0, 300 - Math.floor(elapsed / 1000));
      setRoomExpiryTimeLeft(remaining);

      if (remaining === 0) {
        clearInterval(interval);
        handleCancelMatchSilent(activeDoc.id);
      }
    }, 1000);

    const now = Date.now();
    const elapsed = now - activeDoc.createdAt!;
    const remaining = Math.max(0, 300 - Math.floor(elapsed / 1000));
    setRoomExpiryTimeLeft(remaining);

    if (remaining === 0) {
      handleCancelMatchSilent(activeDoc.id);
    }

    return () => clearInterval(interval);

  }, [roomId, localRole, roomCreatedAt, gameState.status, matchToReconnect, localUserId]);

  const handleCancelMatchSilent = async (rid: string) => {
    setLoadingAction('canceling');
    try {
      await deleteDoc(doc(db, "games", rid));
      localStorage.removeItem('multi_battle_roomid');
      localStorage.removeItem('multi_battle_role');
      setMatchToReconnect(null);
      setGameState({
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
      setPool([]);
      setUsedIndices(new Set());
    } catch (err) {
      console.error("Failed to cancel match:", err);
    } finally {
      setLoadingAction(null);
    }
  };

  useEffect(() => {
    if (gameState.status !== "drafting") return;

    const interval = setInterval(() => {
      const elapsed = Date.now() - gameState.turnStartTime;
      const remaining = Math.max(0, 30 - Math.floor(elapsed / 1000));
      setTimeLeft(remaining);

      // Auto-assign logic if time runs out and it's our turn
      const isOurTurn = gameState.turn === localRole;
      const opponentIsBot = localRole === "p1" ? guestId?.startsWith("BOT_ID_") : hostId?.startsWith("BOT_ID_");
      const isBotTurn = gameState.turn !== localRole && opponentIsBot;

      // If time runs out, or if it's bot's turn wait ~1.5 secs (remaining <= 28)
      if ((isOurTurn && remaining === 0) || (isBotTurn && remaining <= 28)) {
        clearInterval(interval);

        if (isBotTurn) {
          if (!gameState.currentDraw) return; // Wait for replenishment

          const botRole = gameState.turn;
          const currentPlayer = gameState[botRole];
          const availableRoles = roles.filter(r => !currentPlayer.team[r]);
          if (availableRoles.length > 0) {
            const randomRole = availableRoles[Math.floor(Math.random() * availableRoles.length)];
            assignRole(randomRole, true);
          } else {
            skipTurn(true);
          }
          return;
        }

        if (!gameState.currentDraw) {
          skipTurn(true);
          return;
        }

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

        const currentPlayer = gameState[localRole as "p1" | "p2"];
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
  }, [gameState.status, gameState.turnStartTime, gameState.turn, localRole, roles, hostId, guestId, gameState.currentDraw?.name]);

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

  if (isAuthLoading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center font-sans bg-[#050510]">
        <GamingBackground />
        <motion.div
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="flex flex-col items-center gap-6"
        >
          <div className="relative w-16 h-16 flex items-center justify-center">
            <div className="absolute inset-0 border-4 border-purple-500/30 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-purple-400 border-t-transparent border-r-transparent rounded-full animate-spin"></div>
            <Activity className="text-purple-400 w-6 h-6 animate-pulse" />
          </div>
          <span className="text-white font-black tracking-[0.3em] text-sm uppercase font-orbitron animate-pulse opacity-80">Synchronizing...</span>
        </motion.div>
      </div>
    );
  }

  if (!isUsernameSet) {
    return (
      <AuthOverlay
        username={username}
        setUsername={setUsername}
        onSaveUsername={handleSaveUsername}
        onLogin={handleLogin}
      />
    );
  }

  const isAppView = gameState.status === "drafting" || gameState.status === "ready";

  const handleScrollMatches = (e: React.UIEvent<HTMLDivElement>) => {
    const now = Date.now();
    if (now - scrollThrottleRef.current < 150) return; // 150ms throttle
    scrollThrottleRef.current = now;

    const target = e.target as HTMLDivElement;
    const { scrollTop, scrollHeight, clientHeight } = target;
    // adding a larger threshold to make it trigger easier
    if (scrollHeight - Math.ceil(scrollTop) <= clientHeight + 100) {
      if (!isLoadingMore && visibleMatchesCount < openRooms.length + botRooms.length) {
        setIsLoadingMore(true);
        setTimeout(() => {
          setVisibleMatchesCount(prev => prev + 4);
          setIsLoadingMore(false);
        }, 800); // Simulated delay for loading effect
      }
    }
  };

  return (
    <main className={`${isAppView ? 'h-[100dvh] overflow-hidden' : 'min-h-[100dvh] overflow-x-hidden overflow-y-auto'} relative w-full text-[#e0e0e6] p-2 sm:p-4 font-sans selection:bg-purple-500/30 flex flex-col items-center`}>
      <GamingBackground />

      {!roomId && (
        <TopProfileBar
          username={username}
          userPhotoURL={userPhotoURL}
          userStats={userStats}
          authUser={authUser}
          showProfileMenu={showProfileMenu}
          setShowProfileMenu={setShowProfileMenu}
          onLogout={handleLogout}
          onLogin={handleLogin}
          onAvatarUpload={handleAvatarUpload}
          isUploadingAvatar={isUploadingAvatar}
          onShowAbout={() => setShowAboutModal(true)}
          onShowPrivacy={() => setShowPrivacyModal(true)}
        />
      )}

      <div className={`w-full max-w-5xl flex-1 flex flex-col min-h-0 ${isAppView ? 'overflow-hidden' : ''}`}>
        {/* Hide giant header if we are drafting to save space */}
        {!isAppView && (
          <header className="text-center mb-12 relative shrink-0 pt-12">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#ff3c5f]/10 blur-[120px] -z-10 animate-pulse"></div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-[#6c63ff]/10 blur-[100px] -z-10 animate-pulse delay-700"></div>
            <h1 className="text-5xl md:text-7xl font-black italic tracking-tighter text-white mb-4 drop-shadow-2xl font-orbitron">
              MULTI <span className="text-[#ff3c5f] drop-shadow-[0_0_15px_rgba(255,60,95,0.8)]">{gameState.config.mode.toUpperCase()}</span> BATTLE
            </h1>
            <div className="flex items-center justify-center gap-4 mb-2">
              <span className="h-px w-24 bg-gradient-to-r from-transparent to-[#6c63ff]"></span>
              <p className="text-[#00f5ff] tracking-[0.3em] uppercase text-xs md:text-sm font-bold leading-none drop-shadow-[0_0_8px_rgba(0,245,255,0.8)]">
                Build Your Anime Dream Team & Battle Globally
              </p>
              <span className="h-px w-24 bg-gradient-to-l from-transparent to-[#6c63ff]"></span>
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
              key="lobby-container"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
              className="w-full flex-1 flex flex-col gap-6"
            >
              <div className="w-full max-w-lg mx-auto space-y-6">
                {/* Active Match Reconnection Alert */}
                <AnimatePresence mode="wait">
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

                        <h3 className="text-2xl font-black text-white italic tracking-tighter uppercase mb-2">
                          {matchToReconnect.hostId === localUserId ? "Your Live Match" : "Battle in Progress!"}
                        </h3>
                        {roomExpiryTimeLeft !== null && (
                          <div className="mb-4 flex items-center gap-2 px-3 py-1 bg-rose-500/10 border border-rose-500/30 rounded-full animate-pulse">
                            <Activity size={12} className="text-rose-400" />
                            <span className="text-[10px] font-black text-rose-400 uppercase tracking-widest">Expires in: {Math.floor(roomExpiryTimeLeft / 60)}:{(roomExpiryTimeLeft % 60).toString().padStart(2, '0')}</span>
                          </div>
                        )}
                        <p className="text-gray-300 text-sm font-bold uppercase tracking-widest mb-8 px-4 leading-relaxed">
                          {matchToReconnect.hostId === localUserId
                            ? "You have an open match. Join back or cancel it below."
                            : "We found an unfinished match. You can jump back in or surrender now."}
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
                          <button
                            onClick={handleContinueMatch}
                            className="py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase tracking-[0.2em] rounded-2xl transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:scale-[1.03] active:scale-95 text-xs flex items-center justify-center gap-2"
                          >
                            <Zap size={16} className="fill-current" /> {matchToReconnect.hostId === localUserId ? "REJOIN MATCH" : "Continue Battle"}
                          </button>
                          <button
                            onClick={["setup", "waiting_for_player"].includes(matchToReconnect.gameState.status) && matchToReconnect.hostId === localUserId ? handleCancelMatch : handleSurrender}
                            disabled={loadingAction === 'surrendering' || loadingAction === 'canceling'}
                            className="py-4 bg-gray-800/80 hover:bg-rose-900/40 text-gray-400 hover:text-rose-400 border border-white/5 hover:border-rose-500/30 font-black uppercase tracking-[0.2em] rounded-2xl transition-all active:scale-95 text-xs flex items-center justify-center gap-2"
                          >
                            {loadingAction === 'surrendering' || loadingAction === 'canceling' ? (
                              <div className="relative w-4 h-4">
                                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="absolute inset-0 border-2 border-white/20 border-t-rose-400 rounded-full" />
                              </div>
                            ) : <XCircle size={16} />}
                            {loadingAction === 'surrendering' ? 'ENDING...' : loadingAction === 'canceling' ? 'CANCELING...' : (["setup", "waiting_for_player"].includes(matchToReconnect.gameState.status) && matchToReconnect.hostId === localUserId ? 'Cancel Match' : 'Surrender')}
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
                  className="bg-gray-900/30 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-[0_0_50px_rgba(0,0,0,0.3)] relative overflow-hidden group"
                >
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-purple-500/30 rounded-tl-[1.5rem] pointer-events-none"></div>
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-purple-500/30 rounded-tr-[1.5rem] pointer-events-none"></div>
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-purple-500/30 rounded-bl-[1.5rem] pointer-events-none"></div>
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-purple-500/30 rounded-br-[1.5rem] pointer-events-none"></div>

                  <div className="flex flex-col gap-6 relative z-10 w-full">

                    {/* Top Row: Avatar, Info & Stats */}
                    <div className="flex flex-col lg:flex-row items-center justify-between gap-6 w-full bg-black/40 backdrop-blur-md p-6 rounded-3xl border border-white/5 shadow-[inset_0_0_30px_rgba(0,0,0,0.5)]">

                      {/* Left Side: Avatar & Info */}
                      <div className="flex flex-col sm:flex-row items-center gap-6">
                        <div className="flex flex-col items-center sm:items-start text-center sm:text-left">
                          <div className="flex items-center gap-2">
                            {/* Replaced 'Operator Active' with Codename indicator visually, actual codename is the username below */}
                            <span className="text-[10px] sm:text-xs font-black text-purple-400 uppercase tracking-[0.4em] leading-none drop-shadow-[0_0_8px_rgba(168,85,247,0.5)] bg-purple-500/10 px-3 py-1.5 rounded border border-purple-500/30">CODENAME</span>
                            {!authUser && <span className="text-[9px] bg-amber-500/10 border border-amber-500/30 text-amber-500 px-2 py-1.5 rounded font-black tracking-[0.2em] leading-none">GUEST</span>}
                          </div>
                          {isEditingUsername ? (
                            <form onSubmit={handleUpdateUsername} className="flex items-center gap-2 mt-2">
                              <input
                                autoFocus
                                type="text"
                                value={tempUsername}
                                onChange={e => setTempUsername(e.target.value)}
                                className="bg-black/80 border-2 border-purple-500/50 text-white text-2xl font-black tracking-widest uppercase rounded-xl px-4 py-2 w-full max-w-[280px] focus:outline-none focus:border-purple-400 shadow-[0_0_30px_rgba(168,85,247,0.15)] placeholder:text-gray-600 transition-all font-orbitron"
                                placeholder="ENTER ALIAS..."
                                maxLength={9}
                              />
                              <button type="submit" disabled={tempUsername.trim().length === 0} className="p-3 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/40 rounded-xl transition-all border border-emerald-500/30 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:grayscale disabled:hover:scale-100">
                                <Check size={24} className="drop-shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                              </button>
                            </form>
                          ) : (
                            <div className="flex items-center gap-3 group/name cursor-pointer" onClick={() => { setTempUsername(username); setIsEditingUsername(true); }}>
                              <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white italic tracking-tighter uppercase leading-none drop-shadow-[0_0_30px_rgba(255,255,255,0.4)] font-orbitron group-hover/name:text-purple-100 transition-colors">{username}</h2>
                              <button aria-label="Edit Username" className="p-2 sm:p-2.5 bg-white/5 group-hover/name:bg-purple-500/30 text-gray-500 group-hover/name:text-purple-300 border border-white/10 group-hover/name:border-purple-500/60 rounded-xl transition-all shadow-sm shrink-0">
                                <Edit2 size={18} className="group-hover/name:drop-shadow-[0_0_12px_rgba(168,85,247,1)]" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Stats Highlights (Now right-aligned in top row on lg screens) */}
                      <div className="flex items-center gap-8 sm:gap-12 px-6 py-4 justify-center lg:justify-end">
                        <div className="flex flex-col items-center group/stat cursor-default">
                          <span className="text-emerald-400 font-black text-4xl sm:text-5xl leading-none font-orbitron drop-shadow-[0_0_20px_rgba(16,185,129,0.7)] group-hover/stat:scale-110 transition-transform">{userStats?.wins || 0}</span>
                          <span className="text-[10px] sm:text-xs text-emerald-500/60 font-black uppercase tracking-[0.4em] mt-3 group-hover/stat:text-emerald-400 transition-colors">Wins</span>
                        </div>
                        <div className="w-px h-16 bg-gradient-to-b from-transparent via-white/20 to-transparent"></div>
                        <div className="flex flex-col items-center group/stat cursor-default">
                          <span className="text-rose-500 font-black text-4xl sm:text-5xl leading-none font-orbitron drop-shadow-[0_0_20px_rgba(244,63,94,0.7)] group-hover/stat:scale-110 transition-transform">{userStats?.losses || 0}</span>
                          <span className="text-[10px] sm:text-xs text-rose-500/60 font-black uppercase tracking-[0.4em] mt-3 group-hover/stat:text-rose-400 transition-colors">Loss</span>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Row: Social & Rankings side-by-side */}
                    <div className="grid grid-cols-2 gap-4 sm:gap-6">
                      {/* Social Button */}
                      <button
                        onClick={() => setShowFriendsModal(true)}
                        className="relative w-full flex flex-col items-center justify-center py-6 sm:py-8 bg-gradient-to-br from-blue-500/10 to-transparent hover:from-blue-500/20 border border-blue-500/20 hover:border-blue-500/50 rounded-3xl transition-all group/friends shadow-[0_0_20px_rgba(0,0,0,0.4)] hover:shadow-[0_0_30px_rgba(59,130,246,0.3)] hover:-translate-y-1 active:scale-95 overflow-hidden"
                      >
                        {/* Subtle background glow */}
                        <div className="absolute inset-0 bg-blue-500/5 opacity-0 group-hover/friends:opacity-100 transition-opacity blur-xl"></div>

                        <div className="relative z-10 flex flex-col items-center">
                          <Users className="w-8 h-8 sm:w-10 sm:h-10 text-blue-400 mb-3 group-hover/friends:scale-110 transition-transform drop-shadow-[0_0_12px_rgba(59,130,246,0.8)]" />
                          <span className="text-xs sm:text-sm font-black text-blue-400 uppercase tracking-[0.3em] drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">Social</span>
                          {incomingRequests.length > 0 && (
                            <span className="absolute -top-3 -right-6 sm:-top-4 sm:-right-8 px-2 py-0.5 bg-rose-500 text-white rounded-full flex items-center justify-center text-[11px] sm:text-xs font-black shadow-[0_0_15px_rgba(244,63,94,1)] animate-bounce border-2 border-gray-900">{incomingRequests.length} NEW</span>
                          )}
                        </div>
                      </button>

                      {/* Leaderboard Trigger */}
                      <button
                        onClick={() => setShowLeaderboard(true)}
                        className="relative w-full flex flex-col items-center justify-center py-6 sm:py-8 bg-gradient-to-br from-yellow-500/10 to-transparent hover:from-yellow-500/20 border border-yellow-500/20 hover:border-yellow-500/50 rounded-3xl transition-all group/rank shadow-[0_0_20px_rgba(0,0,0,0.4)] hover:shadow-[0_0_30px_rgba(234,179,8,0.3)] hover:-translate-y-1 active:scale-95 overflow-hidden"
                      >
                        {/* Subtle background glow */}
                        <div className="absolute inset-0 bg-yellow-500/5 opacity-0 group-hover/rank:opacity-100 transition-opacity blur-xl"></div>

                        <div className="relative z-10 flex flex-col items-center">
                          <Trophy className="w-8 h-8 sm:w-10 sm:h-10 text-yellow-500 mb-3 group-hover/rank:scale-110 group-hover/rank:-rotate-12 transition-transform drop-shadow-[0_0_12px_rgba(234,179,8,0.8)]" />
                          <span className="text-xs sm:text-sm font-black text-yellow-500 uppercase tracking-[0.3em] drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">Rankings</span>
                        </div>
                      </button>
                    </div>

                  </div>
                </motion.div>

                {username && (
                  <Lobby
                    fakeActivePlayers={fakeActivePlayers}
                    loadingAction={loadingAction}
                    matchToReconnect={matchToReconnect ? matchToReconnect.id : null}
                    createRoom={createRoom}
                    joinCode={joinCode}
                    setJoinCode={setJoinCode}
                    handleJoinSubmit={handleJoinSubmit}
                    openRooms={openRooms}
                    botRooms={botRooms}
                    visibleMatchesCount={visibleMatchesCount}
                    handleScrollMatches={handleScrollMatches}
                    joinRoomWithCode={joinRoomWithCode}
                    isLoadingMore={isLoadingMore}
                    getDeterministicRoomImage={getDeterministicRoomImage}
                    charactersPool={charactersPool}
                  />
                )}
              </div>
            </motion.div>
          )}

          {/* ── MATCHMAKING ANIMATION ───────────────────────── */}
          {showMatchmakingAnim && (
            <motion.div
              key="matchmaking"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              transition={{ duration: 0.4 }}
              className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden"
              style={{ background: 'radial-gradient(ellipse at center, #0d0620 0%, #050510 100%)' }}
            >
              {/* Animated background glows */}
              <motion.div
                animate={{ scale: [1, 1.3, 1], opacity: [0.25, 0.45, 0.25] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute top-1/2 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-700/30 blur-[120px] rounded-full pointer-events-none"
              />
              <motion.div
                animate={{ scale: [1.3, 1, 1.3], opacity: [0.25, 0.45, 0.25] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute top-1/2 right-1/4 translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-700/30 blur-[120px] rounded-full pointer-events-none"
              />
              {/* Scanning line */}
              <motion.div
                animate={{ y: ['-100%', '200%'] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: 'linear' }}
                className="absolute inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-purple-400/40 to-transparent pointer-events-none"
                style={{ willChange: 'transform' }}
              />
              {/* Grid overlay */}
              <div className="absolute inset-0 opacity-[0.025] pointer-events-none"
                style={{ backgroundImage: 'linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)', backgroundSize: '48px 48px' }}
              />

              {/* Mode badge */}
              <motion.div
                initial={{ y: -30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.5 }}
                className="absolute top-10 flex flex-col items-center gap-2"
              >
                <span className="text-[10px] text-gray-500 font-black uppercase tracking-[0.5em]">Match Found</span>
                <div className="flex items-center gap-2 px-5 py-2 bg-white/5 border border-white/10 rounded-full backdrop-blur-md">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,1)]" />
                  <span className="text-sm font-black text-white tracking-widest uppercase">
                    {gameState.config.mode}
                    {gameState.config.series && gameState.config.series !== 'All' && (
                      <span className="text-purple-400 ml-2">· {gameState.config.series}</span>
                    )}
                  </span>
                </div>
              </motion.div>

              {/* Players row */}
              <div className="relative flex items-center justify-center w-full max-w-2xl px-4 gap-0">

                {/* Player 1 */}
                <motion.div
                  initial={{ x: -120, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.3, duration: 0.6, type: 'spring', stiffness: 90 }}
                  className="flex-1 flex flex-col items-center gap-4"
                >
                  <div className="relative">
                    {/* Glowing ring */}
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
                      className="absolute -inset-2 rounded-full border-2 border-dashed border-purple-500/40"
                    />
                    <motion.div
                      animate={{ scale: [1, 1.08, 1], opacity: [0.6, 1, 0.6] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="absolute -inset-4 rounded-full bg-purple-500/10 blur-xl"
                    />
                    <div className="relative w-28 h-28 rounded-full border-4 border-purple-500/60 overflow-hidden shadow-[0_0_40px_rgba(168,85,247,0.5)] bg-black/60">
                      {(localRole === 'p1' ? userPhotoURL : hostPhotoURLState) ? (
                        <img
                          src={(localRole === 'p1' ? userPhotoURL : hostPhotoURLState)!}
                          alt={gameState.p1.name}
                          className="w-full h-full object-cover"
                          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                        />
                      ) : (
                        <div className="w-full h-full bg-purple-500/20 flex items-center justify-center">
                          <Users size={40} className="text-purple-400" />
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="text-white font-black text-xl uppercase tracking-widest drop-shadow-[0_0_12px_rgba(168,85,247,0.8)]">
                      {gameState.p1.name}
                    </p>
                    <p className="text-purple-400/70 text-[10px] font-bold tracking-[0.35em] uppercase mt-1">Player 1</p>
                  </div>
                </motion.div>

                {/* VS Centre */}
                <motion.div
                  initial={{ scale: 0, rotate: -30, opacity: 0 }}
                  animate={{ scale: 1, rotate: 0, opacity: 1 }}
                  transition={{ delay: 0.7, duration: 0.5, type: 'spring', stiffness: 160 }}
                  className="relative flex flex-col items-center justify-center mx-4 shrink-0 w-28"
                >
                  {/* Outer glow ring */}
                  <motion.div
                    animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0.8, 0.4] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                    className="absolute w-24 h-24 rounded-full bg-gradient-to-br from-purple-600/30 to-blue-600/30 blur-xl"
                  />
                  <div className="relative flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-purple-900/80 to-blue-900/80 border-2 border-purple-500/50 shadow-[0_0_30px_rgba(168,85,247,0.6)]">
                    <span className="text-3xl font-black italic text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.8)] font-orbitron">VS</span>
                  </div>
                  {/* lightning bolts */}
                  <motion.div
                    animate={{ opacity: [0.4, 1, 0.4], scale: [0.8, 1.1, 0.8] }}
                    transition={{ duration: 0.8, repeat: Infinity }}
                    className="absolute -top-4 text-yellow-400 text-xl"
                  >⚡</motion.div>
                  <motion.div
                    animate={{ opacity: [1, 0.4, 1], scale: [1.1, 0.8, 1.1] }}
                    transition={{ duration: 0.8, repeat: Infinity }}
                    className="absolute -bottom-4 text-yellow-400 text-xl rotate-180"
                  >⚡</motion.div>
                </motion.div>

                {/* Player 2 */}
                <motion.div
                  initial={{ x: 120, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.3, duration: 0.6, type: 'spring', stiffness: 90 }}
                  className="flex-1 flex flex-col items-center gap-4"
                >
                  <div className="relative">
                    <motion.div
                      animate={{ rotate: -360 }}
                      transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
                      className="absolute -inset-2 rounded-full border-2 border-dashed border-blue-500/40"
                    />
                    <motion.div
                      animate={{ scale: [1.08, 1, 1.08], opacity: [1, 0.6, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="absolute -inset-4 rounded-full bg-blue-500/10 blur-xl"
                    />
                    <div className="relative w-28 h-28 rounded-full border-4 border-blue-500/60 overflow-hidden shadow-[0_0_40px_rgba(59,130,246,0.5)] bg-black/60">
                      {(localRole === 'p2' ? userPhotoURL : guestPhotoURLState) ? (
                        <img
                          src={(localRole === 'p2' ? userPhotoURL : guestPhotoURLState)!}
                          alt={gameState.p2.name}
                          className="w-full h-full object-cover"
                          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                        />
                      ) : (
                        <div className="w-full h-full bg-blue-500/20 flex items-center justify-center">
                          <Users size={40} className="text-blue-400" />
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="text-white font-black text-xl uppercase tracking-widest drop-shadow-[0_0_12px_rgba(59,130,246,0.8)]">
                      {gameState.p2.name}
                    </p>
                    <p className="text-blue-400/70 text-[10px] font-bold tracking-[0.35em] uppercase mt-1">Player 2</p>
                  </div>
                </motion.div>
              </div>

              {/* Bottom status */}
              <motion.div
                initial={{ y: 30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.9, duration: 0.5 }}
                className="absolute bottom-12 flex flex-col items-center gap-3"
              >
                <div className="flex items-center gap-2">
                  {[0, 1, 2].map(i => (
                    <motion.div
                      key={i}
                      animate={{ scale: [1, 1.4, 1], opacity: [0.4, 1, 0.4] }}
                      transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.2 }}
                      className="w-2 h-2 rounded-full bg-emerald-400"
                    />
                  ))}
                </div>
                <p className="text-gray-500 text-[11px] font-black uppercase tracking-[0.4em] animate-pulse">Preparing Battle...</p>
              </motion.div>
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
                <div className="flex flex-col flex-1">
                  {roomExpiryTimeLeft !== null && (
                    <div className="flex items-center justify-center gap-2 py-2 bg-rose-500/10 border-b border-rose-500/20">
                      <Activity size={12} className="text-rose-400" />
                      <span className="text-[10px] font-black text-rose-400 uppercase tracking-widest">Setup Phase - Room expires in: {Math.floor(roomExpiryTimeLeft / 60)}:{(roomExpiryTimeLeft % 60).toString().padStart(2, '0')}</span>
                    </div>
                  )}
                  <SetupScreen onStart={startDraft} onBack={handleBackToLobby} />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 relative">
                  <button
                    onClick={handleBackToLobby}
                    className="absolute top-0 left-0 p-3 bg-white/5 hover:bg-white/10 text-gray-500 hover:text-white rounded-2xl border border-white/5 transition-all flex items-center gap-2 font-black uppercase tracking-widest text-[10px]"
                  >
                    <ArrowLeft size={16} /> Back to Lobby
                  </button>
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
          )
          }

          {roomId && gameState.status === "waiting_for_player" && (
            <motion.div
              key="waiting"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.3 }}
              className="w-full flex-1 flex flex-col items-center justify-center -mt-20"
            >
              <div className="text-center p-12 bg-gray-900/40 backdrop-blur-xl border border-white/10 rounded-3xl max-w-xl mx-auto shadow-2xl w-full relative">
                <button
                  onClick={handleBackToLobby}
                  className="absolute top-6 left-6 p-3 bg-white/5 hover:bg-white/10 text-gray-500 hover:text-white rounded-2xl border border-white/5 transition-all flex items-center gap-2 font-black uppercase tracking-widest text-[10px]"
                >
                  <ArrowLeft size={16} /> Cancel Battle
                </button>
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

                {roomExpiryTimeLeft !== null && (
                  <div className="mt-8 flex flex-col items-center gap-2">
                    <div className="w-48 h-1 bg-white/5 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: "100%" }}
                        animate={{ width: `${(roomExpiryTimeLeft / 300) * 100}%` }}
                        className="h-full bg-rose-500"
                      />
                    </div>
                    <p className="text-[10px] font-black text-rose-400 uppercase tracking-[0.2em]">Match expires in: {Math.floor(roomExpiryTimeLeft / 60)}:{(roomExpiryTimeLeft % 60).toString().padStart(2, '0')}</p>
                  </div>
                )}
              </div>
            </motion.div>
          )
          }
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
                  showAddFriend={!!opponentId && !friendIds.has(opponentId)}
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

                  <AnimatePresence>
                    {showSurrenderConfirm && (
                      <motion.div initial={{ opacity: 0, scale: 0.9, y: -10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: -10 }} className="absolute top-12 right-0 bg-gray-900/95 backdrop-blur-xl border border-rose-500/20 rounded-2xl p-4 shadow-2xl w-64 z-[60]">
                        <div className="flex items-center gap-2 text-rose-500 mb-2">
                          <ShieldAlert size={16} />
                          <h4 className="font-black text-xs tracking-widest uppercase">Surrender Match?</h4>
                        </div>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-4 leading-relaxed">
                          Are you sure you want to surrender? You will immediately lose this match.
                        </p>
                        <div className="flex justify-end gap-2">
                          <button onClick={() => setShowSurrenderConfirm(false)} className="px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-gray-400 hover:text-white transition-colors">
                            Cancel
                          </button>
                          <button onClick={confirmInGameSurrender} className="px-3 py-1.5 bg-rose-500 hover:bg-rose-600 text-white text-[9px] font-black uppercase tracking-widest rounded-lg transition-colors">
                            Surrender
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <button onClick={() => setShowEmojiPicker(!showEmojiPicker)} className="bg-white/10 hover:bg-white/20 p-3 rounded-full backdrop-blur-md border border-white/10 transition-colors shadow-lg text-xl flex items-center justify-center relative">
                    😃
                  </button>

                  {/* Move Surrender button to top right for better access */}
                  <button
                    onClick={handleInGameSurrender}
                    className="p-1.5 sm:p-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 rounded-lg border border-rose-500/30 transition-all flex items-center justify-center gap-1 sm:gap-2 font-black uppercase tracking-widest text-[9px] sm:text-[10px]"
                    title="Surrender Match"
                  >
                    <XCircle size={12} className="sm:w-3.5 sm:h-3.5" /> Surrender
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
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.src = "https://img.icons8.com/ios-filled/100/ffffff/user-male-circle.png";
                              target.className = "absolute inset-0 w-full h-full object-contain opacity-20 p-8";
                            }}
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
                            onClick={() => skipTurn()}
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
          )
          }

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
                  {localRole === "p2" && localUserId && opponentId && !friendIds.has(opponentId) && (
                    <button
                      onClick={handleSendFriendRequest}
                      title="Add Friend"
                      className="p-2 ml-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg transition-colors border border-emerald-500/30"
                    >
                      <UserPlus size={16} />
                    </button>
                  )}
                </span>
                <span className="text-gray-600">VS</span>
                <span className="text-red-400 flex items-center gap-2">
                  {localRole === "p1" && localUserId && opponentId && !friendIds.has(opponentId) && (
                    <button
                      onClick={handleSendFriendRequest}
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
                  onClick={async () => {
                    if (roomId) {
                      try {
                        if (localRole === 'p1') {
                          await deleteDoc(doc(db, "games", roomId));
                        } else if (localRole === 'p2') {
                          await updateDoc(doc(db, "games", roomId), { guest: null, guestId: null, guestPhotoURL: null });
                        }
                      } catch (err) {
                        console.error("Failed to update room on exit:", err);
                      }
                    }
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
                    setPool([]);
                    setUsedIndices(new Set());
                  }}
                  className="px-8 py-4 bg-gray-800 hover:bg-gray-700 border border-white/10 rounded-full font-black text-gray-300 hover:text-white transition-all shadow-xl uppercase tracking-widest text-sm flex-1 max-w-[200px]"
                >
                  Exit Match
                </button>

                <button
                  onClick={() => {
                    if (localRole === "p1") {
                      // Preserve names and reset for rematch
                      const p1Name = gameState.p1.name;
                      const p2Name = gameState.p2.name;

                      updateFirestoreState({
                        status: "matchmaking", // Trigger VS animation and fast sync
                        p1: INITIAL_PLAYER(p1Name),
                        p2: INITIAL_PLAYER(p2Name),
                        currentDraw: null,
                        winner: null,
                        battleLog: []
                      });

                      setPool([]);
                      setUsedIndices(new Set());

                      // Reset once-only flag so animation plays again
                      matchmakingShownRef.current = false;

                      // After animation duration, move to drafting
                      setTimeout(() => {
                        updateFirestoreState({
                          status: "drafting",
                          turn: Math.random() > 0.5 ? "p1" : "p2",
                          turnStartTime: Date.now(),
                        });
                      }, 3000);
                    }
                  }}
                  disabled={localRole !== "p1" || (localRole === "p1" && !guestPlayer)}
                  className="px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full font-black text-white hover:scale-105 transition-transform shadow-xl uppercase tracking-widest text-sm disabled:opacity-50 disabled:cursor-not-allowed flex-1 max-w-[300px]"
                >
                  {localRole === "p1" ? (guestPlayer ? "Initiate New Conflict" : "Opponent Left") : "Waiting for Host..."}
                </button>
              </div>
            </motion.div>
          )
          }
        </AnimatePresence >
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
          <Suspense fallback={<div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100]"><div className="w-8 h-8 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin" /></div>}>
            <Leaderboard
              key="leaderboard-modal"
              currentUserId={localUserId}
              onClose={() => setShowLeaderboard(false)}
            />
          </Suspense>
        )}
        {showFriendsModal && (
          <Suspense fallback={<div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100]"><div className="w-8 h-8 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin" /></div>}>
            <FriendsModal
              key="friends-modal"
              currentUserId={localUserId}
              currentUsername={username}
              onClose={() => setShowFriendsModal(false)}
            />
          </Suspense>
        )}
      </AnimatePresence>

      {/* Match Chat Interface (Fixed Bottom Left) */}
      <AnimatePresence>
        {roomId && (gameState.status === "drafting" || gameState.status === "ready") && (
          <div className="fixed bottom-2 left-2 sm:bottom-4 sm:left-6 z-[60] flex flex-col items-start">
            <AnimatePresence>
              {isChatOpen && (
                <motion.div initial={{ opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.95 }} className="bg-gray-900/95 backdrop-blur-2xl border border-white/10 w-[240px] h-64 sm:w-80 sm:h-80 rounded-2xl mb-2 flex flex-col overflow-hidden shadow-2xl origin-bottom-left">
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
      {
        (!roomId || gameState.status === "setup" || gameState.status === "waiting_for_player") && (
          <Suspense fallback={null}>
            <GlobalChat currentUserId={localUserId} currentUsername={username} />
          </Suspense>
        )
      }

      <MatchInviteOverlay
        incomingInvite={incomingInvite}
        onAccept={handleAcceptInvite}
        onDecline={handleDeclineInvite}
      />

      <AboutModal isOpen={showAboutModal} onClose={() => setShowAboutModal(false)} />
      <PrivacyPolicyModal isOpen={showPrivacyModal} onClose={() => setShowPrivacyModal(false)} />

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
    </main >
  );
};

export default App;
