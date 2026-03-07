import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ShieldCheck, Mail, Database, Eye, Lock, User, ExternalLink } from 'lucide-react';

interface PrivacyPolicyModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const Section: React.FC<{ icon: React.ReactNode; title: string; children: React.ReactNode; color: string }> = ({ icon, title, children, color }) => (
    <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
            <span className={color}>{icon}</span>
            <span className="text-sm font-black text-white uppercase tracking-wider">{title}</span>
        </div>
        <div className="pl-6 text-gray-400 text-[13px] leading-relaxed">{children}</div>
    </div>
);

const PrivacyPolicyModal: React.FC<PrivacyPolicyModalProps> = ({ isOpen, onClose }) => {
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
                        className="relative w-full max-w-lg bg-gray-950 border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="relative shrink-0 h-24 bg-gradient-to-br from-emerald-900/80 via-teal-900/60 to-cyan-900/80 flex items-center justify-center overflow-hidden">
                            <div className="absolute inset-0 opacity-30"
                                style={{
                                    backgroundImage: 'radial-gradient(ellipse at 50% 120%, rgba(16,185,129,0.5) 0%, transparent 60%)',
                                }}
                            />
                            <div className="relative flex flex-col items-center gap-1">
                                <div className="flex items-center gap-2">
                                    <ShieldCheck size={22} className="text-emerald-400" />
                                    <span className="text-xl font-black text-white tracking-widest uppercase">Privacy Policy</span>
                                </div>
                                <span className="text-[10px] font-bold text-emerald-300/70 tracking-[0.3em] uppercase">Last Updated: March 2025</span>
                            </div>
                            <button
                                onClick={onClose}
                                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                                aria-label="Close"
                            >
                                <X size={16} className="text-white" />
                            </button>
                        </div>

                        {/* Scrollable Content */}
                        <div className="overflow-y-auto flex-1 p-6 flex flex-col gap-5 scrollbar-thin">
                            <p className="text-gray-400 text-sm leading-relaxed text-center">
                                Your privacy matters to us. This policy explains what data we collect,
                                how we use it, and your rights regarding your information on <span className="text-white font-bold">Multi Anime Battle</span>.
                            </p>

                            <Section icon={<User size={15} />} title="Information We Collect" color="text-blue-400">
                                <ul className="list-disc list-inside space-y-1">
                                    <li>Display name / codename you choose</li>
                                    <li>Profile photo (optional, uploaded by you)</li>
                                    <li>Google account info (if signed in via Google)</li>
                                    <li>Match statistics: wins, losses, draws</li>
                                </ul>
                            </Section>

                            <Section icon={<Database size={15} />} title="How We Use Your Data" color="text-violet-400">
                                <ul className="list-disc list-inside space-y-1">
                                    <li>To display your profile and stats in-game</li>
                                    <li>To maintain your ranking on the leaderboard</li>
                                    <li>To enable real-time multiplayer functionality</li>
                                    <li>To allow friends and social features</li>
                                </ul>
                            </Section>

                            <Section icon={<Eye size={15} />} title="Data Sharing" color="text-amber-400">
                                We <strong className="text-white">do not sell or share</strong> your personal information with any third parties.
                                Your data is stored securely via <strong className="text-white">Google Firebase</strong> and is only used to operate this game.
                            </Section>

                            <Section icon={<Lock size={15} />} title="Data Security" color="text-emerald-400">
                                All data is stored using Google Firebase, which provides enterprise-grade security.
                                Anonymous users are assigned a unique ID and no personal information is required to play.
                                Google sign-in is handled securely by Google's OAuth system.
                            </Section>

                            <Section icon={<User size={15} />} title="Your Rights" color="text-rose-400">
                                <ul className="list-disc list-inside space-y-1">
                                    <li>Play anonymously without providing any personal info</li>
                                    <li>Delete your account and data at any time</li>
                                    <li>Update your display name and profile photo</li>
                                </ul>
                            </Section>

                            {/* Contact */}
                            <div className="flex flex-col gap-2">
                                <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest text-center">Contact &amp; Help</span>
                                <a
                                    href="mailto:diptype1@gmail.com"
                                    className="flex items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors group"
                                >
                                    <div className="flex items-center gap-3">
                                        <Mail size={16} className="text-emerald-400" />
                                        <div className="flex flex-col">
                                            <span className="text-sm font-bold text-gray-300 group-hover:text-white transition-colors">diptype1@gmail.com</span>
                                            <span className="text-[10px] text-gray-600 uppercase tracking-wider">Questions, reports &amp; support</span>
                                        </div>
                                    </div>
                                    <ExternalLink size={14} className="text-gray-600 group-hover:text-emerald-400 transition-colors" />
                                </a>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="shrink-0 px-6 py-4 bg-black/40 border-t border-white/5 text-center">
                            <span className="text-[10px] text-gray-600 font-bold tracking-widest uppercase">© 2025 Multi Anime Battle · All Rights Reserved</span>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default PrivacyPolicyModal;
