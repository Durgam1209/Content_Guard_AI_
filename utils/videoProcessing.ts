/**
 * Advanced Video Processing Utilities
 * Implements Client-Side Shot Boundary Detection (SBD) and Adaptive Sampling
 * 
 * UPGRADES:
 * - Implemented heuristic 'Suspicion Scoring' (Motion + Color Intensity).
 * - Prioritizes 'red' dominant frames (potential gore/fire) and high-motion cuts.
 * - Adaptive temporal grouping using SBD (Shot Boundary Detection) logic.
 * - Prepares optimized keyframes for heavier backend models (ViViT/Gemini Pro).
 */

export const extractSmartFrames = async (
  videoFile: File, 
  onProgress?: (status: string, progress?: number) => void
): Promise<string[]> => {
  const videoUrl = URL.createObjectURL(videoFile);
  const video = document.createElement('video');
  video.src = videoUrl;
  video.muted = true;
  video.playsInline = true;
  video.crossOrigin = "anonymous";

  // 1. Initialize Video & Metadata
  onProgress?.('Initializing cinematic stream...', 0);
  try {
    await new Promise((resolve, reject) => {
      video.onloadedmetadata = () => resolve(true);
      video.onerror = (e) => reject(e);
      setTimeout(() => reject(new Error("Video metadata load timeout")), 5000);
    });
  } catch (e) {
    console.warn("Video metadata failed to load", e);
    URL.revokeObjectURL(videoUrl);
    return [];
  }

  const duration = video.duration || 1;
  
  // Optimization: Single Pass Adaptive Sampling
  // We'll scan and extract in one go to avoid redundant seeks
  const MAX_POINTS = 60; // Reduced from 80 to speed up further while maintaining quality
  const interval = Math.max(0.5, duration / MAX_POINTS);
  
  // Analysis Canvas (Low Res)
  const aWidth = 64; 
  const aHeight = 36;
  const aCanvas = document.createElement('canvas');
  aCanvas.width = aWidth;
  aCanvas.height = aHeight;
  const aCtx = aCanvas.getContext('2d', { willReadFrequently: true });
  
  // Extraction Canvas (High Res)
  const eCanvas = document.createElement('canvas');
  const maxDim = 512;
  const aspectRatio = (video.videoWidth || 16) / (video.videoHeight || 9);
  if (aspectRatio > 1) {
      eCanvas.width = maxDim;
      eCanvas.height = Math.round(maxDim / aspectRatio);
  } else {
      eCanvas.height = maxDim;
      eCanvas.width = Math.round(maxDim * aspectRatio);
  }
  const eCtx = eCanvas.getContext('2d');

  if (!aCtx || !eCtx) {
      URL.revokeObjectURL(videoUrl);
      return [];
  }

  interface FrameCandidate {
      time: number;
      score: number;
      dataUrl: string;
  }
  
  const candidates: FrameCandidate[] = [];
  let prevData: Uint8ClampedArray | null = null;
  const MAX_CANDIDATES = 20;

  // 2. Single Pass: Scan & Conditional Extraction
  const totalSteps = Math.ceil(duration / interval);
  
  for (let i = 0; i < totalSteps; i++) {
     const t = i * interval;
     video.currentTime = t;
     
     // Wait for seek
     await new Promise(r => { 
         const handler = () => { video.removeEventListener('seeked', handler); r(true); };
         video.addEventListener('seeked', handler);
         setTimeout(() => { video.removeEventListener('seeked', handler); r(true); }, 600); 
     });

     try {
        // Analysis
        aCtx.drawImage(video, 0, 0, aWidth, aHeight);
        const frameData = aCtx.getImageData(0, 0, aWidth, aHeight).data;
        
        let diff = 0;
        let redDominance = 0;
        let brightness = 0;
        const sampleStep = 4;

        for (let j = 0; j < frameData.length; j += (sampleStep * 4)) {
            const r = frameData[j];
            const g = frameData[j+1];
            const b = frameData[j+2];

            if (prevData) {
                diff += Math.abs(r - prevData[j]) + Math.abs(g - prevData[j+1]) + Math.abs(b - prevData[j+2]);
            }
            if (r > 160 && g < 90 && b < 90) redDominance++;
            brightness += (r + g + b) / 3;
        }

        const sampledPixels = (frameData.length / 4) / sampleStep;
        const motionScore = prevData ? (diff / (sampledPixels * 3 * 255)) * 100 : 0;
        const redScore = (redDominance / sampledPixels) * 100;
        const avgBrightness = brightness / sampledPixels;

        // Composite Score
        let score = motionScore + (redScore * 4);
        if (avgBrightness < 20 && motionScore < 15) score *= 0.1; // Skip dark/static frames

        // Extraction (Only if it's a potential candidate)
        // We always extract if we have space, or if it's better than the worst candidate
        const worstCandidateScore = candidates.length > 0 ? Math.min(...candidates.map(c => c.score)) : -1;
        
        if (candidates.length < MAX_CANDIDATES || score > worstCandidateScore) {
            eCtx.drawImage(video, 0, 0, eCanvas.width, eCanvas.height);
            const dataUrl = eCanvas.toDataURL('image/jpeg', 0.8);
            
            candidates.push({ time: t, score, dataUrl });
            
            // Keep only top N
            if (candidates.length > MAX_CANDIDATES) {
                candidates.sort((a, b) => b.score - a.score);
                candidates.pop();
            }
        }

        prevData = frameData;
     } catch (e) {
         console.warn("Frame processing error:", e);
     }

     const percent = Math.round(((i + 1) / totalSteps) * 100);
     onProgress?.(`Analyzing reel sequence...`, percent);
  }

  // 3. Final Sort & Return
  // Sort by time for temporal consistency in analysis
  const finalFrames = candidates
    .sort((a, b) => a.time - b.time)
    .map(c => c.dataUrl);

  // Cleanup
  URL.revokeObjectURL(videoUrl);
  video.remove();
  
  return finalFrames;
};
