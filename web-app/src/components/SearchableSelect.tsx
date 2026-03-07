import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Search, Check } from 'lucide-react';

interface SearchableSelectProps {
    options: string[];
    value: string;
    onChange: (val: string) => void;
    label?: string;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = React.memo(({ options, value, onChange, label = "Option" }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState("");
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const filteredOptions = options.filter(opt =>
        opt.toLowerCase().includes(search.toLowerCase())
    );

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={containerRef}>
            <label className="block text-sm font-black uppercase tracking-[0.3em] text-gray-400 mb-4 px-1">{label}</label>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full bg-black/40 border border-white/10 text-white font-bold tracking-wider rounded-2xl px-5 py-4 flex items-center justify-between hover:bg-black/60 transition-colors shadow-inner"
            >
                <span className="truncate pr-4">{value}</span>
                <ChevronDown size={20} className={`transition-transform duration-300 text-purple-400 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute z-50 w-full mt-2 bg-gray-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-3xl"
                    >
                        <div className="p-3 border-b border-white/10 relative bg-black/20">
                            <Search size={16} className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-500" />
                            <input
                                ref={inputRef}
                                type="text"
                                placeholder="Search..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full bg-black/40 text-white rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500/50 font-medium tracking-wide placeholder:text-gray-600 border border-transparent focus:border-purple-500/30 transition-all font-sans input-no-zoom"
                            />
                        </div>
                        <div className="max-h-60 overflow-y-auto custom-scrollbar p-2">
                            {filteredOptions.length > 0 ? (
                                filteredOptions.map((opt) => (
                                    <button
                                        key={opt}
                                        type="button"
                                        onClick={() => {
                                            onChange(opt);
                                            setIsOpen(false);
                                            setSearch("");
                                        }}
                                        className={`w-full text-left px-5 py-3 text-sm flex items-center justify-between transition-colors
                      ${value === opt ? 'bg-purple-600/10 text-purple-400 font-bold' : 'text-gray-400 hover:bg-white/5 hover:text-white'}
                    `}
                                    >
                                        <span className="truncate">{opt}</span>
                                        {value === opt && <Check size={16} />}
                                    </button>
                                ))
                            ) : (
                                <div className="px-5 py-8 text-center text-gray-600 text-xs italic">
                                    No matches found.
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
});

