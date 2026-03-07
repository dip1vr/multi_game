import React from 'react';
import { motion } from 'framer-motion';
import { Users, Shield, Handshake, Activity } from 'lucide-react';

interface LobbyProps {
    fakeActivePlayers: number;
    loadingAction: string | null;
    matchToReconnect: string | null;
    createRoom: (isPublic: boolean) => Promise<void>;
    joinCode: string;
    setJoinCode: (code: string) => void;
    handleJoinSubmit: (e: React.FormEvent) => void;
    openRooms: any[];
    botRooms: any[];
    visibleMatchesCount: number;
    handleScrollMatches: (e: React.UIEvent<HTMLDivElement>) => void;
    joinRoomWithCode: (code: string, actionName: string) => void;
    isLoadingMore: boolean;
    getDeterministicRoomImage: (roomId: string, mode: string, series: string | null, charactersPool: Record<string, any[]>) => string | null;
    charactersPool: Record<string, any[]>;
}

const MatchItem = React.memo(({
    room,
    loadingAction,
    matchToReconnect,
    joinRoomWithCode,
    getDeterministicRoomImage,
    charactersPool
}: {
    room: any;
    loadingAction: string | null;
    matchToReconnect: string | null;
    joinRoomWithCode: (code: string, actionName: string) => void;
    getDeterministicRoomImage: (roomId: string, mode: string, series: string | null, charactersPool: Record<string, any[]>) => string | null;
    charactersPool: Record<string, any[]>;
}) => {
    const [isInView, setIsInView] = React.useState(false);
    const itemRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsInView(true);
                    observer.disconnect();
                }
            },
            { rootMargin: '200px' }
        );

        if (itemRef.current) {
            observer.observe(itemRef.current);
        }

        return () => observer.disconnect();
    }, []);

    const isJoiningThisRoom = loadingAction === `joining-${room.id}`;
    const isBot = room.id.startsWith('BOT-');
    const mode = room.gameState?.config?.mode || 'Anime';
    const series = room.gameState?.config?.series || null;
    const bgImg = getDeterministicRoomImage(room.id, mode, series, charactersPool);
    const avatarImg = isBot
        ? getDeterministicRoomImage(room.id + 'avatar', mode, series, charactersPool)
        : (room.hostPhotoURL || null);

    return (
        <div
            ref={itemRef}
            className="group relative flex items-center justify-between overflow-hidden rounded-[1.5rem] border border-white/10 hover:border-emerald-500/40 transition-[border-color,transform,box-shadow,opacity] duration-300 h-24 sm:h-28 bg-[#0a0a0e]"
            style={{
                contentVisibility: 'auto',
                containIntrinsicSize: '112px',
                willChange: 'transform',
                transform: 'translate3d(0,0,0)'
            }}
        >
            {/* Optimized Background Image (Lazy Loaded via State) */}
            {isInView && bgImg && (
                <img
                    src={bgImg}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="absolute inset-0 w-full h-full object-cover object-center opacity-20 group-hover:opacity-30 transition-opacity duration-500 pointer-events-none"
                />
            )}
            <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0c] via-[#0a0a0c]/80 to-transparent pointer-events-none" />
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/0 to-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

            <div className="relative flex items-center gap-4 p-4">
                <div className="relative shrink-0 w-16 h-16 rounded-xl overflow-hidden border border-white/10 bg-black/40 shadow-lg">
                    {avatarImg ? (
                        <img
                            src={avatarImg}
                            alt={room.host}
                            loading="lazy"
                            decoding="async"
                            onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.src = "https://img.icons8.com/ios-filled/100/ffffff/user-male-circle.png";
                                target.className = "w-full h-full object-contain opacity-20 p-2";
                            }}
                            className="w-full h-full object-cover object-top"
                        />
                    ) : (
                        <div className={`absolute inset-0 flex items-center justify-center ${isBot ? 'bg-purple-500/20' : 'bg-emerald-500/15'}`}>
                            <Users size={28} className={isBot ? 'text-purple-400' : 'text-emerald-400'} />
                        </div>
                    )}
                    <div className="absolute bottom-0.5 right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border border-black shadow-[0_0_6px_rgba(16,185,129,0.9)]" />
                </div>
                <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-white font-black uppercase text-base tracking-wider leading-none truncate max-w-[140px]">{room.host}</span>

                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-bold tracking-widest uppercase text-gray-400">
                        <span className={isBot ? 'text-purple-400/80' : 'text-emerald-400/80'}>{mode}</span>
                        {series && series !== 'All' && (
                            <>
                                <span className="text-white/10">•</span>
                                <span className="text-blue-400/70 truncate max-w-[110px]">{series}</span>
                            </>
                        )}
                    </div>
                </div>
            </div>
            <div className="relative pr-6">
                <button
                    onClick={() => joinRoomWithCode(room.id, `joining-${room.id}`)}
                    disabled={loadingAction !== null || matchToReconnect !== null}
                    className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:bg-gray-800 disabled:text-gray-500 text-gray-900 font-black text-[10px] tracking-[0.2em] uppercase rounded-full shadow-lg active:scale-95 transition-all"
                >
                    {isJoiningThisRoom ? (
                        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="w-4 h-4 border-2 border-gray-900/30 border-t-gray-900 rounded-full" />
                    ) : 'ENGAGE'}
                </button>
            </div>
        </div>
    );
});
MatchItem.displayName = 'MatchItem';

