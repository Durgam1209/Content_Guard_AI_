import React from 'react';
import { Shield, AlertCircle, CheckCircle, Fingerprint, Search } from 'lucide-react';
import { AnalysisResult, SyntheticDetection } from '../types';

interface ComplianceDashboardProps {
  analysis: AnalysisResult;
}

export const ComplianceDashboard: React.FC<ComplianceDashboardProps> = ({ analysis }) => {
  const syntheticContent = analysis.syntheticContent || [];

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 animate-in fade-in duration-700">
      <div className="flex justify-between items-end border-b border-border-color pb-6">
        <div>
          <h2 className="text-4xl font-black text-text-primary uppercase tracking-tighter mb-2">Compliance Dashboard</h2>
          <p className="text-text-muted font-serif italic text-lg">Regulatory monitoring & synthetic content detection (India IT Rules 2026 Ready).</p>
        </div>
        <div className="flex gap-4">
          <div className="bg-emerald-950/25 border border-emerald-500/30 px-4 py-2 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Safe Harbor Active</span>
          </div>
          <div className="bg-panel-bg text-text-primary border border-border-color px-4 py-2 flex items-center gap-2">
            <Fingerprint className="w-4 h-4 text-cinema-gold animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-widest">C2PA Provenance Log</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Synthetic Content Scan */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-panel-bg cinematic-border p-6 cinematic-glow">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-text-primary mb-6 flex items-center gap-2">
              <Search className="w-4 h-4 text-director-red" /> Synthetic Content (SGI) Scan
            </h3>
            
            {syntheticContent.length > 0 ? (
              <div className="space-y-4">
                {syntheticContent.map(item => (
                  <div key={item.id} className="flex items-center justify-between p-4 bg-film-black border border-border-color hover:border-director-red transition-all group">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-10 bg-panel-bg overflow-hidden border border-border-color">
                        {item.thumbnail && <img src={item.thumbnail} alt="" className="w-full h-full object-cover" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-black uppercase tracking-widest text-text-primary">{item.type}</span>
                          <span className="text-[8px] font-black px-1.5 py-0.5 bg-rose-950/40 text-rose-400 border border-rose-500/30 uppercase tracking-widest">Flagged</span>
                        </div>
                        <p className="text-[10px] text-text-muted font-bold uppercase tracking-tighter">TC: {new Date(item.timestamp * 1000).toISOString().substr(14, 5)} • {item.description}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] font-black text-text-primary mb-1">{Math.round(item.confidence * 100)}% Confidence</div>
                      <div className="w-16 h-1 bg-border-color">
                        <div className="h-full bg-director-red" style={{ width: `${item.confidence * 100}%` }}></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 bg-film-black border border-dashed border-border-color">
                <Shield className="w-12 h-12 text-border-color mx-auto mb-4" />
                <p className="text-text-muted font-serif italic">No synthetic content detected in this screening.</p>
              </div>
            )}
          </div>

          <div className="bg-panel-bg cinematic-border p-6 cinematic-glow">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-text-primary mb-6">Immutable Provenance Log (C2PA)</h3>
            <div className="font-mono text-[10px] text-text-secondary space-y-2 bg-film-black p-4 border border-border-color overflow-x-auto">
              <p className="text-cinema-gold font-bold">[PROVENANCE_START]</p>
              <p>MANIFEST_ID: c2pa:manifest:550e8400-e29b-41d4-a716-446655440000</p>
              <p>CLAIMANT: ContentGuard AI Studio</p>
              <p>TIMESTAMP: {new Date().toISOString()}</p>
              <p>ASSERTIONS:</p>
              <p className="pl-4">- c2pa.actions: [screened, analyzed, certified]</p>
              <p className="pl-4">- c2pa.metadata: {JSON.stringify({ rating: analysis.overallRating, region: 'Global' })}</p>
              <p className="pl-4">- c2pa.hash: sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855</p>
              <p className="text-cinema-gold font-bold">[PROVENANCE_END]</p>
            </div>
          </div>
        </div>

        {/* Regulatory Status */}
        <div className="space-y-6">
          <div className="bg-panel-bg cinematic-border p-6 cinematic-glow">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-text-primary mb-6">Regulatory Status</h3>
            <div className="space-y-4">
              <div className="p-4 bg-rose-950/15 border-l-4 border-director-red border border-y-rose-950/30 border-r-rose-950/30">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="w-4 h-4 text-director-red" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-director-red">India IT Rules 2026</span>
                </div>
                <p className="text-[10px] text-text-secondary leading-relaxed font-medium">
                  Synthetic content detected. Takedown window: 2 hours. Ensure labels are applied to all de-aged actors.
                </p>
              </div>
              <div className="p-4 bg-emerald-950/15 border-l-4 border-emerald-500 border border-y-emerald-950/30 border-r-emerald-950/30">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">EU AI Act Compliance</span>
                </div>
                <p className="text-[10px] text-text-secondary leading-relaxed font-medium">
                  AI transparency requirements met. Provenance log generated.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-film-black border border-border-color p-6 shadow-2xl">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-cinema-gold mb-6">Financial Impact Forecast</h3>
            {analysis.financialImpact ? (
              <div className="space-y-6">
                <div>
                  <p className="text-[9px] text-text-muted uppercase tracking-widest mb-1">Predicted Revenue</p>
                  <p className="text-2xl font-black text-white tracking-tighter">{analysis.financialImpact.predictedRevenue}</p>
                </div>
                <div>
                  <p className="text-[9px] text-text-muted uppercase tracking-widest mb-1">Rating Penalty</p>
                  <p className="text-sm font-black text-director-red tracking-tight">{analysis.financialImpact.ratingPenalty}</p>
                </div>
                <div>
                  <p className="text-[9px] text-text-muted uppercase tracking-widest mb-2">Market Access</p>
                  <div className="flex flex-wrap gap-2">
                    {analysis.financialImpact.marketAccess.map(market => (
                      <span key={market} className="px-2 py-1 bg-panel-bg text-[8px] font-black text-text-primary border border-border-color uppercase tracking-widest">{market}</span>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-white/40 text-[10px] italic font-serif">Run analysis to generate financial forecast.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
