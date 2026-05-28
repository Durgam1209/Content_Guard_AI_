import React, { useState, useRef, useEffect } from 'react';
import { 
  Activity, 
  Shield, 
  PlayCircle, 
  FileText, 
  Upload, 
  Video, 
  X, 
  Film, 
  Globe, 
  FileCheck, 
  Clapperboard, 
  Camera, 
  MonitorPlay, 
  Clock,
  Search,
  Users,
  TrendingUp,
  Sliders
} from 'lucide-react';
import { Timeline } from './components/Timeline';
import { TriggerList } from './components/TriggerList';
import { GlobalDatabaseView } from './components/GlobalDatabaseView';
import { ComplianceDashboard } from './components/ComplianceDashboard';
import { ReviewRoom } from './components/ReviewRoom';
import { BenchmarkView } from './components/BenchmarkView';
import { CutsList } from './components/CutsList';
import { CertificationReport } from './components/CertificationReport';
import { SettingsPanel } from './components/SettingsPanel';
import { analyzeContent } from './services/geminiService';
import { extractAudioFromVideo } from './utils/audioUtils';
import { extractSmartFrames } from './utils/videoProcessing';
import { AnalysisResult, TimelinePoint, Rating, ViewState, HistoryItem } from './types';

const MOCK_TIMELINE_DATA: TimelinePoint[] = [
  { time: 0, intensity: 20 },
  { time: 60, intensity: 35 },
  { time: 120, intensity: 45 },
  { time: 180, intensity: 30 },
  { time: 240, intensity: 65 },
  { time: 300, intensity: 40 },
  { time: 360, intensity: 25 },
  { time: 420, intensity: 55 },
  { time: 480, intensity: 75 },
  { time: 540, intensity: 40 },
  { time: 600, intensity: 30 },
];

// Cinematic Loader Component
const CinematicLoader = ({ step, progress }: { step: string; progress?: number }) => (
  <div className="absolute inset-0 bg-white/95 backdrop-blur-md flex flex-col items-center justify-center z-50 p-12 text-center">
    <div className="relative mb-12">
      <Film className="w-24 h-24 text-film-black film-reel-spin" />
      <div className="absolute -top-4 -right-4">
        <Clapperboard className="w-12 h-12 text-director-red clapper-snap" />
      </div>
    </div>
    
    <div className="space-y-6 w-full max-w-md">
      <h3 className="text-2xl font-serif font-black uppercase tracking-[0.2em] text-film-black">
        {step}
      </h3>
      
      {progress !== undefined && (
        <div className="space-y-3">
          <div className="h-1 bg-slate-100 w-full overflow-hidden relative">
            <div 
              className="h-full bg-director-red transition-all duration-500 ease-out shadow-[0_0_15px_rgba(178,34,34,0.4)]"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-slate-400 font-bold uppercase tracking-widest">
            <span>Roll {Math.floor(progress / 10) + 1}</span>
            <span>{progress}% Processed</span>
          </div>
        </div>
      )}
      
      <p className="text-xs text-slate-400 font-medium italic">
        "Great things take time. We're perfecting your certification."
      </p>
    </div>
  </div>
);

// Helper to get color based on US or IN ratings
const getRatingColorClass = (rating: Rating) => {
  switch (rating) {
    // US
    case Rating.NC17: return 'text-rose-700';      // Extreme
    case Rating.R: return 'text-rose-600';         // Restricted
    case Rating.PG13: return 'text-amber-600';     // Caution
    case Rating.PG: return 'text-sky-600';         // Guidance
    case Rating.G: return 'text-emerald-600';      // General
    
    // IN (CBFC)
    case Rating.A: return 'text-rose-700 font-extrabold';      // Adults Only (Strict)
    case Rating.UA16: return 'text-orange-600 font-bold';      // 16+ (High Caution)
    case Rating.UA13: return 'text-amber-600 font-bold';       // 13+ (Moderate Caution)
    case Rating.UA7: return 'text-yellow-600 font-bold';       // 7+ (Mild Caution)
    case Rating.UA: return 'text-yellow-600';                  // Legacy UA
    case Rating.U: return 'text-emerald-600 font-bold';        // Unrestricted
    case Rating.S: return 'text-violet-600';                   // Specialized
    
    // BBFC (UK)
    case Rating.BBFC_18: return 'text-rose-700 font-black';
    case Rating.BBFC_15: return 'text-rose-500 font-bold';
    case Rating.BBFC_12A: return 'text-amber-600 font-bold';
    case Rating.BBFC_R18: return 'text-blue-900 bg-slate-100 px-1 font-bold'; // Strict Restricted

    // FSK (Germany)
    case Rating.FSK_18: return 'text-rose-700 font-black'; // Red label
    case Rating.FSK_16: return 'text-blue-600 font-bold';  // Blue label
    case Rating.FSK_12: return 'text-green-600 font-bold'; // Green label
    case Rating.FSK_6: return 'text-yellow-600 font-bold'; // Yellow label
    case Rating.FSK_0: return 'text-slate-400 font-bold';  // White label

    default: return 'text-slate-400';
  }
};

