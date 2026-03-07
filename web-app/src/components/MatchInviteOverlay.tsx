import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sword } from 'lucide-react';

interface MatchInvite {
    id: string;
    senderName: string;
    roomId?: string;
}

interface MatchInviteOverlayProps {
    incomingInvite: MatchInvite | null;
    onAccept: () => void;
    onDecline: () => void;
}

const MatchInviteOverlay: React.FC<MatchInviteOverlayProps> = ({ incomingInvite, onAccept, onDecline }) => {
    return (
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
                        <button onClick={onDecline} className="flex-1 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 font-black uppercase tracking-widest text-xs transition-colors">
                            Decline
                        </button>
                        <button onClick={onAccept} className="flex-1 py-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-400 font-black uppercase tracking-widest text-xs transition-colors">
                            Accept
                        </button>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default MatchInviteOverlay;
