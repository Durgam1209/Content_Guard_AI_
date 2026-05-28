import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { AnalysisResult, MovieKnowledge } from '../types';
import { TrendingUp, Target, Award, Info, Loader2 } from 'lucide-react';

interface BenchmarkViewProps {
  analysis: AnalysisResult;
  benchmarkMovie: MovieKnowledge | null;
  onSelectBenchmark: (title: string) => void;
  isLoading?: boolean;
}

export const BenchmarkView: React.FC<BenchmarkViewProps> = ({ 
  analysis, 
  benchmarkMovie, 
  onSelectBenchmark, 
  isLoading = false 
}) => {
  
  // Calculate relative content profile scores for comparison
  const data = [
    {
      name: 'Violence',
      current: Math.round(analysis.score * 0.8),
      benchmark: benchmarkMovie?.contentDNA.violence ?? 45,
    },
    {
      name: 'Profanity',
      current: Math.round(analysis.score * 0.4),
      benchmark: benchmarkMovie?.contentDNA.profanity ?? 30,
    },
    {
      name: 'Sexual',
      current: Math.round(analysis.score * 0.2),
      benchmark: benchmarkMovie?.contentDNA.sex ?? 15,
    },
  ];

  const currentViolence = data[0].current;
  const benchmarkViolence = data[0].benchmark;
  const diffViolence = currentViolence - benchmarkViolence;

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-12 animate-in fade-in duration-700">
      <div className="border-l-8 border-cinema-gold pl-8">
        <h2 className="text-4xl font-black text-text-primary uppercase tracking-tighter mb-2">Competitive Benchmarking</h2>
        <p className="text-text-muted font-serif italic text-lg">Compare your content DNA against industry blockbusters.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-panel-bg cinematic-border p-8 cinematic-glow relative">
          {isLoading && (
            <div className="absolute inset-0 bg-panel-bg/85 backdrop-blur-sm z-10 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 text-cinema-gold animate-spin" />
              <p className="text-[10px] font-black uppercase tracking-widest text-cinema-gold">Querying Global Database...</p>
            </div>
          )}

          <div className="flex justify-between items-center mb-8">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-text-primary flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-director-red" /> Content DNA Comparison
            </h3>
            <div className="flex gap-4 text-[9px] font-black uppercase tracking-widest text-text-secondary">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-cinema-gold animate-pulse"></div>
                <span>Your Script</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-slate-700"></div>
                <span>{benchmarkMovie?.title || 'The Batman (2022)'}</span>
              </div>
            </div>
          </div>

          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <XAxis dataKey="name" stroke="#1a1e2a" tick={{fontSize: 10, fill: '#cbd5e1', fontWeight: 'bold'}} axisLine={false} tickLine={false} />
                <YAxis hide domain={[0, 100]} />
                <Tooltip 
                  cursor={{fill: 'rgba(26, 30, 42, 0.3)'}}
                  contentStyle={{ backgroundColor: '#0f1118', border: '1px solid #1a1e2a', borderRadius: '0', fontSize: '10px', fontWeight: '900', textTransform: 'uppercase', color: '#f8fafc' }}
                />
                <Bar dataKey="current" fill="#D4AF37" radius={[2, 2, 0, 0]} barSize={40} />
                <Bar dataKey="benchmark" fill="#334155" radius={[2, 2, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-film-black border border-border-color p-8 shadow-2xl relative">
            {isLoading && (
              <div className="absolute inset-0 bg-panel-bg/25 backdrop-blur-[1px] z-10"></div>
            )}
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-cinema-gold mb-6">AI Insight</h3>
            <div className="space-y-6">
              <div className="flex gap-4">
                <Target className="w-5 h-5 text-director-red flex-shrink-0" />
                <p className="text-xs text-text-secondary leading-relaxed font-medium">
                  Your content has <span className="text-director-red font-black">{diffViolence > 0 ? `${diffViolence}% more` : `${Math.abs(diffViolence)}% less`} graphic violence</span> than {benchmarkMovie?.title || 'The Batman'}.
                </p>
              </div>
              <div className="flex gap-4">
                <Award className="w-5 h-5 text-cinema-gold flex-shrink-0" />
                <p className="text-xs text-text-secondary leading-relaxed font-medium">
                  {analysis.score > 50 ? (
                    <span>To maintain a lower rating tier, consider reducing the intensity of flagged triggers.</span>
                  ) : (
                    <span>Your rating tier is highly compliant and aligns well with standard broadcast parameters.</span>
                  )}
                </p>
              </div>
              <div className="pt-6 border-t border-border-color">
                <p className="text-[10px] text-text-muted uppercase tracking-widest font-black mb-2 flex items-center gap-2">
                  <Info className="w-3 h-3 text-cinema-gold" /> Box Office Impact
                </p>
                <p className="text-xs text-text-secondary leading-relaxed font-serif italic">
                  "Moving to a higher restriction tier (e.g., R/A) could restrict teenager access and result in a <span className="text-director-red font-black">20-30% loss</span> in market reach."
                </p>
              </div>
            </div>
          </div>

          <div className="bg-panel-bg cinematic-border p-6 cinematic-glow">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-text-primary mb-4">Benchmark Target</h3>
            <select 
              value={benchmarkMovie?.title || 'The Batman'}
              onChange={(e) => onSelectBenchmark(e.target.value)}
              className="w-full bg-film-black border border-border-color text-[10px] font-black uppercase tracking-widest px-4 py-3 text-text-primary focus:outline-none focus:border-cinema-gold cursor-pointer"
            >
              <option value="The Batman">The Batman (2022)</option>
              <option value="Oppenheimer">Oppenheimer (2023)</option>
              <option value="Dune: Part Two">Dune: Part Two (2024)</option>
              <option value="Deadpool & Wolverine">Deadpool & Wolverine (2024)</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};
