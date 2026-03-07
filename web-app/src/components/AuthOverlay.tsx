import React from 'react';
import { motion } from 'framer-motion';
import { UserPlus } from 'lucide-react';
import GamingBackground from './GamingBackground';

interface AuthOverlayProps {
    username: string;
    setUsername: (name: string) => void;
    onSaveUsername: (e: React.FormEvent) => void;
    onLogin: () => void;
}

const AuthOverlay: React.FC<AuthOverlayProps> = ({ username, setUsername, onSaveUsername, onLogin }) => {
    return (
        <div className="min-h-screen bg-transparent text-white font-sans selection:bg-blue-500/30">
            <GamingBackground />
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

                <form onSubmit={onSaveUsername} className="space-y-4">
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
                        onClick={onLogin}
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
};

export default AuthOverlay;
