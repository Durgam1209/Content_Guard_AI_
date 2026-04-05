import React, { useState, useRef } from 'react';
import { Search, Globe, Database, AlertCircle, Film, BarChart3, Clock, TrendingUp, X, Tv, Clapperboard } from 'lucide-react';
import { getMovieCertificates } from '../services/geminiService';
import { MovieKnowledge } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const SUGGESTED_TITLES = ["Stranger Things", "Breaking Bad", "Oppenheimer", "The Boys", "Squid Game", "Deadpool", "Succession"];

export const GlobalDatabaseView = () => {
    const [query, setQuery] = useState('');
    const [data, setData] = useState<MovieKnowledge | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [history, setHistory] = useState<string[]>([]);
    
    // In-memory cache for efficient repeated lookups
    const cache = useRef<Map<string, MovieKnowledge>>(new Map());

    const executeSearch = async (term: string) => {
        if (!term.trim()) return;
        const normalizedTerm = term.trim();
        
        setQuery(normalizedTerm);
        setError(null);
        setLoading(true);

        // Check Cache
        const cacheKey = normalizedTerm.toLowerCase();
        if (cache.current.has(cacheKey)) {
            setData(cache.current.get(cacheKey)!);
            updateHistory(normalizedTerm);
            setLoading(false);
            return;
        }

        try {
            const result = await getMovieCertificates(normalizedTerm);
            if (result) {
                setData(result);
                cache.current.set(cacheKey, result);
                updateHistory(normalizedTerm);
            } else {
                setError("Title not found in global certification records.");
            }
        } catch (e) {
            setError("Failed to retrieve data. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const updateHistory = (term: string) => {
        setHistory(prev => {
            const filtered = prev.filter(t => t.toLowerCase() !== term.toLowerCase());
            return [term, ...filtered].slice(0, 6);
        });
    };

    const getBarData = (dna: any) => [
        { name: 'Violence', value: dna.violence, color: '#ef4444' },
        { name: 'Sexual Content', value: dna.sex, color: '#ec4899' },
        { name: 'Profanity', value: dna.profanity, color: '#eab308' },
    ];

    return (
        <div className="p-12 max-w-7xl mx-auto space-y-12 animate-in fade-in duration-700">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-l-8 border-cinema-gold pl-8">
                <div className="space-y-3">
                    <h2 className="text-4xl font-black text-film-black flex items-center gap-4 uppercase tracking-tighter">
                        <Globe className="w-10 h-10 text-director-red" />
                        Global Intelligence Database
                    </h2>
                    <p className="text-slate-600 font-serif italic text-lg">
                        Machine Learning driven historical certification data for Movies & TV Series.
                    </p>
                </div>
            </div>

            {/* Search Section */}
            <div className="space-y-6">
                <div className="bg-white border border-slate-200 p-10 shadow-sm relative overflow-hidden">
                    <div className="flex gap-6 relative z-10">
                        <div className="flex-1 relative group">
                            <Search className="absolute left-4 top-4 w-6 h-6 text-slate-500 group-focus-within:text-director-red transition-colors" />
                            <input 
                                type="text" 
                                className="w-full bg-slate-50 border border-slate-100 pl-14 pr-12 py-4 text-film-black placeholder-slate-500 focus:outline-none focus:border-cinema-gold focus:bg-white transition-all font-medium text-lg"
                                placeholder="Enter movie or TV series title (e.g., 'Breaking Bad', 'The Dark Knight')..."
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && executeSearch(query)}
                            />
                            {query && (
                                <button 
                                    onClick={() => setQuery('')}
                                    className="absolute right-4 top-4 text-slate-500 hover:text-director-red transition-colors"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                            )}
                        </div>
                        <button 
                            onClick={() => executeSearch(query)}
                            disabled={loading || !query}
                            className="bg-film-black hover:bg-director-red disabled:bg-slate-100 disabled:text-slate-300 text-white px-10 py-4 text-xs font-black uppercase tracking-[0.2em] transition-all flex items-center gap-3 shadow-sm"
                        >
                            {loading ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    Searching...
                                </>
                            ) : (
                                <>
                                    Search DB
                                    <Database className="w-4 h-4" />
                                </>
                            )}
                        </button>
                    </div>

                    {/* Quick Links / History */}
                    <div className="mt-6 flex flex-wrap items-center gap-3">
                        {history.length > 0 ? (
                            <>
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                    <Clock className="w-3 h-3" /> Recent:
                                </span>
                                {history.map(term => (
                                    <button
                                        key={term}
                                        onClick={() => executeSearch(term)}
                                        className="text-[10px] font-black uppercase tracking-widest bg-slate-50 hover:bg-cinema-gold hover:text-white text-slate-500 border border-slate-100 px-3 py-1.5 transition-all"
                                    >
                                        {term}
                                    </button>
                                ))}
                            </>
                        ) : (
                            <>
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                    <TrendingUp className="w-3 h-3" /> Trending:
                                </span>
                                {SUGGESTED_TITLES.map(term => (
                                    <button
                                        key={term}
                                        onClick={() => executeSearch(term)}
                                        className="text-[10px] font-black uppercase tracking-widest bg-slate-50 hover:bg-cinema-gold hover:text-white text-slate-500 border border-slate-100 px-3 py-1.5 transition-all"
                                    >
                                        {term}
                                    </button>
                                ))}
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Error State */}
            {error && (
                <div className="bg-director-red/5 border-l-8 border-director-red p-6 flex items-center gap-4 text-director-red font-black uppercase tracking-widest text-xs animate-in fade-in slide-in-from-top-4">
                    <AlertCircle className="w-6 h-6" />
                    <span>{error}</span>
                </div>
            )}

            {/* Results Section */}
            {data && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 animate-in slide-in-from-bottom-8 duration-700">
                    
                    {/* Left Col: Header & Regional Cards */}
                    <div className="lg:col-span-2 space-y-10">
                        <div className="bg-white border border-slate-200 p-10 relative overflow-hidden shadow-sm">
                             <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none">
                                {data.type === 'Series' ? (
                                    <Tv className="w-48 h-48 text-film-black" />
                                ) : (
                                    <Film className="w-48 h-48 text-film-black" />
                                )}
                            </div>
                            <div className="flex items-start justify-between mb-8 relative z-10">
                                <div>
                                    <h3 className="text-5xl font-black text-film-black mb-4 uppercase tracking-tighter">{data.title}</h3>
                                    <div className="flex gap-3">
                                        <span className={`text-[10px] font-black px-3 py-1 uppercase tracking-widest flex items-center border ${
                                            data.type === 'Series' ? 'bg-slate-50 border-slate-100 text-film-black' : 'bg-film-black border-film-black text-white'
                                        }`}>
                                            {data.type === 'Series' ? <Tv className="w-3 h-3 mr-2" /> : <Clapperboard className="w-3 h-3 mr-2" />}
                                            {data.type}
                                        </span>
                                        <span className="font-black text-[10px] uppercase tracking-widest bg-cinema-gold text-film-black px-3 py-1 flex items-center">
                                            {data.year}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div className="border-t border-slate-100 pt-8 relative z-10">
                                <h4 className="text-[10px] font-black text-director-red mb-4 uppercase tracking-[0.3em]">Cross-Regional Analysis</h4>
                                <p className="text-slate-600 text-lg leading-relaxed font-serif italic">
                                    {data.analysis}
                                </p>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <h4 className="text-xs font-black text-film-black flex items-center gap-3 uppercase tracking-[0.3em]">
                                <Globe className="w-6 h-6 text-director-red" />
                                Regional Certifications
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {data.certificates.map((cert, idx) => (
                                    <div key={idx} className="bg-slate-50 border border-slate-100 p-6 hover:border-cinema-gold hover:bg-white transition-all duration-300 group">
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex items-center gap-3">
                                                <span className="font-black text-film-black uppercase tracking-widest text-xs">{cert.region}</span>
                                                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 bg-white px-2 py-0.5 border border-slate-100">{cert.standard}</span>
                                            </div>
                                            <span className={`text-xs font-black px-3 py-1 uppercase tracking-widest bg-white border ${
                                                ['R', 'A', '18', 'NC-17', 'TV-MA'].includes(cert.rating) ? 'text-director-red border-director-red' :
                                                ['PG-13', '12A', 'UA', 'UA 13+', 'TV-14'].includes(cert.rating) ? 'text-cinema-gold border-cinema-gold' : 
                                                'text-emerald-600 border-emerald-600'
                                            }`}>
                                                {cert.rating}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-500 group-hover:text-film-black transition-colors leading-relaxed font-serif italic">
                                            {cert.reason}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Right Col: Content DNA & Stats */}
                    <div className="space-y-10">
                        <div className="bg-white border border-slate-200 p-10 shadow-sm">
                            <div className="flex items-center gap-4 mb-10 border-b border-slate-100 pb-6">
                                <BarChart3 className="w-6 h-6 text-director-red" />
                                <div>
                                    <h3 className="font-black text-film-black text-xs uppercase tracking-widest">Content DNA Profile</h3>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter mt-1">AI-Derived Intensity Vectors</p>
                                </div>
                            </div>
                            
                            <div className="h-80 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={getBarData(data.contentDNA)} layout="vertical" margin={{ left: 0, right: 20 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                                        <XAxis type="number" domain={[0, 100]} hide />
                                        <YAxis dataKey="name" type="category" width={120} tick={{fill: '#0A0A0A', fontSize: 10, fontWeight: 900}} axisLine={false} tickLine={false} />
                                        <Tooltip 
                                            cursor={{fill: '#f8fafc', opacity: 1}}
                                            contentStyle={{backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '0px', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                                            itemStyle={{color: '#0A0A0A', fontWeight: 900, fontSize: '10px', textTransform: 'uppercase'}}
                                        />
                                        <Bar dataKey="value" radius={[0, 0, 0, 0]} barSize={32} animationDuration={2000}>
                                            {getBarData(data.contentDNA).map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                            
                            <div className="mt-8 flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-400 px-2">
                                <span>Mild</span>
                                <span>Moderate</span>
                                <span>Extreme</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            
            {!data && !loading && !error && (
                <div className="flex flex-col items-center justify-center py-32 opacity-20 group">
                    <div className="flex gap-8 mb-10 group-hover:scale-110 transition-transform duration-700">
                         <Clapperboard className="w-24 h-24 text-film-black" />
                         <Tv className="w-24 h-24 text-film-black" />
                    </div>
                    <p className="text-film-black text-2xl font-black uppercase tracking-[0.5em]">Global Certification Records</p>
                    <p className="text-slate-400 text-sm mt-4 font-serif italic">Search 50,000+ Movies & TV Series across 50+ regions</p>
                </div>
            )}
        </div>
    );
};
