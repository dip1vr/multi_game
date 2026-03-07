import React from 'react';
import { motion } from 'framer-motion';

const GamingBackground: React.FC = React.memo(() => {
    return (
        <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
            {/* Deep Space Base */}
            <div className="absolute inset-0 bg-[#050510]"></div>

            {/* Animated Nebula Glares */}
            <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-600/10 blur-[120px] rounded-full animate-pulse"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-600/10 blur-[120px] rounded-full animate-pulse" style={{ animationDelay: '2s' }}></div>

            {/* Tech Grid System */}
            <div
                className="absolute inset-0 opacity-[0.15]"
                style={{
                    backgroundImage: `linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)`,
                    backgroundSize: '40px 40px'
                }}
            ></div>

            {/* Moving Tech Scanline */}
            <motion.div
                animate={{ y: ['-100%', '200%'] }}
                transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0 bg-gradient-to-b from-transparent via-purple-500/5 to-transparent h-[50%] w-full"
                style={{ willChange: 'transform' }}
            ></motion.div>

            {/* Floating Particles */}
            {[...Array(20)].map((_, i) => (
                <motion.div
                    key={i}
                    initial={{
                        x: `${Math.random() * 100}%`,
                        y: `${Math.random() * 100}%`,
                        opacity: Math.random() * 0.5
                    }}
                    animate={{
                        y: [null, `${Math.random() * 100}%`],
                        opacity: [0, 0.5, 0]
                    }}
                    transition={{
                        duration: 10 + Math.random() * 20,
                        repeat: Infinity,
                        ease: "linear",
                        delay: Math.random() * 20
                    }}
                    className="absolute w-1 h-1 bg-white rounded-full blur-[1px]"
                    style={{ willChange: 'transform, opacity' }}
                />
            ))}
        </div>
    );
});

export default GamingBackground;
