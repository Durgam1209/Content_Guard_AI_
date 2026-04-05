import React from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceArea } from 'recharts';
import { TimelinePoint, ContentTrigger, SuggestedCut } from '../types';

interface TimelineProps {
  data: TimelinePoint[];
  currentTime: number;
  onSeek: (time: number) => void;
  triggers?: ContentTrigger[];
  cuts?: SuggestedCut[];
}

export const Timeline: React.FC<TimelineProps> = ({ data, currentTime, onSeek, triggers = [], cuts = [] }) => {

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const time = Number(label);
      const point = payload[0].payload as TimelinePoint;
      
      // Match cuts that cover this timestamp (inclusive)
      const matchedCuts = cuts.filter(c => time >= c.startTime && time <= c.endTime);
      
      // Match triggers close to this timestamp (within +/- 5 seconds for hit testing)
      const matchedTriggers = triggers.filter(t => Math.abs(t.timestamp - time) <= 5);

      return (
        <div className="bg-white/95 backdrop-blur-xl border border-slate-200 p-0 shadow-2xl text-xs z-50 max-w-[300px] overflow-hidden cinematic-glow">
          {point.thumbnail && (
            <div className="w-full aspect-video bg-slate-100 relative">
              <img src={point.thumbnail} alt="Frame Preview" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-film-black/60 to-transparent"></div>
              <div className="absolute bottom-2 left-3 text-[10px] font-black text-white uppercase tracking-widest">Frame Preview</div>
            </div>
          )}
          
          <div className="p-4">
            <p className="font-black uppercase tracking-widest text-slate-500 mb-3 border-b border-slate-100 pb-2 flex justify-between items-center">
              <span>Timecode</span>
              <span className="text-film-black">{new Date(time * 1000).toISOString().substr(14, 5)}</span>
            </p>
            
            <div className="flex justify-between items-center mb-3">
              <span className="text-film-black font-black uppercase tracking-tighter">Signal Intensity</span>
              <span className={`font-black ${payload[0].value > 70 ? 'text-director-red' : 'text-film-black'}`}>
                {Math.round(payload[0].value)}/100
              </span>
            </div>
            
            {matchedCuts.length > 0 && (
              <div className="mt-4 bg-rose-50 border-l-4 border-director-red p-3">
                <p className="text-director-red font-black mb-2 flex items-center gap-2 uppercase text-[10px] tracking-[0.2em]">
                  <span className="text-lg leading-none">✂️</span> Suggested Cut
                </p>
                {matchedCuts.map((cut, i) => (
                  <div key={cut.id} className="mb-2 last:mb-0">
                    <span className="text-film-black font-black block text-[10px] uppercase tracking-widest">{cut.type} Violation</span>
                    <span className="text-slate-500 block leading-tight mt-1 italic font-serif">{cut.reason}</span>
                  </div>
                ))}
              </div>
            )}

            {matchedTriggers.length > 0 && (
              <div className="mt-4 bg-amber-50 border-l-4 border-cinema-gold p-3">
                 <p className="text-cinema-gold font-black mb-2 flex items-center gap-2 uppercase text-[10px] tracking-[0.2em]">
                  <span className="text-lg leading-none">⚠️</span> Detected Trigger
                </p>
                 {matchedTriggers.map((t, i) => (
                   <div key={t.id} className="flex items-start gap-2 mb-2 last:mb-0">
                      <span className="mt-1 w-2 h-2 bg-cinema-gold flex-shrink-0"></span>
                      <div>
                          <span className="text-film-black block font-black uppercase tracking-tighter text-[10px]">{t.type}</span>
                          <span className="text-slate-500 block italic font-serif leading-tight">{t.description || "Detected event"}</span>
                      </div>
                   </div>
                 ))}
              </div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  const categories = [
    { key: 'violence', label: 'Violence', color: 'bg-rose-500' },
    { key: 'profanity', label: 'Profanity', color: 'bg-purple-500' },
    { key: 'substance', label: 'Substance', color: 'bg-orange-500' },
    { key: 'sexual', label: 'Sexual', color: 'bg-pink-500' },
    { key: 'theme', label: 'Theme', color: 'bg-blue-500' },
    { key: 'dread', label: 'Dread', color: 'bg-slate-900' },
    { key: 'tension', label: 'Tension', color: 'bg-amber-900' },
  ];

  return (
    <div className="w-full bg-white p-0 space-y-4">
      <div className="flex justify-between items-start">
        <div>
           <h3 className="text-xs font-black uppercase tracking-[0.3em] text-film-black flex items-center gap-2">
             Signal Intensity & Event Log
           </h3>
           <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-widest font-bold">Temporal analysis of cinematic risks</p>
        </div>
        <div className="flex gap-6 text-[9px] font-black uppercase tracking-widest bg-slate-50 p-3 border border-slate-100">
           <div className="flex items-center gap-2">
             <div className="w-3 h-3 bg-director-red/20 border border-director-red"></div>
             <span className="text-film-black">Cut Region</span>
           </div>
           <div className="flex items-center gap-2">
             <div className="w-4 h-0 border-t-2 border-dashed border-cinema-gold"></div>
             <span className="text-film-black">Trigger Point</span>
           </div>
        </div>
      </div>
      
      <div className="w-full h-40">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart 
            data={data}
            onClick={(e: any) => {
              if (e && e.activeLabel) {
                onSeek(Number(e.activeLabel));
              }
            }}
            margin={{ top: 5, right: 0, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="colorIntensity" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#0A0A0A" stopOpacity={0.1}/>
                <stop offset="95%" stopColor="#0A0A0A" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <XAxis 
                dataKey="time" 
                type="number"
                domain={['dataMin', 'dataMax']}
                tickFormatter={(val) => new Date(val * 1000).toISOString().substr(14, 5)} 
                stroke="#cbd5e1"
                tick={{fontSize: 9, fill: '#94a3b8', fontWeight: 'bold'}}
                axisLine={false}
                tickLine={false}
                minTickGap={40}
            />
            <YAxis hide domain={[0, 100]} />
            
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#0A0A0A', strokeWidth: 1, strokeDasharray: '4 4' }} />

            {/* Render Cuts as Highlighted Areas */}
            {cuts.map((cut) => {
                const Comp = ReferenceArea as any;
                return (
                    <Comp 
                        key={cut.id} 
                        x1={cut.startTime} 
                        x2={cut.endTime} 
                        fill="#B22222" 
                        fillOpacity={0.1}
                        strokeOpacity={0}
                        ifOverflow="visible"
                    />
                );
            })}

            {/* Render Triggers as Lines */}
            {triggers.map((trigger) => {
                const Comp = ReferenceLine as any;
                return (
                    <Comp 
                        key={trigger.id} 
                        x={trigger.timestamp} 
                        stroke="#D4AF37" 
                        strokeDasharray="4 2"
                        strokeWidth={2}
                        label={{ 
                            position: 'top', 
                            value: '⚠', 
                            fill: '#D4AF37', 
                            fontSize: 14 
                        }}
                    />
                );
            })}
            
            <Area 
                type="monotone" 
                dataKey="intensity" 
                stroke="#0A0A0A" 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#colorIntensity)" 
                animationDuration={1500}
                activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff', fill: '#B22222' }}
            />
            {(() => {
                const Comp = ReferenceLine as any;
                return <Comp x={currentTime} stroke="#B22222" strokeWidth={2} isFront />;
            })()}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Layered Category Lanes */}
      <div className="space-y-1 pt-2 border-t border-slate-100">
        {categories.map(cat => (
          <div key={cat.key} className="flex items-center gap-4">
            <div className="w-20 text-[8px] font-black uppercase tracking-widest text-slate-400 truncate">{cat.label}</div>
            <div className="flex-1 h-1.5 bg-slate-50 relative overflow-hidden">
              {data.map((point, i) => {
                const val = (point as any)[cat.key] || 0;
                if (val < 10) return null;
                return (
                  <div 
                    key={i}
                    className={`absolute top-0 bottom-0 ${cat.color} opacity-40`}
                    style={{ 
                      left: `${(i / data.length) * 100}%`, 
                      width: `${(1 / data.length) * 100}%`,
                      opacity: val / 100
                    }}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};