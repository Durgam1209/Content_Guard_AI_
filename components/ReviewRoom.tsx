import React, { useState } from 'react';
import { Users, MessageSquare, CheckCircle, XCircle, Send, Play, Pause, SkipForward, SkipBack } from 'lucide-react';
import { AnalysisResult, ContentTrigger } from '../types';

interface ReviewRoomProps {
  analysis: AnalysisResult;
  onOverride: (triggerId: string, decision: 'Approve' | 'Reject') => void;
}

export const ReviewRoom: React.FC<ReviewRoomProps> = ({ analysis, onOverride }) => {
  const [comments, setComments] = useState<{ id: string; user: string; text: string; timestamp: string }[]>([
    { id: '1', user: 'Board Member A', text: 'The violence at 01:24 seems excessive for a 12A rating.', timestamp: '10:05 AM' },
    { id: '2', user: 'AI Assistant', text: 'Based on BBFC context, aggressive intent detected in audio sentiment.', timestamp: '10:06 AM' },
  ]);
  const [newComment, setNewComment] = useState('');

  const addComment = () => {
    if (!newComment.trim()) return;
    setComments([...comments, { id: Date.now().toString(), user: 'You (Board Member)', text: newComment, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
    setNewComment('');
  };

  return (
    <div className="p-8 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-8 animate-in fade-in duration-700">
      {/* Video Player & Timeline (Main) */}
      <div className="lg:col-span-3 space-y-8">
        <div className="bg-film-black aspect-video relative group border-4 border-film-black shadow-2xl">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-white text-center">
              <Play className="w-16 h-16 mx-auto mb-4 opacity-50 group-hover:opacity-100 transition-opacity cursor-pointer" />
              <p className="text-[10px] font-black uppercase tracking-widest opacity-50">Live Collaborative Screening</p>
            </div>
          </div>
          <div className="absolute bottom-4 left-4 right-4 flex items-center gap-4">
            <div className="flex gap-2">
              <button className="p-2 bg-white/10 hover:bg-white/20 text-white transition-colors"><SkipBack className="w-4 h-4" /></button>
              <button className="p-2 bg-white/10 hover:bg-white/20 text-white transition-colors"><Pause className="w-4 h-4" /></button>
              <button className="p-2 bg-white/10 hover:bg-white/20 text-white transition-colors"><SkipForward className="w-4 h-4" /></button>
            </div>
            <div className="flex-1 h-1 bg-white/20 relative">
              <div className="absolute top-0 left-0 bottom-0 w-1/3 bg-director-red"></div>
            </div>
            <span className="text-[10px] font-black text-white uppercase tracking-widest">01:24 / 04:12</span>
          </div>
        </div>

        <div className="bg-white cinematic-border p-6 cinematic-glow">
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-film-black mb-6 flex items-center gap-2">
            <Users className="w-4 h-4 text-director-red" /> Collaborative Review Board
          </h3>
          <div className="space-y-4">
            {analysis.triggers.map(trigger => (
              <div key={trigger.id} className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 hover:border-cinema-gold transition-all">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-8 bg-slate-200 border border-slate-300 overflow-hidden">
                    {trigger.thumbnail && <img src={trigger.thumbnail} alt="" className="w-full h-full object-cover" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-black uppercase tracking-widest text-film-black">{trigger.type}</span>
                      <span className="text-[8px] font-black px-1.5 py-0.5 bg-amber-100 text-amber-700 border border-amber-200 uppercase tracking-widest">AI Suggestion</span>
                    </div>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">TC: {new Date(trigger.timestamp * 1000).toISOString().substr(14, 5)} • {trigger.description}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => onOverride(trigger.id, 'Approve')}
                    className="p-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200 transition-colors"
                    title="Approve AI Decision"
                  >
                    <CheckCircle className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => onOverride(trigger.id, 'Reject')}
                    className="p-2 bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 transition-colors"
                    title="Override AI Decision"
                  >
                    <XCircle className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Chat & Collaboration (Sidebar) */}
      <div className="bg-white cinematic-border flex flex-col h-[calc(100vh-160px)] cinematic-glow overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-film-black">Live Discussion</h3>
          <div className="flex -space-x-2">
            {[1,2,3].map(i => (
              <div key={i} className="w-6 h-6 rounded-full bg-slate-200 border-2 border-white flex items-center justify-center text-[8px] font-black">{String.fromCharCode(64 + i)}</div>
            ))}
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {comments.map(comment => (
            <div key={comment.id} className="space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black uppercase tracking-widest text-film-black">{comment.user}</span>
                <span className="text-[8px] text-slate-400 font-bold">{comment.timestamp}</span>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed font-medium bg-slate-50 p-3 border border-slate-100 italic">
                "{comment.text}"
              </p>
            </div>
          ))}
        </div>

        <div className="p-6 border-t border-slate-100">
          <div className="flex gap-2">
            <input 
              type="text" 
              placeholder="Add a comment..." 
              className="flex-1 bg-slate-50 border border-slate-200 px-4 py-2 text-xs focus:outline-none focus:border-cinema-gold"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addComment()}
            />
            <button 
              onClick={addComment}
              className="p-2 bg-film-black text-white hover:bg-director-red transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[8px] text-slate-400 mt-2 uppercase tracking-widest font-black text-center">AI learns from human overrides (RLHF)</p>
        </div>
      </div>
    </div>
  );
};
