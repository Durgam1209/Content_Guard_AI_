import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, Legend } from 'recharts';
import { AnalysisResult, MovieKnowledge } from '../types';
import { TrendingUp, Target, Award, Info } from 'lucide-react';

interface BenchmarkViewProps {
  analysis: AnalysisResult;
  benchmarkMovie?: MovieKnowledge;
}

export const BenchmarkView: React.FC<BenchmarkViewProps> = ({ analysis, benchmarkMovie }) => {
  const data = [
    {
      name: 'Violence',
      current: analysis.score * 0.8, // Mocked for comparison
      benchmark: benchmarkMovie?.contentDNA.violence || 45,
    },
    {
      name: 'Profanity',
      current: analysis.score * 0.4,
      benchmark: benchmarkMovie?.contentDNA.profanity || 30,
    },
    {
      name: 'Sexual',
      current: analysis.score * 0.2,
      benchmark: benchmarkMovie?.contentDNA.sex || 15,
    },
  ];

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-12 animate-in fade-in duration-700">
      <div className="border-l-8 border-cinema-gold pl-8">
        <h2 className="text-4xl font-black text-film-black uppercase tracking-tighter mb-2">Competitive Benchmarking</h2>
        <p className="text-slate-500 font-serif italic text-lg">Compare your content DNA against industry blockbusters.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white cinematic-border p-8 cinematic-glow">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-film-black flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-director-red" /> Content DNA Comparison
            </h3>
            <div className="flex gap-4 text-[9px] font-black uppercase tracking-widest">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-film-black"></div>
                <span>Your Script</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-slate-200"></div>
                <span>{benchmarkMovie?.title || 'The Batman (2022)'}</span>
              </div>
            </div>
          </div>

          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <XAxis dataKey="name" stroke="#cbd5e1" tick={{fontSize: 10, fill: '#94a3b8', fontWeight: 'bold'}} axisLine={false} tickLine={false} />
                <YAxis hide domain={[0, 100]} />
                <Tooltip 
                  cursor={{fill: '#f8fafc'}}
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '0', fontSize: '10px', fontWeight: '900', textTransform: 'uppercase' }}
                />
                <Bar dataKey="current" fill="#0A0A0A" radius={[2, 2, 0, 0]} barSize={40} />
                <Bar dataKey="benchmark" fill="#e2e8f0" radius={[2, 2, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-film-black p-8 shadow-2xl">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-cinema-gold mb-6">AI Insight</h3>
            <div className="space-y-6">
              <div className="flex gap-4">
                <Target className="w-5 h-5 text-director-red flex-shrink-0" />
                <p className="text-xs text-white/80 leading-relaxed font-medium">
                  Your script has <span className="text-director-red font-black">15% more graphic violence</span> than {benchmarkMovie?.title || 'The Batman (2022)'}.
                </p>
              </div>
              <div className="flex gap-4">
                <Award className="w-5 h-5 text-cinema-gold flex-shrink-0" />
                <p className="text-xs text-white/80 leading-relaxed font-medium">
                  To maintain a <span className="text-cinema-gold font-black">PG-13</span>, consider reducing the intensity of the scene at <span className="text-white font-black">TC: 01:24</span>.
                </p>
              </div>
              <div className="pt-6 border-t border-white/10">
                <p className="text-[10px] text-slate-400 uppercase tracking-widest font-black mb-2 flex items-center gap-2">
                  <Info className="w-3 h-3" /> Box Office Impact
                </p>
                <p className="text-xs text-white leading-relaxed font-serif italic">
                  "Moving from PG-13 to R could result in a <span className="text-director-red font-black">25-30% loss</span> in domestic opening weekend revenue."
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white cinematic-border p-6 cinematic-glow">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-film-black mb-4">Benchmark Target</h3>
            <select className="w-full bg-slate-50 border border-slate-200 text-[10px] font-black uppercase tracking-widest px-4 py-3 text-film-black focus:outline-none focus:border-cinema-gold cursor-pointer">
              <option>The Batman (2022)</option>
              <option>Oppenheimer (2023)</option>
              <option>Dune: Part Two (2024)</option>
              <option>Deadpool & Wolverine (2024)</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};
