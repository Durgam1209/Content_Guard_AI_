import React from 'react';
import { Scissors, Play, AlertOctagon } from 'lucide-react';
import { SuggestedCut } from '../types';

interface CutsListProps {
  cuts: SuggestedCut[];
  onSeek: (time: number) => void;
}

export const CutsList: React.FC<CutsListProps> = ({ cuts, onSeek }) => {
  if (!cuts || cuts.length === 0) {
    return null;
  }

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-panel-bg border border-border-color p-8 shadow-sm cinematic-glow">
       <div className="flex items-center justify-between mb-8 border-b border-border-color pb-6">
         <h3 className="text-xs font-black flex items-center gap-3 text-director-red uppercase tracking-[0.3em]">
            <Scissors className="w-5 h-5" />
            Suggested Director Cuts
         </h3>
         <span className="text-[10px] font-black bg-director-red text-white px-3 py-1 uppercase tracking-widest">
            {cuts.length} Sequences
         </span>
       </div>
       
       <div className="space-y-4 max-h-[500px] overflow-y-auto pr-4 custom-scrollbar">
         {cuts.map((cut) => (
            <div key={cut.id} className="bg-film-black border-l-4 border-director-red border-y border-r border-border-color p-5 group hover:bg-panel-bg hover:shadow-md transition-all duration-300">
               <div className="flex items-start gap-4">
                   <div className="mt-1 p-2 bg-panel-bg border border-border-color text-director-red group-hover:scale-110 transition-transform">
                     <AlertOctagon className="w-5 h-5" />
                   </div>
                   <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-2 gap-4">
                         <span className="text-xs font-black text-text-primary uppercase tracking-widest truncate">{cut.type} Violation</span>
                         <button 
                           onClick={() => onSeek(cut.startTime)}
                           className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest bg-panel-bg border border-border-color hover:bg-director-red text-white px-3 py-1.5 transition-all cursor-pointer"
                         >
                           <Play className="w-3 h-3 fill-current" />
                           {formatTime(cut.startTime)} - {formatTime(cut.endTime)}
                         </button>
                      </div>
                      <p className="text-xs text-text-muted leading-relaxed font-serif italic group-hover:text-text-primary transition-colors">
                        {cut.reason}
                      </p>
                   </div>
               </div>
            </div>
         ))}
       </div>
    </div>
  );
};
