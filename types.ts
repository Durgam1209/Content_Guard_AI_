export enum Rating {
  // MPAA (US)
  G = 'G',
  PG = 'PG',
  PG13 = 'PG-13',
  R = 'R',
  NC17 = 'NC-17',
  
  // TV Guidelines (US)
  TVMA = 'TV-MA',
  TV14 = 'TV-14',
  TVPG = 'TV-PG',
  TVG = 'TV-G',
  TVY7 = 'TV-Y7',
  TVY = 'TV-Y',
  
  // CBFC (India) - 2024 Amendment Standards
  U = 'U',             // Unrestricted
  UA = 'UA',           // Parental Guidance (Legacy/Generic)
  UA7 = 'UA 7+',       // Guidance for < 7 years
  UA13 = 'UA 13+',     // Guidance for < 13 years
  UA16 = 'UA 16+',     // Guidance for < 16 years
  A = 'A',             // Adults Only
  S = 'S',             // Specialized (Doctors/Scientists)

  // BBFC (UK)
  BBFC_12A = '12A',
  BBFC_15 = '15',
  BBFC_18 = '18',
  BBFC_R18 = 'R18',

  // FSK (Germany)
  FSK_0 = 'FSK 0',
  FSK_6 = 'FSK 6',
  FSK_12 = 'FSK 12',
  FSK_16 = 'FSK 16',
  FSK_18 = 'FSK 18',

  Unrated = 'UNRATED'
}

export interface ContentTrigger {
  id: string;
  type: 'Violence' | 'Profanity' | 'Substance' | 'Sexual' | 'Theme' | 'Synthetic';
  timestamp: number; // Seconds
  description: string;
  severity: 'Low' | 'Medium' | 'High';
  confidence: number;
  intent?: 'Aggressive' | 'Casual' | 'Hateful' | 'Comedic' | 'Educational';
  tone?: string;
  thumbnail?: string;
}

export interface SyntheticDetection {
  id: string;
  type: 'Deepfake' | 'SGI' | 'De-aged' | 'Non-consensual';
  timestamp: number;
  confidence: number;
  description: string;
  thumbnail?: string;
}

export interface SuggestedCut {
  id: string;
  startTime: number;
  endTime: number;
  reason: string;
  type: 'Violence' | 'Profanity' | 'Substance' | 'Sexual' | 'Theme';
}

export interface AnalysisResult {
  overallRating: Rating;
  score: number; // 0-100 (0 is G/U, 100 is NC-17/A)
  summary: string;
  detailedAnalysis: string; // Detailed formal report text
  triggers: ContentTrigger[];
  suggestedCuts: SuggestedCut[];
  culturalNotes: string;
  thematicIntensity: {
    dread: number;
    tension: number;
    melancholy: number;
  };
  syntheticContent: SyntheticDetection[];
  financialImpact?: {
    predictedRevenue: string;
    ratingPenalty: string;
    marketAccess: string[];
  };
}

export interface TimelinePoint {
  time: number; // seconds
  intensity: number; // 0-100
  violence?: number;
  profanity?: number;
  substance?: number;
  sexual?: number;
  theme?: number;
  dread?: number;
  tension?: number;
  label?: string;
  thumbnail?: string; // Base64 or URL for frame preview
}

export interface RegionalCertificate {
  region: string; // e.g., 'US', 'UK'
  standard: string; // e.g., 'MPAA', 'BBFC'
  rating: string; // e.g., 'R', '15'
  reason: string; // specific reason provided by the board
}

export interface MovieKnowledge {
  title: string;
  type: 'Movie' | 'Series';
  year: string;
  certificates: RegionalCertificate[];
  analysis: string; // ML model's understanding of the variance
  contentDNA: {
    violence: number; // 0-100
    sex: number;
    profanity: number;
  }
}

export interface HistoryItem {
  id: string;
  title: string;
  timestamp: number;
  rating: Rating;
  thumbnail: string;
}

export type ViewState = 'upload' | 'analyzing' | 'dashboard' | 'database' | 'history' | 'compliance' | 'review' | 'benchmark';
