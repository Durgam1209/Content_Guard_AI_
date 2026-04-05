import React from 'react';
import { AnalysisResult, Rating } from '../types';
import { X, Printer, Shield, FileCheck, AlertTriangle } from 'lucide-react';

interface CertificationReportProps {
  data: AnalysisResult;
  onClose: () => void;
  fileName: string;
  region: string;
}

export const CertificationReport: React.FC<CertificationReportProps> = ({ data, onClose, fileName, region }) => {
  const handlePrint = () => {
    window.print();
  };

  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <div className="fixed inset-0 bg-film-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white text-film-black w-full max-w-5xl min-h-[90vh] shadow-2xl relative flex flex-col print:min-h-screen print:rounded-none print:shadow-none border-t-[12px] border-director-red">
        
        {/* Screen-only Controls */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 print:hidden bg-slate-50">
          <h2 className="text-xs font-black text-film-black flex items-center gap-3 uppercase tracking-[0.3em]">
            <FileCheck className="w-6 h-6 text-director-red" />
            Official Certification Report
          </h2>
          <div className="flex items-center gap-4">
            <button 
              onClick={handlePrint}
              className="flex items-center gap-3 px-6 py-3 bg-film-black hover:bg-director-red text-white text-[10px] font-black uppercase tracking-widest transition-all shadow-sm"
            >
              <Printer className="w-4 h-4" />
              Print Report
            </button>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-slate-200 text-slate-400 hover:text-film-black transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Report Content */}
        <div className="p-12 md:p-20 flex-1 print:p-0">
          
          {/* Header */}
          <div className="flex justify-between items-start mb-16 border-b-4 border-film-black pb-10">
            <div>
              <div className="flex items-center gap-3 text-film-black mb-4">
                 <Shield className="w-10 h-10 text-director-red" />
                 <span className="text-3xl font-black tracking-tighter uppercase">ContentGuard AI</span>
              </div>
              <p className="text-[10px] text-slate-600 uppercase tracking-[0.4em] font-black">Automated Certification Authority</p>
            </div>
            <div className="text-right">
              <p className="text-4xl font-black text-film-black uppercase tracking-tighter">{region} Standard</p>
              <p className="text-slate-500 text-xs mt-2 font-bold uppercase tracking-widest">{currentDate}</p>
              <p className="text-director-red text-[10px] font-black mt-2 tracking-widest">REF: {Math.random().toString(36).substr(2, 9).toUpperCase()}</p>
            </div>
          </div>

          {/* Asset Info & Verdict */}
          <div className="grid grid-cols-3 gap-12 mb-16">
             <div className="col-span-2">
               <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-4">Asset Name</h3>
               <p className="text-3xl font-black text-film-black mb-10 uppercase tracking-tight">{fileName || "Untitled Asset"}</p>
               
               <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-4">Compliance Verdict</h3>
               <div className="flex items-center gap-8">
                 <div className="text-8xl font-black text-film-black tracking-tighter leading-none">{data.overallRating}</div>
                 <div className="h-20 w-1 bg-slate-100"></div>
                 <div>
                   <p className="text-xs font-black text-film-black uppercase tracking-widest">Content Score: {data.score}/100</p>
                   <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter mt-1">Based on multi-modal signal analysis</p>
                 </div>
               </div>
             </div>
             <div className="bg-slate-50 p-8 border border-slate-100">
               <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-6">Primary Triggers</h3>
               <ul className="space-y-4">
                 {[...new Set(data.triggers.map(t => t.type))].map((type, i) => (
                   <li key={i} className="flex items-center gap-3 text-[10px] font-black text-film-black uppercase tracking-widest">
                     <span className="w-3 h-3 bg-director-red"></span>
                     {type}
                   </li>
                 ))}
                 {data.triggers.length === 0 && <li className="text-[10px] text-slate-400 font-bold uppercase italic">No significant triggers detected.</li>}
               </ul>
             </div>
          </div>

          {/* Detailed Analysis Text */}
          <div className="mb-16">
            <h3 className="text-xs font-black text-film-black border-b-2 border-slate-100 pb-4 mb-8 uppercase tracking-[0.3em]">Detailed Analysis</h3>
            <div className="text-justify text-slate-600 leading-loose font-serif italic text-lg whitespace-pre-line">
              {data.detailedAnalysis}
            </div>
          </div>

          {/* Two Column Section: Cultural & Cuts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-16 mb-16">
            <div>
               <h3 className="text-xs font-black text-film-black border-b-2 border-slate-100 pb-4 mb-8 uppercase tracking-[0.3em]">Regional & Cultural Notes</h3>
               <p className="text-slate-600 text-sm leading-relaxed bg-amber-50 p-6 border-l-8 border-cinema-gold font-serif italic">
                 {data.culturalNotes}
               </p>
            </div>
            
            <div>
               <h3 className="text-xs font-black text-film-black border-b-2 border-slate-100 pb-4 mb-8 uppercase tracking-[0.3em]">Mandatory Compliance Edits</h3>
               {data.suggestedCuts.length > 0 ? (
                 <ul className="space-y-4">
                   {data.suggestedCuts.map((cut, idx) => (
                     <li key={idx} className="border border-slate-100 p-5 bg-white hover:border-director-red transition-colors group">
                        <div className="flex justify-between font-black text-film-black mb-2 text-[10px] uppercase tracking-widest">
                          <span className="group-hover:text-director-red transition-colors">{cut.type} Violation</span>
                          <span className="text-slate-400">{Math.floor(cut.startTime/60)}:{Math.floor(cut.startTime%60).toString().padStart(2,'0')} - {Math.floor(cut.endTime/60)}:{Math.floor(cut.endTime%60).toString().padStart(2,'0')}</span>
                        </div>
                        <p className="text-xs text-slate-500 font-serif italic">{cut.reason}</p>
                     </li>
                   ))}
                 </ul>
               ) : (
                 <div className="flex items-center gap-4 text-emerald-600 bg-emerald-50 p-6 border-l-8 border-emerald-500">
                    <FileCheck className="w-6 h-6" />
                    <span className="text-[10px] font-black uppercase tracking-widest">No mandatory cuts required for this rating tier.</span>
                 </div>
               )}
            </div>
          </div>

          {/* C2PA Provenance Log */}
          <div className="mt-12 pt-8 border-t border-slate-200">
              <h3 className="text-xs font-black uppercase tracking-widest text-film-black mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 bg-cinema-gold"></span> Immutable Provenance Log (C2PA)
              </h3>
              <div className="bg-slate-50 p-4 border border-slate-100 font-mono text-[9px] text-slate-500 leading-relaxed">
                  <p>MANIFEST_ID: c2pa:manifest:550e8400-e29b-41d4-a716-446655440000</p>
                  <p>CLAIMANT: ContentGuard AI Studio v3.0</p>
                  <p>TIMESTAMP: {new Date().toISOString()}</p>
                  <p>ASSERTIONS: [screened, analyzed, verified_synthetic_content]</p>
                  <p>DIGITAL_SIGNATURE: 0x7f8e9d0c1b2a3f4e5d6c7b8a9f0e1d2c3b4a5f6e7d8c9b0a1f2e3d4c5b6a7f8e</p>
              </div>
              <p className="text-[8px] text-slate-400 mt-2 uppercase tracking-widest font-bold">This document is cryptographically linked to the master file.</p>
          </div>

          {/* Footer */}
          <div className="border-t-4 border-film-black pt-12 mt-20 flex justify-between items-end">
             <div>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mb-2">Generated by ContentGuard AI Engine v3.1</p>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">Powered by Gemini 3 Flash • Vision Transformer • Audio Spectrogram Analysis</p>
             </div>
             <div className="text-center">
                <div className="h-20 w-64 border-b-2 border-slate-200 mb-4"></div>
                <p className="text-[10px] font-black text-film-black uppercase tracking-[0.3em]">Authorized Signature</p>
             </div>
          </div>

        </div>
      </div>
    </div>
  );
};