const Lobby: React.FC<LobbyProps> = ({
    fakeActivePlayers,
    loadingAction,
    matchToReconnect,
    createRoom,
    joinCode,
    setJoinCode,
    handleJoinSubmit,
    openRooms,
    botRooms,
    visibleMatchesCount,
    handleScrollMatches,
    joinRoomWithCode,
    isLoadingMore,
    getDeterministicRoomImage,
    charactersPool
}) => {
    return (
        <motion.div
            key="lobby"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
            className="flex-1 flex flex-col gap-8 sm:gap-12 py-2 sm:py-8"
        >
            <div className="grid lg:grid-cols-2 gap-8 sm:gap-12 h-full">
                {/* Profile and Social Controls */}
                <div className="space-y-8 flex flex-col h-full">
                    {/* Multiplayer Arena Section */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.1 }}
                        className="bg-gray-900/30 backdrop-blur-xl rounded-3xl border border-white/10 shadow-3xl relative overflow-hidden flex-1"
                    >
                        <div className="absolute inset-0 pointer-events-none opacity-5 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%]"></div>
                        <div className="p-8">
                            <div className="flex flex-col items-center justify-center mb-6">
                                <div className="flex items-center gap-2 px-4 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full mb-2">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.8)]"></div>
                                    <span className="text-emerald-400 font-black text-[10px] tracking-[0.2em] uppercase">
                                        {fakeActivePlayers.toLocaleString()} Active Players Mode
                                    </span>
                                </div>
                                <h2 className="text-3xl font-black italic tracking-tighter text-center">MULTIPLAYER</h2>
                            </div>

                            <div className="grid grid-cols-2 gap-4 sm:gap-6 auto-rows-fr">
                                <button
                                    onClick={() => createRoom(true)}
                                    disabled={loadingAction !== null || matchToReconnect !== null}
                                    className="group relative flex flex-col items-center justify-center gap-4 p-8 bg-gradient-to-br from-emerald-500/5 to-emerald-500/10 border-2 border-emerald-500/20 rounded-[2rem] font-black tracking-[0.2em] transition-all h-full disabled:opacity-30 disabled:grayscale disabled:cursor-not-allowed hover:border-emerald-500/50 hover:shadow-[0_0_40px_rgba(16,185,129,0.3)] hover:-translate-y-2 active:scale-95 overflow-hidden"
                                >
                                    <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-emerald-500/20 rounded-tl-[1.8rem] pointer-events-none group-hover:border-emerald-400 transition-all"></div>
                                    <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-emerald-500/20 rounded-tr-[1.8rem] pointer-events-none group-hover:border-emerald-400 transition-all"></div>
                                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-400/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                    <div className="relative w-16 h-16 bg-emerald-500/20 rounded-2xl flex items-center justify-center border border-emerald-500/30 mb-2 group-hover:scale-110 transition-transform shadow-lg">
                                        {loadingAction === 'hosting-public' ? (
                                            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="w-8 h-8 border-4 border-emerald-500/20 border-t-emerald-400 rounded-full" />
                                        ) : <Users size={32} className="text-emerald-400" />}
                                    </div>
                                    <div className="flex flex-col items-center">
                                        <span className="text-xl text-emerald-400 font-orbitron drop-shadow-[0_0_10px_rgba(16,185,129,0.5)]">PUBLIC</span>
                                        <span className="text-[10px] text-emerald-500/60 font-black tracking-widest mt-1 text-center">BATTLE ARENA</span>
                                    </div>
                                </button>

                                <button
                                    onClick={() => createRoom(false)}
                                    disabled={loadingAction !== null || matchToReconnect !== null}
                                    className="group relative flex flex-col items-center justify-center gap-4 p-8 bg-gradient-to-br from-purple-500/5 to-purple-500/10 border-2 border-purple-500/20 rounded-[2rem] font-black tracking-[0.2em] transition-all h-full disabled:opacity-30 disabled:grayscale disabled:cursor-not-allowed hover:border-purple-500/50 hover:shadow-[0_0_40px_rgba(168,85,247,0.3)] hover:-translate-y-2 active:scale-95 overflow-hidden"
                                >
                                    <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-purple-500/20 rounded-tl-[1.8rem] pointer-events-none group-hover:border-purple-400 transition-all"></div>
                                    <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-purple-500/20 rounded-tr-[1.8rem] pointer-events-none group-hover:border-purple-400 transition-all"></div>
                                    <div className="absolute inset-0 bg-gradient-to-br from-purple-400/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                    <div className="relative w-16 h-16 bg-purple-500/20 rounded-2xl flex items-center justify-center border border-purple-500/30 mb-2 group-hover:scale-110 transition-transform shadow-lg">
                                        {loadingAction === 'hosting-private' ? (
                                            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="w-8 h-8 border-4 border-purple-500/20 border-t-purple-400 rounded-full" />
                                        ) : <Shield size={32} className="text-purple-400" />}
                                    </div>
                                    <div className="flex flex-col items-center">
                                        <span className="text-xl text-purple-400 font-orbitron drop-shadow-[0_0_10px_rgba(168,85,247,0.5)]">PRIVATE</span>
                                        <span className="text-[10px] text-purple-500/60 font-black tracking-widest mt-1 text-center">DUEL MODE</span>
                                    </div>
                                </button>
                            </div>

                            <div className="relative flex items-center py-6 mt-2">
                                <div className="flex-grow border-t border-white/5"></div>
                                <span className="flex-shrink-0 mx-4 text-gray-600 text-[10px] font-bold uppercase tracking-widest">Or Join Private</span>
                                <div className="flex-grow border-t border-white/5"></div>
                            </div>

                            <form onSubmit={handleJoinSubmit} className="space-y-4">
                                <div className="relative flex flex-col sm:flex-row gap-3">
                                    <div className="relative flex-1">
                                        <input
                                            type="text"
                                            placeholder="ENTER ROOM CODE..."
                                            value={joinCode}
                                            onChange={e => setJoinCode(e.target.value)}
                                            className="w-full bg-black/60 border-2 border-white/10 text-center sm:text-left text-2xl font-black tracking-[0.4em] uppercase rounded-2xl px-6 py-5 focus:outline-none focus:border-purple-500/50 transition-all shadow-2xl placeholder:text-gray-700 placeholder:tracking-widest placeholder:text-sm"
                                            maxLength={5}
                                        />
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={joinCode.length < 5 || loadingAction !== null || matchToReconnect !== null}
                                        className="px-10 py-5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-30 disabled:grayscale disabled:cursor-not-allowed text-white font-black rounded-2xl transition-all shadow-[0_10px_30px_rgba(108,99,255,0.3)] hover:shadow-[0_15px_40px_rgba(108,99,255,0.5)] hover:-translate-y-1 active:scale-95 flex items-center justify-center gap-3 uppercase tracking-[0.2em] text-sm"
                                    >
                                        {loadingAction === 'joining' ? (
                                            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="w-5 h-5 border-3 border-white/20 border-t-white rounded-full" />
                                        ) : <Handshake size={22} />}
                                        JOIN
                                    </button>
                                </div>
                            </form>
                        </div>
                    </motion.div>
                </div>

                {/* Live Matches List */}
                <div className="h-full flex flex-col">
                    <div className="bg-[#0a0a0c]/80 backdrop-blur-xl p-8 rounded-[2.5rem] border border-white/10 shadow-2xl relative overflow-hidden flex-1 flex flex-col">
                        <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500/50"></div>
                        <div className="flex items-center justify-between mb-8">
                            <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-3">
                                <Activity size={18} className="text-emerald-400" /> LIVE OPEN MATCHES
                            </h3>
                            <span className="bg-emerald-500/20 text-emerald-400 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">{(openRooms.length + botRooms.length)} Available</span>
                        </div>
                        <div
                            className="space-y-4 overflow-y-auto custom-scrollbar pr-2 flex-1 max-h-[400px]"
                            onScroll={handleScrollMatches}
                        >
                            {[...openRooms, ...botRooms].slice(0, visibleMatchesCount).map((room) => (
                                <MatchItem
                                    key={room.id}
                                    room={room}
                                    loadingAction={loadingAction}
                                    matchToReconnect={matchToReconnect}
                                    joinRoomWithCode={joinRoomWithCode}
                                    getDeterministicRoomImage={getDeterministicRoomImage}
                                    charactersPool={charactersPool}
                                />
                            ))}
                            {isLoadingMore && (
                                <div className="flex justify-center items-center py-6">
                                    <div className="w-8 h-8 border-3 border-emerald-500/20 border-t-emerald-400 rounded-full animate-spin" />
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

export default Lobby;
