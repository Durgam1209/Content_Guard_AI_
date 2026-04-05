import React, { useState } from 'react';
import { ContentTrigger } from '../types';
import { AlertTriangle, Eye, Volume2, Skull, Zap, CheckSquare, Square, Download, Scissors } from 'lucide-react';

interface TriggerListProps {
  triggers: ContentTrigger[];
  onSelect: (trigger: ContentTrigger) => void;
}

const getIcon = (type: string) => {
  switch (type) {
    case 'Violence': return <Skull className="w-4 h-4 text-rose-500" />;
    case 'Sexual': return <Eye className="w-4 h-4 text-pink-500" />;
    case 'Profanity': return <Volume2 className="w-4 h-4 text-orange-500" />;
    case 'Substance': return <Zap className="w-4 h-4 text-yellow-500" />;
    default: return <AlertTriangle className="w-4 h-4 text-slate-400" />;
  }
};

const getSeverityStyles = (severity: string) => {
  switch (severity) {
    case 'High': return 'bg-rose-100 text-rose-700 border-rose-200';
    case 'Medium': return 'bg-amber-100 text-amber-700 border-amber-200';
    case 'Low': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    default: return 'bg-slate-100 text-slate-700 border-slate-200';
  }
};

export const TriggerList: React.FC<TriggerListProps> = ({ triggers, onSelect }) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const toggleAll = () => {
    if (selectedIds.size === triggers.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(triggers.map(t => t.id)));
  };

  if (triggers.length === 0) {
    return (
        <div className="text-center p-12 text-slate-400 font-serif italic">
            No specific triggers detected in this screening.
        </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
        <button 
          onClick={toggleAll}
          className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-film-black transition-colors"
        >
          {selectedIds.size === triggers.length ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
          {selectedIds.size === triggers.length ? 'Deselect All' : 'Select All'}
        </button>
        
        <div className="flex gap-3">
          <button 
            disabled={selectedIds.size === 0}
            className="flex items-center gap-2 px-3 py-1.5 bg-film-black text-white text-[9px] font-black uppercase tracking-widest disabled:opacity-30 disabled:cursor-not-allowed hover:bg-director-red transition-colors"
          >
            <Scissors className="w-3 h-3" /> Apply Cuts
          </button>
          <button 
            disabled={selectedIds.size === 0}
            className="flex items-center gap-2 px-3 py-1.5 border border-slate-200 text-film-black text-[9px] font-black uppercase tracking-widest disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
          >
            <Download className="w-3 h-3" /> Export
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {triggers.map((trigger) => (
          <div 
              key={trigger.id} 
              onClick={() => onSelect(trigger)}
              className={`flex items-center justify-between p-4 transition-all duration-300 group relative border ${selectedIds.has(trigger.id) ? 'bg-slate-50 border-cinema-gold' : 'bg-white border-slate-100 hover:border-slate-300'}`}
          >
            <div className="flex items-center gap-4">
              <button 
                onClick={(e) => toggleSelect(trigger.id, e)}
                className={`transition-colors ${selectedIds.has(trigger.id) ? 'text-cinema-gold' : 'text-slate-200 group-hover:text-slate-400'}`}
              >
                {selectedIds.has(trigger.id) ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
              </button>
              
              <div className="p-3 bg-slate-50 border border-slate-100 shadow-sm group-hover:scale-110 transition-transform">
                  {getIcon(trigger.type)}
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-xs font-black uppercase tracking-widest text-film-black">{trigger.type}</p>
                  <span className={`text-[8px] font-black px-1.5 py-0.5 border uppercase tracking-widest ${getSeverityStyles(trigger.severity)}`}>
                    {trigger.severity}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">
                  TC: {new Date(trigger.timestamp * 1000).toISOString().substr(14, 5)}
                </p>
              </div>
            </div>
            
            <div className="text-right">
               <div className="text-[10px] font-black text-film-black mb-1">{Math.round(trigger.confidence * 100)}%</div>
               <div className="w-16 h-1 bg-slate-100 overflow-hidden">
                  <div 
                    className={`h-full ${trigger.confidence > 0.8 ? 'bg-emerald-500' : 'bg-cinema-gold'}`}
                    style={{ width: `${trigger.confidence * 100}%` }}
                  />
               </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
