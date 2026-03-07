import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Zap, Trophy, Users, Mail, Heart, ExternalLink } from 'lucide-react';

interface AboutModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const AboutModal: React.FC<AboutModalProps> = ({ isOpen, onClose }) => {
    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[200] flex items-center justify-center p-4"
                    onClick={onClose}
                >
                    {/* Backdrop */}
                    <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        className="relative w-full max-w-md bg-gray-950 border border-white/10 rounded-3xl shadow-2xl overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header Gradient */}
                        <div className="relative h-28 bg-gradient-to-br from-violet-900/80 via-purple-900/60 to-indigo-900/80 flex items-center justify-center overflow-hidden">
                            <div className="absolute inset-0 opacity-30"
                                style={{
                                    backgroundImage: 'radial-gradient(ellipse at 50% 120%, rgba(139,92,246,0.5) 0%, transparent 60%)',
                                }}
                            />
                            <div className="relative flex flex-col items-center gap-1">
                                <div className="flex items-center gap-2">
                                    <Zap size={22} className="text-violet-400" fill="currentColor" />
                                    <span className="text-2xl font-black text-white tracking-widest uppercase">Multi Anime Battle</span>
                                    <Zap size={22} className="text-violet-400" fill="currentColor" />
                                </div>
                                <span className="text-[10px] font-bold text-violet-300/70 tracking-[0.3em] uppercase">The Ultimate Draft Arena</span>
                            </div>
                            <button
                                onClick={onClose}
                                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                                aria-label="Close"
                            >
                                <X size={16} className="text-white" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-6 flex flex-col gap-5">
                            {/* Description */}
                            <p className="text-gray-400 text-sm leading-relaxed text-center">
                                Challenge players worldwide in real-time anime character draft battles.
                                Build your dream team, outsmart your opponent, and climb the global leaderboard.
                            </p>

                            {/* Features */}
                            <div className="grid grid-cols-3 gap-3">
                                {[
                                    { icon: <Zap size={18} />, label: 'Real-Time', color: 'text-yellow-400' },
                                    { icon: <Trophy size={18} />, label: 'Leaderboard', color: 'text-amber-400' },
                                    { icon: <Users size={18} />, label: 'Multiplayer', color: 'text-violet-400' },
                                ].map(({ icon, label, color }) => (
                                    <div key={label} className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-white/5 border border-white/5">
                                        <span className={color}>{icon}</span>
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{label}</span>
                                    </div>
                                ))}
                            </div>

                            {/* Built By */}
                            <div className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-white/5 border border-white/5">
                                <Heart size={14} className="text-rose-400" fill="currentColor" />
                                <span className="text-sm text-gray-300 font-bold">Built with passion by <span className="text-white">Yash</span></span>
                            </div>

                            {/* Contact / Help */}
                            <div className="flex flex-col gap-2">
                                <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest text-center">Contact &amp; Help</span>
                                <a
                                    href="mailto:diptype1@gmail.com"
                                    className="flex items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-violet-500/10 border border-violet-500/20 hover:bg-violet-500/20 transition-colors group"
                                >
                                    <div className="flex items-center gap-3">
                                        <Mail size={16} className="text-violet-400" />
                                        <span className="text-sm font-bold text-gray-300 group-hover:text-white transition-colors">diptype1@gmail.com</span>
                                    </div>
                                    <ExternalLink size={14} className="text-gray-600 group-hover:text-violet-400 transition-colors" />
                                </a>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 bg-black/40 border-t border-white/5 flex items-center justify-between">
                            <span className="text-[10px] text-gray-600 font-bold tracking-widest uppercase">Version 2.0.0</span>
                            <span className="text-[10px] text-gray-700 font-bold tracking-widest uppercase">© 2025 Multi Anime Battle</span>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default AboutModal;
