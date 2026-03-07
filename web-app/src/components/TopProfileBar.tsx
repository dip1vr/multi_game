import React, { useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ChevronDown, UserPlus, Edit2, LogOut, Info, ShieldAlert
} from 'lucide-react';
import { User as FirebaseAuthUser } from 'firebase/auth';

interface TopProfileBarProps {
    username: string;
    userPhotoURL: string | null;
    userStats: { wins: number, losses: number, draws: number } | null;
    authUser: FirebaseAuthUser | null;
    showProfileMenu: boolean;
    setShowProfileMenu: (show: boolean) => void;
    onLogout: () => void;
    onLogin: () => void;
    onAvatarUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    isUploadingAvatar: boolean;
    onShowAbout: () => void;
    onShowPrivacy: () => void;
}

const TopProfileBar: React.FC<TopProfileBarProps> = ({
    username,
    userPhotoURL,
    userStats,
    authUser,
    showProfileMenu,
    setShowProfileMenu,
    onLogout,
    onLogin,
    onAvatarUpload,
    isUploadingAvatar,
    onShowAbout,
    onShowPrivacy
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    return (
        <div className="absolute top-4 right-4 md:top-6 md:right-6 z-50 flex flex-col items-end">
            <div
                className="relative w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-black/60 border border-white/10 flex items-center justify-center shrink-0 overflow-hidden shadow-[0_0_20px_rgba(0,0,0,0.5)] group cursor-pointer backdrop-blur-md"
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                title="User Profile"
            >
                {userPhotoURL && userPhotoURL !== "" ? (
                    <img src={userPhotoURL} alt="Avatar" className="w-full h-full object-cover transition-transform group-hover:scale-110 group-hover:blur-[2px]" />
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
                            <div
                                onClick={() => !isUploadingAvatar && fileInputRef.current?.click()}
                                className="w-20 h-20 rounded-2xl bg-black/60 border border-white/10 flex items-center justify-center overflow-hidden shadow-inner mb-4 relative group cursor-pointer"
                            >
                                {userPhotoURL && userPhotoURL !== "" ? (
                                    <img src={userPhotoURL} alt="Avatar" className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                                ) : (
                                    <UserPlus size={32} className="text-gray-500" />
                                )}
                                {isUploadingAvatar && (
                                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-10 transition-opacity">
                                        <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <Edit2 size={24} className="text-white" />
                                </div>
                                {!authUser && <div className="absolute inset-0 bg-black/40 flex items-center justify-center"><span className="text-[9px] font-black uppercase tracking-widest text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">Guest</span></div>}
                            </div>

                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                accept="image/*"
                                onChange={onAvatarUpload}
                            />

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
                                <button onClick={() => { onLogin(); setShowProfileMenu(false); }} className="flex items-center flex-wrap gap-x-3 gap-y-1 px-4 py-3 bg-white/5 hover:bg-white/10 rounded-2xl transition-colors text-left text-sm font-bold text-white w-full group mb-1 border border-white/5">
                                    <img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" className="w-4 h-4 bg-white/10 p-1 rounded-full group-hover:bg-white/20 transition-colors" alt="G" />
                                    <div className="flex flex-col gap-0.5">
                                        <span className="text-[11px] leading-none uppercase tracking-widest font-black">Login with Google</span>
                                        <span className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">Keep your progress & rank</span>
                                    </div>
                                </button>
                            )}

                            <button onClick={() => { onLogout(); setShowProfileMenu(false); }} className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 rounded-2xl transition-colors text-left text-sm font-bold text-gray-400 hover:text-red-400 w-full group">
                                <LogOut size={18} className="text-gray-500 group-hover:text-red-400 transition-colors" /> Sign Out
                            </button>

                            <div className="h-px w-full bg-white/5 my-1"></div>

                            <button onClick={() => { setShowProfileMenu(false); onShowAbout(); }} className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 rounded-2xl transition-colors text-left text-sm font-bold text-gray-400 hover:text-white w-full group">
                                <Info size={18} className="text-gray-500 group-hover:text-blue-400 transition-colors" /> About
                            </button>
                            <button onClick={() => { setShowProfileMenu(false); onShowPrivacy(); }} className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 rounded-2xl transition-colors text-left text-sm font-bold text-gray-400 hover:text-white w-full group">
                                <ShieldAlert size={18} className="text-gray-500 group-hover:text-emerald-400 transition-colors" /> Privacy Policy
                            </button>
                        </div>

                        <div className="px-6 py-4 bg-black/40 border-t border-white/5 text-center mt-auto">
                            <span className="text-[10px] text-gray-600 font-bold tracking-widest uppercase">Version 2.0.0</span>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default TopProfileBar;