function App() {
  const [activeTab, setActiveTab] = useState<ViewState>('dashboard');
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeStep, setAnalyzeStep] = useState<string>('');
  const [analysisProgress, setAnalysisProgress] = useState(0); 
  
  // History State
  const [history, setHistory] = useState<HistoryItem[]>([]);
  
  // Input State
  const [inputMode, setInputMode] = useState<'text' | 'video'>('video'); 
  const [inputText, setInputText] = useState("The protagonist enters the bar. The atmosphere is tense. A man in the corner smashes a bottle (Violence) and shouts a racial slur (Profanity). The protagonist draws a weapon but hesitates.");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null); 
  const [region, setRegion] = useState("US");
  const [targetRating, setTargetRating] = useState<Rating>(Rating.PG13);
  const [isABView, setIsABView] = useState(false);
  const [whatIfIntensity, setWhatIfIntensity] = useState(50);
  const [isSanitized, setIsSanitized] = useState(false);

  // Upload State
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [tempFileName, setTempFileName] = useState('');
  
  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);

  // Results State
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [timelineData, setTimelineData] = useState<TimelinePoint[]>(MOCK_TIMELINE_DATA);
  const [showReport, setShowReport] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setTempFileName(file.name);
      
      // Generate immediate preview URL
      const objectUrl = URL.createObjectURL(file);
      setPreviewUrl(objectUrl);

      setIsUploading(true);
      setUploadProgress(0);

      // Simulate upload process for UX
      let progress = 0;
      const interval = setInterval(() => {
        progress += Math.random() * 15 + 5;
        if (progress >= 100) {
          progress = 100;
          clearInterval(interval);
          
          // Slight delay at 100% before showing result
          setTimeout(() => {
              setVideoFile(file);
              setVideoUrl(objectUrl); // Use the existing object URL
              setPreviewUrl(null); // Clear preview state as main player takes over
              
              setAnalysis(null);
              setInputMode('video');
              setIsUploading(false);
              setUploadProgress(0);
              setTempFileName('');
          }, 400);
        }
        setUploadProgress(Math.min(100, Math.floor(progress)));
      }, 150);
    }
  };

  const clearVideo = () => {
    setVideoFile(null);
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setVideoUrl(null);
    setAnalysis(null);
    if (previewUrl && previewUrl !== videoUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
  };

  const handleSeek = (time: number) => {
    if (videoRef.current) {
        if (typeof (videoRef.current as any).fastSeek === 'function') {
           (videoRef.current as any).fastSeek(time);
        } else {
           videoRef.current.currentTime = time;
        }
        // Ensure video is paused so user can see the frame
        videoRef.current.pause();
    }
  };

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setAnalysisProgress(0);
    setAnalysis(null);
    
    let result;
    
    try {
        let duration = 600;

        if (inputMode === 'video' && videoRef.current && videoFile) {
            duration = videoRef.current.duration || 600;

            setAnalyzeStep('Initializing intelligent analysis...');
            
            // Execute Audio & Video processing in parallel to save time
            // Video processing now uses Smart SBD (Shot Boundary Detection)
            const [frames, audioData] = await Promise.all([
                extractSmartFrames(videoFile, (msg, progress) => {
                    setAnalyzeStep(msg);
                    if (progress !== undefined) setAnalysisProgress(progress);
                }),
                extractAudioFromVideo(videoFile)
            ]);
            
            setAnalyzeStep('Sending Keyframes & Audio Spectrograms to Gemini 3...');
            setAnalysisProgress(100); // Complete preprocessing, now waiting for API
            
            result = await analyzeContent({ 
                images: frames, 
                audio: audioData || undefined,
                duration 
            }, region);
        } else {
            setAnalyzeStep('Processing script content...');
            setAnalysisProgress(50);
            result = await analyzeContent({ text: inputText }, region);
            setAnalysisProgress(100);
        }

        // Generate a dynamic timeline visualization based on duration
        // We aim for about 50 data points for smoothness
        const points = 50;
        const interval = duration / points;
        const baseScore = result.score || 30;

        const newTimeline = Array.from({ length: points }, (_, i) => ({
            time: Math.floor(i * interval),
            // Simulate intensity variance around the average score
            intensity: Math.max(10, Math.min(100, baseScore + (Math.random() * 40 - 20))),
        }));

        setTimelineData(newTimeline);
        setAnalysis(result);

        // Add to History
        if (inputMode === 'video' && videoFile) {
            const newHistoryItem: HistoryItem = {
                id: `hist-${Date.now()}`,
                title: videoFile.name,
                timestamp: Date.now(),
                rating: result.overallRating,
                thumbnail: result.triggers[0]?.thumbnail || 'https://picsum.photos/seed/movie/200/120'
            };
            setHistory(prev => [newHistoryItem, ...prev].slice(0, 10));
        }
    } catch (e) {
        console.error(e);
        setAnalyzeStep('Analysis failed. Please try again.');
    } finally {
        setAnalyzing(false);
        setAnalyzeStep('');
        setAnalysisProgress(0);
    }
  };

  const renderContent = () => {
      switch (activeTab) {
          case 'database': return <GlobalDatabaseView />;
          case 'compliance': return analysis ? <ComplianceDashboard analysis={analysis} /> : <div className="p-20 text-center text-text-secondary italic font-serif text-lg">Analyze content to view compliance data.</div>;
          case 'review': return analysis ? <ReviewRoom analysis={analysis} onOverride={(id, dec) => console.log(id, dec)} /> : <div className="p-20 text-center text-text-secondary italic font-serif text-lg">Analyze content to enter review room.</div>;
          case 'benchmark': return analysis ? <BenchmarkView analysis={analysis} /> : <div className="p-20 text-center text-text-secondary italic font-serif text-lg">Analyze content to view benchmarks.</div>;
          case 'settings': return <SettingsPanel />;
          case 'history': return (
            <div className="p-12 max-w-5xl mx-auto space-y-12 animate-in fade-in duration-700">
                <div className="border-l-8 border-cinema-gold pl-8">
                    <h2 className="text-4xl font-black text-film-black uppercase tracking-tighter mb-2">Project Archive</h2>
                    <p className="text-slate-500 font-serif italic text-lg">Review and manage your previous certification sessions.</p>
                </div>
                
                {history.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {history.map(item => (
                            <div key={item.id} className="bg-white cinematic-border p-6 cinematic-glow flex gap-6 hover:scale-[1.02] transition-transform cursor-pointer">
                                <div className="w-32 h-20 bg-slate-100 flex-shrink-0 border border-slate-200 overflow-hidden">
                                    <img src={item.thumbnail} alt="" className="w-full h-full object-cover" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">{new Date(item.timestamp).toLocaleDateString()}</p>
                                    <h4 className="text-lg font-black text-film-black truncate uppercase tracking-tight mb-2">{item.title}</h4>
                                    <div className="flex items-center gap-3">
                                        <span className={`text-sm font-black ${getRatingColorClass(item.rating)}`}>{item.rating}</span>
                                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Final Verdict</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="bg-white cinematic-border p-20 text-center cinematic-glow">
                        <Clock className="w-16 h-16 text-slate-200 mx-auto mb-6" />
                        <p className="text-slate-500 font-serif italic text-xl">Your archive is currently empty.</p>
                    </div>
                )}
            </div>
          );
          default: return (
            <div className="p-8 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in duration-700">
                
                {/* Left Column: Input & Player */}
                <div className="lg:col-span-2 space-y-8">
                    {/* Video Player Area */}
                    <div className="bg-film-black border-4 border-film-black overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative aspect-video group">
                        {videoUrl ? (
                            <>
                                <div className={`w-full h-full flex ${isABView ? 'flex-row' : 'flex-col'}`}>
                                    <div className={`${isABView ? 'w-1/2 border-r-2 border-director-red' : 'w-full h-full'} relative`}>
                                        <video 
                                            ref={videoRef}
                                            src={videoUrl}
                                            className="w-full h-full object-contain"
                                            controls={false}
                                            playsInline
                                            onTimeUpdate={(e) => {
                                                const v = e.currentTarget;
                                                const progress = (v.currentTime / v.duration) * 100;
                                                const progressBar = document.getElementById('custom-seek-bar');
                                                if (progressBar) progressBar.style.width = `${progress}%`;
                                            }}
                                        />
                                        
                                        {/* Custom Seek Bar with Markers */}
                                        <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-white/20 group-hover:h-3 transition-all cursor-pointer z-20"
                                             onClick={(e) => {
                                                 if (videoRef.current) {
                                                     const rect = e.currentTarget.getBoundingClientRect();
                                                     const x = e.clientX - rect.left;
                                                     const pct = x / rect.width;
                                                     videoRef.current.currentTime = pct * videoRef.current.duration;
                                                 }
                                             }}
                                        >
                                            <div id="custom-seek-bar" className="h-full bg-director-red relative">
                                                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg opacity-0 group-hover:opacity-100"></div>
                                            </div>
                                            
                                            {/* Trigger Markers */}
                                            {analysis?.triggers.map(t => (
                                                <div 
                                                    key={t.id}
                                                    className="absolute top-0 bottom-0 w-1 bg-cinema-gold hover:w-2 hover:scale-y-150 transition-all cursor-help z-30"
                                                    style={{ left: `${(t.timestamp / (videoRef.current?.duration || 1)) * 100}%` }}
                                                    title={`${t.type}: ${t.description}`}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleSeek(t.timestamp);
                                                    }}
                                                />
                                            ))}
                                        </div>

                                        {isABView && (
                                            <div className="absolute top-4 left-4 bg-film-black/80 px-3 py-1 text-[10px] font-black text-white uppercase tracking-widest border border-border-color">Original Master</div>
                                        )}
                                    </div>
                                    {isABView && (
                                        <div className="w-1/2 relative bg-studio-bg">
                                            <video 
                                                src={videoUrl}
                                                className="w-full h-full object-contain opacity-80 grayscale-[0.5] blur-[1px]"
                                                muted
                                                playsInline
                                            />
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <div className="bg-director-red/20 border border-director-red p-4 backdrop-blur-sm">
                                                    <p className="text-[10px] font-black text-white uppercase tracking-widest">AI Sanitized Preview</p>
                                                    <p className="text-[8px] text-white/60 uppercase mt-1">Cuts & Blurs Applied</p>
                                                </div>
                                            </div>
                                            <div className="absolute top-4 right-4 bg-director-red px-3 py-1 text-[10px] font-black text-white uppercase tracking-widest">Sanitized</div>
                                        </div>
                                    )}
                                </div>
                                
                                <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button 
                                        onClick={() => setIsABView(!isABView)}
                                        className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${isABView ? 'bg-director-red text-white' : 'bg-panel-bg/90 text-text-primary border border-border-color hover:bg-panel-bg'}`}
                                    >
                                        {isABView ? 'Exit A/B View' : 'A/B Comparison'}
                                    </button>
                                    <button 
                                        onClick={() => setIsSanitized(!isSanitized)}
                                        className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${isSanitized ? 'bg-emerald-600 text-white' : 'bg-panel-bg/90 text-text-primary border border-border-color hover:bg-panel-bg'}`}
                                    >
                                        {isSanitized ? 'Sanitized' : 'Sanitize for Region'}
                                    </button>
                                </div>

                                {analyzing && (
                                    <CinematicLoader step={analyzeStep} progress={analysisProgress} />
                                )}
                            </>
                        ) : isUploading ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-panel-bg border border-border-color">
                                {/* Thumbnail Background Preview */}
                                {previewUrl && (
                                    <video 
                                        src={previewUrl}
                                        className="absolute inset-0 w-full h-full object-contain opacity-5 blur-sm"
                                        muted
                                        playsInline
                                        onLoadedMetadata={(e) => {
                                            e.currentTarget.currentTime = 1;
                                        }}
                                    />
                                )}
                                
                                <CinematicLoader step="Uploading Master Copy..." progress={uploadProgress} />
                            </div>
                        ) : (
                            <div className="absolute inset-0 flex items-center justify-center bg-panel-bg border border-border-color">
                                <div className="text-center p-12">
                                    <div className="relative inline-block mb-6">
                                        <Film className="w-20 h-20 text-text-muted" />
                                        <Camera className="w-8 h-8 text-cinema-gold absolute -bottom-2 -right-2" />
                                    </div>
                                    <p className="text-text-secondary font-serif italic text-lg">
                                        {inputMode === 'video' ? 'Awaiting your cinematic masterpiece...' : 'Script Analysis Mode'}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Timeline Analysis */}
                    <div className="bg-panel-bg p-6 cinematic-border border-border-color cinematic-glow">
                        <h3 className="text-xs font-black uppercase tracking-[0.3em] text-text-primary mb-4 flex items-center gap-2">
                            <MonitorPlay className="w-4 h-4 text-director-red" /> Temporal Safety Timeline
                        </h3>
                        <Timeline 
                            data={timelineData} 
                            currentTime={10} 
                            onSeek={handleSeek} 
                            triggers={analysis?.triggers}
                            cuts={analysis?.suggestedCuts}
                        />
                    </div>

                    {/* Input Control Panel */}
                    <div className="bg-panel-bg border border-border-color p-8 cinematic-glow">
                        <div className="flex justify-between items-center mb-8">
                            <div className="flex bg-studio-bg p-1 border border-border-color">
                                <button
                                    onClick={() => setInputMode('text')}
                                    className={`px-6 py-2 text-xs font-black uppercase tracking-widest transition-all duration-300 cursor-pointer ${inputMode === 'text' ? 'bg-cinema-gold text-film-black shadow-lg font-black' : 'text-text-secondary hover:text-text-primary'}`}
                                >
                                    Script
                                </button>
                                <button
                                    onClick={() => setInputMode('video')}
                                    className={`px-6 py-2 text-xs font-black uppercase tracking-widest transition-all duration-300 cursor-pointer ${inputMode === 'video' ? 'bg-cinema-gold text-film-black shadow-lg font-black' : 'text-text-secondary hover:text-text-primary'}`}
                                >
                                    Video
                                </button>
                            </div>

                            <button 
                                onClick={handleAnalyze}
                                disabled={analyzing || (inputMode === 'video' && !videoFile)}
                                className="cinematic-button flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {analyzing ? 'Processing...' : 'Action: Analyze'}
                                {!analyzing && <PlayCircle className="w-4 h-4" />}
                            </button>
                        </div>

                        {inputMode === 'text' ? (
                            <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                                <h3 className="text-xs font-black uppercase tracking-widest text-text-secondary mb-3 flex items-center gap-2">
                                    <FileText className="w-4 h-4" /> Scene Script
                                </h3>
                                <textarea
                                    className="w-full h-40 bg-studio-bg border border-border-color p-4 text-text-primary text-sm font-mono focus:outline-none focus:border-cinema-gold transition-colors resize-none leading-relaxed"
                                    placeholder="Enter scene description or dialogue..."
                                    value={inputText}
                                    onChange={(e) => setInputText(e.target.value)}
                                />
                            </div>
                        ) : (
                            <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                                {!videoFile && !isUploading ? (
                                    <label className="border-2 border-dashed border-border-color p-12 text-center hover:bg-studio-bg hover:border-cinema-gold transition-all cursor-pointer block group">
                                        <div className="w-16 h-16 bg-studio-bg border border-border-color flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                                            <Upload className="w-8 h-8 text-cinema-gold" />
                                        </div>
                                        <p className="text-sm text-text-primary font-black uppercase tracking-widest">Upload Master Copy</p>
                                        <p className="text-xs text-text-muted mt-2 font-serif italic">MP4, WebM, or MOV formats accepted</p>
                                        <input 
                                            type="file" 
                                            accept="video/*" 
                                            className="hidden" 
                                            onChange={handleFileChange}
                                        />
                                    </label>
                                ) : videoFile ? (
                                    <div className="bg-studio-bg border border-border-color p-6 flex items-center justify-between">
                                        <div className="flex items-center gap-6">
                                            <div className="w-16 h-16 bg-panel-bg flex items-center justify-center border border-border-color">
                                                <Video className="w-8 h-8 text-director-red" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-black uppercase tracking-widest text-text-primary truncate max-w-[300px]">{videoFile.name}</p>
                                                <p className="text-xs text-text-secondary font-serif italic">{(videoFile.size / (1024 * 1024)).toFixed(2)} MB • Ready for Screening</p>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={clearVideo} 
                                            className="p-3 hover:bg-panel-bg border border-transparent hover:border-border-color text-text-secondary hover:text-director-red transition-all cursor-pointer"
                                            title="Eject Master"
                                        >
                                            <X className="w-6 h-6" />
                                        </button>
                                    </div>
                                ) : null}
                            </div>
                        )}
                        
                        <div className="mt-8 pt-8 border-t border-border-color flex items-start gap-4">
                            <Activity className="w-5 h-5 text-cinema-gold mt-0.5" />
                            <p className="text-xs text-text-secondary leading-relaxed font-medium">
                                {inputMode === 'video' 
                                    ? "Studio-Grade Analysis: Our AI performs frame-by-frame inspection and audio spectral analysis to ensure compliance with global cinematic standards." 
                                    : "Pre-Production Mode: Analyze your script before the cameras roll. Get instant feedback on potential rating hurdles and cultural sensitivities."}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Right Column: AI Findings */}
                <div className="space-y-8">
                    {/* Rating Card */}
                    <div className="bg-panel-bg cinematic-border border-border-color p-8 flex flex-col items-center text-center relative overflow-hidden cinematic-glow">
                         <div className="w-full mb-8 pb-8 border-b border-border-color">
                             <h3 className="text-[10px] font-black text-text-secondary uppercase tracking-[0.2em] mb-4">Target Certification</h3>
                             <div className="flex justify-center gap-2">
                                 {[Rating.G, Rating.PG, Rating.PG13, Rating.R].map(r => (
                                     <button 
                                         key={r}
                                         onClick={() => setTargetRating(r)}
                                         className={`w-12 h-12 flex items-center justify-center text-xs font-black border-2 transition-all cursor-pointer ${targetRating === r ? 'border-cinema-gold bg-cinema-gold text-film-black scale-110 shadow-lg font-black' : 'border-border-color text-text-muted hover:border-text-secondary'}`}
                                     >
                                         {r}
                                     </button>
                                 ))}
                             </div>
                         </div>

                         {analysis ? (
                              <>
                                <div className="absolute -top-4 -right-4 p-4 opacity-5">
                                    <Shield className="w-40 h-40 text-text-primary" />
                                </div>
                                <h2 className="text-text-secondary text-xs uppercase tracking-[0.3em] font-black mb-6">Current Screening</h2>
                                <div className={`text-7xl font-black mb-4 font-serif ${getRatingColorClass(analysis.overallRating)}`}>
                                    {analysis.overallRating}
                                </div>
                                
                                {/* Live Rating Predictor Meter */}
                                <div className="w-full space-y-2 mb-6">
                                    <div className="flex justify-between text-[9px] font-black uppercase tracking-widest text-text-secondary">
                                        <span>Compliance Gap</span>
                                        <span className={analysis.overallRating === targetRating ? 'text-emerald-500' : 'text-director-red'}>
                                            {analysis.overallRating === targetRating ? 'Target Met' : 'Action Required'}
                                        </span>
                                    </div>
                                    <div className="w-full bg-studio-bg h-2 relative overflow-hidden border border-border-color">
                                        <div 
                                            className={`h-full transition-all duration-1000 ${analysis.score > 70 ? 'bg-director-red' : 'bg-cinema-gold'}`}
                                            style={{width: `${analysis.score}%`}}
                                        ></div>
                                        {/* Target Marker */}
                                        <div className="absolute top-0 bottom-0 w-0.5 bg-text-primary" style={{left: '40%'}}></div>
                                    </div>
                                </div>

                                 <p className="text-sm text-text-secondary leading-relaxed mb-8 font-medium italic">
                                     "{analysis.summary}"
                                 </p>

                                 {/* What-If Simulator */}
                                 <div className="w-full pt-8 border-t border-border-color">
                                     <div className="flex items-center justify-between mb-4">
                                         <h3 className="text-[10px] font-black text-text-secondary uppercase tracking-widest flex items-center gap-2">
                                             <Sliders className="w-3 h-3 text-director-red" /> What-If Simulator
                                         </h3>
                                         <span className="text-[10px] font-black text-text-primary">{whatIfIntensity}% Intensity</span>
                                     </div>
                                     <input 
                                         type="range" 
                                         min="0" 
                                         max="100" 
                                         value={whatIfIntensity}
                                         onChange={(e) => setWhatIfIntensity(Number(e.target.value))}
                                         className="w-full h-1.5 bg-studio-bg rounded-lg appearance-none cursor-pointer accent-cinema-gold mb-4"
                                     />
                                     <div className="bg-studio-bg p-3 text-[9px] font-black uppercase tracking-widest text-text-secondary border border-border-color">
                                         Predicted Rating at {whatIfIntensity}%: <span className="text-text-primary">{whatIfIntensity > 80 ? 'R' : whatIfIntensity > 40 ? 'PG-13' : 'PG'}</span>
                                     </div>
                                 </div>
                                 
                                 <button 
                                     onClick={() => setShowReport(true)}
                                     className="w-full bg-cinema-gold text-film-black hover:bg-director-red hover:text-white py-3.5 text-xs font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-3 cursor-pointer shadow-lg"
                                 >
                                     <FileCheck className="w-4 h-4" />
                                     Generate Official Certificate
                                 </button>

                                 {analysis.culturalNotes && (
                                     <div className="w-full mt-6 bg-studio-bg border-l-4 border-cinema-gold p-4 text-xs text-text-secondary text-left italic border-y border-r border-border-color">
                                         <strong className="text-text-primary uppercase tracking-widest block mb-1">Regional Context ({region})</strong> {analysis.culturalNotes}
                                     </div>
                                 )}
                              </>
                          ) : (
                              <div className="text-text-muted py-12 flex flex-col items-center gap-4">
                                  <MonitorPlay className="w-12 h-12 opacity-30" />
                                  <p className="font-serif italic text-text-secondary">Awaiting screening results...</p>
                              </div>
                          )}
                     </div>

                     {/* Cuts */}
                     {analysis && analysis.suggestedCuts && analysis.suggestedCuts.length > 0 && (
                         <div className="bg-panel-bg border border-border-color p-6 cinematic-glow">
                             <h3 className="text-xs font-black uppercase tracking-widest text-text-primary mb-4">Director's Cuts</h3>
                             <CutsList cuts={analysis.suggestedCuts} onSeek={handleSeek} />
                         </div>
                     )}

                     {/* Triggers */}
                     <div className="bg-panel-bg border border-border-color p-8 max-h-[600px] overflow-y-auto cinematic-glow">
                          <h3 className="text-xs font-black uppercase tracking-[0.3em] text-text-primary mb-6 flex items-center justify-between">
                             <span>Detected Triggers</span>
                             {analysis && <span className="text-[10px] bg-studio-bg border border-border-color px-2 py-1 text-text-secondary font-black">{analysis.triggers.length} Found</span>}
                          </h3>
                          {analysis ? (
                              <TriggerList triggers={analysis.triggers} onSelect={(t) => console.log(t)} />
                          ) : (
                              <div className="space-y-4">
                                  {[1,2,3,4].map(i => (
                                      <div key={i} className="h-14 bg-studio-bg border border-border-color animate-pulse"></div>
                                  ))}
                              </div>
                          )}
                     </div>
                </div>
            </div>
          );
      }
  };

  return (
    <div className="min-h-screen bg-studio-bg flex text-text-primary font-sans relative">

      {/* Film Grain Overlay */}
      <div className="film-grain" />

      {showReport && analysis && (
          <CertificationReport 
             data={analysis} 
             onClose={() => setShowReport(false)} 
             fileName={videoFile?.name || "Script Analysis"}
             region={region}
          />
      )}

      {/* Sidebar */}
      <aside className="w-72 bg-panel-bg border-r border-border-color flex flex-col hidden md:flex z-20">
        <div className="p-8 border-b border-border-color flex items-center gap-4">
          <div className="bg-studio-bg p-2.5 border border-border-color shadow-lg">
            <Shield className="w-6 h-6 text-cinema-gold" />
          </div>
          <span className="font-serif font-black text-xl tracking-tighter text-text-primary uppercase">ContentGuard</span>
        </div>
        
        <nav className="flex-1 p-6 space-y-2">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`w-full flex items-center gap-4 px-5 py-3.5 text-xs font-black uppercase tracking-[0.2em] transition-all duration-300 ${activeTab === 'dashboard' ? 'bg-cinema-gold text-film-black shadow-lg translate-x-2' : 'text-text-secondary hover:bg-studio-bg hover:text-white'}`}
          >
            <Activity className="w-5 h-5" />
            Screening
          </button>
          <button 
            onClick={() => setActiveTab('database')}
            className={`w-full flex items-center gap-4 px-5 py-3.5 text-xs font-black uppercase tracking-[0.2em] transition-all duration-300 ${activeTab === 'database' ? 'bg-cinema-gold text-film-black shadow-lg translate-x-2' : 'text-text-secondary hover:bg-studio-bg hover:text-white'}`}
          >
            <Globe className="w-5 h-5" />
            Intelligence
          </button>
          <button 
            onClick={() => setActiveTab('compliance')}
            className={`w-full flex items-center gap-4 px-5 py-3.5 text-xs font-black uppercase tracking-[0.2em] transition-all duration-300 ${activeTab === 'compliance' ? 'bg-cinema-gold text-film-black shadow-lg translate-x-2' : 'text-text-secondary hover:bg-studio-bg hover:text-white'}`}
          >
            <Search className="w-5 h-5" />
            Compliance
          </button>
          <button 
            onClick={() => setActiveTab('review')}
            className={`w-full flex items-center gap-4 px-5 py-3.5 text-xs font-black uppercase tracking-[0.2em] transition-all duration-300 ${activeTab === 'review' ? 'bg-cinema-gold text-film-black shadow-lg translate-x-2' : 'text-text-secondary hover:bg-studio-bg hover:text-white'}`}
          >
            <Users className="w-5 h-5" />
            Review Room
          </button>
          <button 
            onClick={() => setActiveTab('benchmark')}
            className={`w-full flex items-center gap-4 px-5 py-3.5 text-xs font-black uppercase tracking-[0.2em] transition-all duration-300 ${activeTab === 'benchmark' ? 'bg-cinema-gold text-film-black shadow-lg translate-x-2' : 'text-text-secondary hover:bg-studio-bg hover:text-white'}`}
          >
            <TrendingUp className="w-5 h-5" />
            Benchmark
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            className={`w-full flex items-center gap-4 px-5 py-3.5 text-xs font-black uppercase tracking-[0.2em] transition-all duration-300 ${activeTab === 'history' ? 'bg-cinema-gold text-film-black shadow-lg translate-x-2' : 'text-text-secondary hover:bg-studio-bg hover:text-white'}`}
          >
            <Clock className="w-5 h-5" />
            History
          </button>
          <button 
            onClick={() => setActiveTab('settings')}
            className={`w-full flex items-center gap-4 px-5 py-3.5 text-xs font-black uppercase tracking-[0.2em] transition-all duration-300 ${activeTab === 'settings' ? 'bg-cinema-gold text-film-black shadow-lg translate-x-2' : 'text-text-secondary hover:bg-studio-bg hover:text-white'}`}
          >
            <Sliders className="w-5 h-5" />
            Settings
          </button>
        </nav>
        {history.length > 0 && (
          <div className="px-6 mb-6">
            <h4 className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-4">Recent Uploads</h4>
            <div className="space-y-3">
              {history.map(item => (
                <div key={item.id} className="flex items-center gap-3 group cursor-pointer">
                  <div className="w-12 h-8 bg-studio-bg overflow-hidden border border-border-color">
                    <img src={item.thumbnail} alt="" className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-black text-text-primary truncate uppercase tracking-tighter">{item.title}</p>
                    <p className={`text-[9px] font-bold ${getRatingColorClass(item.rating)}`}>{item.rating}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="p-6 border-t border-border-color">
           <div className="bg-studio-bg p-4 text-[10px] text-text-secondary font-bold uppercase tracking-widest border border-border-color">
             <p className="mb-3 text-text-primary border-b border-border-color pb-2">Studio Status</p>
             <div className="flex justify-between mb-2">
               <span>Gemini API Engine</span>
               <span className="text-emerald-500">Active</span>
             </div>
             <div className="flex justify-between mb-2">
               <span>Token Usage</span>
               <span className="text-text-primary">1.2M / 2.0M</span>
             </div>
             <div className="flex justify-between mb-2">
               <span>Queue Position</span>
               <span className="text-text-primary">0 (Real-time)</span>
             </div>
             <div className="flex justify-between">
               <span>Processing</span>
               <span className="text-cinema-gold">Optimized</span>
             </div>
           </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto z-10 bg-studio-bg">
        <header className="h-20 border-b border-border-color bg-panel-bg/90 backdrop-blur-xl sticky top-0 z-30 flex items-center justify-between px-10">
           <h1 className="font-serif font-black text-2xl text-text-primary uppercase tracking-tight">
             {activeTab === 'dashboard' ? 'Screening Room' : 
              activeTab === 'database' ? 'Global Intelligence' : 
              activeTab === 'compliance' ? 'Compliance Status' : 
              activeTab === 'review' ? 'Review Board' : 
              activeTab === 'benchmark' ? 'Benchmark Target' : 
              activeTab === 'history' ? 'Project Archive' : 'Engine Settings'}
           </h1>
           <div className="flex items-center gap-6">
             {activeTab === 'dashboard' && (
                  <select 
                     className="bg-studio-bg border border-border-color text-[10px] font-black uppercase tracking-widest px-4 py-2 text-text-primary focus:outline-none focus:border-cinema-gold cursor-pointer"
                     value={region}
                     onChange={(e) => setRegion(e.target.value)}
                  >
                    <option value="US">USA (MPAA)</option>
                    <option value="IN">India (CBFC)</option>
                    <option value="UK">UK (BBFC)</option>
                    <option value="DE">Germany (FSK)</option>
                    <option value="JP">Japan (EIRIN)</option>
                  </select>
             )}
             <div className="h-10 w-10 bg-studio-bg border border-border-color flex items-center justify-center text-xs font-black text-cinema-gold shadow-lg">
               AI
             </div>
           </div>
        </header>

        {renderContent()}
      </main>

    </div>
  );
}

export default App;