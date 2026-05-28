import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult, Rating, ContentTrigger, MovieKnowledge, SuggestedCut } from "../types";

// Initialize Gemini Client dynamically to prevent client-side build exposure and support user overrides
let customApiKey: string | null = null;
let customModelName: string | null = null;

export const setGeminiConfig = (apiKey: string, model: string) => {
    customApiKey = apiKey;
    customModelName = model;
    if (apiKey) {
        localStorage.setItem('GEMINI_API_KEY', apiKey);
    }
    if (model) {
        localStorage.setItem('GEMINI_MODEL', model);
    }
};

let customDemoMode: boolean | null = null;

export const setDemoModeConfig = (enabled: boolean) => {
    customDemoMode = enabled;
    localStorage.setItem('DEMO_MODE', enabled ? 'true' : 'false');
};

export const getDemoModeConfig = () => {
    if (customDemoMode !== null) return customDemoMode;
    return localStorage.getItem('DEMO_MODE') === 'true';
};

export const getProviderConfig = (): string => {
    return localStorage.getItem('AI_PROVIDER') || 'gemini';
};

export const setProviderConfig = (provider: string) => {
    localStorage.setItem('AI_PROVIDER', provider);
};

export const getHFConfig = () => {
    const token = localStorage.getItem('HF_TOKEN') || '';
    const textModel = localStorage.getItem('HF_TEXT_MODEL') || 'Qwen/Qwen2.5-7B-Instruct';
    const whisperModel = localStorage.getItem('HF_WHISPER_MODEL') || 'openai/whisper-large-v3';
    const captionModel = localStorage.getItem('HF_CAPTION_MODEL') || 'Salesforce/blip-image-captioning-large';
    return { token, textModel, whisperModel, captionModel };
};

export const setHFConfig = (token: string, textModel: string, whisperModel: string, captionModel: string) => {
    localStorage.setItem('HF_TOKEN', token);
    localStorage.setItem('HF_TEXT_MODEL', textModel);
    localStorage.setItem('HF_WHISPER_MODEL', whisperModel);
    localStorage.setItem('HF_CAPTION_MODEL', captionModel);
};

export const getOpenRouterConfig = () => {
    const apiKey = localStorage.getItem('OPENROUTER_API_KEY') || '';
    const model = localStorage.getItem('OPENROUTER_MODEL') || 'meta-llama/llama-3-8b-instruct:free';
    return { apiKey, model };
};

export const setOpenRouterConfig = (apiKey: string, model: string) => {
    localStorage.setItem('OPENROUTER_API_KEY', apiKey);
    localStorage.setItem('OPENROUTER_MODEL', model);
};

export const getGeminiConfig = () => {
    const apiKey = customApiKey || 
        localStorage.getItem('GEMINI_API_KEY') || 
        (typeof process !== 'undefined' ? (process.env.API_KEY || process.env.GEMINI_API_KEY) : '') || 
        '';
    const model = customModelName || 
        localStorage.getItem('GEMINI_MODEL') || 
        'gemini-2.5-flash';
    return { apiKey, model };
};

const getGeminiClient = () => {
    const { apiKey } = getGeminiConfig();
    if (!apiKey) {
        throw new Error("Gemini API Key is missing. Please configure your API key in the settings panel to enable AI analysis.");
    }
    return new GoogleGenAI({ apiKey });
};


// --- Production Resilience Utilities ---

/**
 * Parses JSON from LLM responses that might be wrapped in Markdown code blocks.
 */
const cleanAndParseJSON = (text: string): any => {
    try {
        // 1. Try direct parse
        return JSON.parse(text);
    } catch (e) {
        // 2. Try stripping markdown code blocks ```json ... ```
        const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (jsonMatch && jsonMatch[1]) {
            try {
                return JSON.parse(jsonMatch[1]);
            } catch (e2) {
                // Fallthrough
            }
        }
        
        // 3. Try finding the first '{' and last '}'
        const firstBrace = text.indexOf('{');
        const lastBrace = text.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1) {
             try {
                return JSON.parse(text.substring(firstBrace, lastBrace + 1));
            } catch (e3) {
                throw new Error("Malformed JSON in AI response");
            }
        }
        throw e;
    }
};

/**
 * Retries an async operation with exponential backoff.
 * Crucial for production APIs to handle 429 (Rate Limits) or 503 (Service Unavailable).
 */
async function withRetry<T>(
    operation: () => Promise<T>, 
    retries = 3, 
    delay = 1000
): Promise<T> {
    try {
        return await operation();
    } catch (error: any) {
        if (retries <= 0) throw error;
        
        let errObj = error.error;
        const rawMsg = error.message || '';
        
        if (rawMsg.trim().startsWith('{')) {
            try {
                const parsed = JSON.parse(rawMsg);
                errObj = parsed.error || parsed;
            } catch (e) {}
        }
        
        const status = error.status || errObj?.status;
        const code = error.code || error.statusCode || errObj?.code;
        const msg = error.message || errObj?.message || '';
        
        // Catch 503 (Service Unavailable), 504 (Gateway Timeout), 429 (Quota Exceeded / Rate Limited), etc.
        const isRetryable = 
            status === 503 || 
            code === 503 || 
            status === 'UNAVAILABLE' ||
            status === 504 ||
            code === 504 ||
            status === 'DEADLINE_EXCEEDED' ||
            status === 429 || 
            code === 429 || 
            status === 'RESOURCE_EXHAUSTED' ||
            msg.includes('fetch') ||
            msg.includes('503') ||
            msg.includes('504') ||
            msg.includes('429') ||
            msg.includes('Service Unavailable') ||
            msg.includes('Gateway Timeout') ||
            msg.includes('Too Many Requests') ||
            msg.includes('demand') ||
            msg.includes('temporary') ||
            msg.includes('quota') ||
            msg.includes('limit');

        if (!isRetryable && retries < 2) throw error; // Don't retry logic errors indefinitely

        console.warn(`API Error. Retrying in ${delay}ms... (${retries} attempts left)`, msg);
        await new Promise(res => setTimeout(res, delay));
        return withRetry(operation, retries - 1, delay * 2);
    }
}

// Region Configuration Definitions
const REGION_CONFIGS: Record<string, { instructions: string; validRatings: string[] }> = {
  US: {
    instructions: `Target Region Standard: MPAA (Movies) & TV Parental Guidelines (TV).
    
    MPAA (Theatrical):
    - G: General Audiences.
    - PG: Parental Guidance Suggested.
    - PG-13: Parents Strongly Cautioned.
    - R: Restricted.
    - NC-17: Adults Only.

    TV Guidelines (Broadcast/Streaming):
    - TV-Y / TV-Y7: Children.
    - TV-G: General Audience.
    - TV-PG: Parental Guidance.
    - TV-14: Parents Strongly Cautioned (Approx. PG-13).
    - TV-MA: Mature Audience Only (Approx. R).`,
    validRatings: ['G', 'PG', 'PG-13', 'R', 'NC-17', 'TV-MA', 'TV-14', 'TV-PG', 'TV-G', 'TV-Y7', 'TV-Y']
  },
  IN: {
    instructions: `Strictly adhere to the Central Board of Film Certification (CBFC) standards, specifically the 2024 Amendments which introduced age-based tiers for UA:
      
      RATINGS DEFINITIONS:
      - 'U': Unrestricted. Wholesome, family-friendly. No violence, no intimacy, no abusive language.
      - 'UA': Parental Guidance (Generic/Legacy).
      - 'UA 7+': Mild caution. May contain very mild fantasy violence or emotional themes. Guidance for < 7 years.
      - 'UA 13+': Moderate caution. Can contain moderate action violence and implied intimacy, but no explicit content. Guidance for < 13 years.
      - 'UA 16+': Strong caution. Can contain STRONG VIOLENCE (blood, gore, intense fighting) and mature themes. Guidance for < 16 years. **CRITICAL:** Strong violence DOES NOT automatically mean 'A' if there is no nudity.
      - 'A': Adults Only (18+). Required for: NUDITY (even mild/partial), strong sexual scenes, extreme gore, or abusive language targeting communities.
      - 'S': Specialized audience (e.g., medical training).
      
      KEY DECISION RULES (INDIA):
      1. **The Nudity Rule:** If there is ANY visible nudity, the rating MUST be 'A'. It cannot be 'UA 16+'.
      2. **The Violence Rule:** High-octane action/violence with blood is acceptable in 'UA 16+' as long as it is not sexually violent.
      3. **Language Rule:** Hateful or communal slurs are strictly prohibited (usually censored), but if present, result in 'A'.`,
    validRatings: ['U', 'UA', 'UA 7+', 'UA 13+', 'UA 16+', 'A', 'S']
  },
  UK: {
    instructions: `Target Region Standard: BBFC (British Board of Film Classification).
    
    RATINGS DEFINITIONS:
    - 'U': Universal. Suitable for all.
    - 'PG': Parental Guidance. General viewing, but some scenes may be unsuitable for young children.
    - '12A': Suitable for 12 years and over. No one younger than 12 may see a 12A film in a cinema unless accompanied by an adult.
    - '15': Suitable only for 15 years and over. No one younger than 15 may see a 15 film in a cinema. Strong violence, drug taking, strong language.
    - '18': Suitable only for adults. No one younger than 18 may see an 18 film in a cinema. Explicit violence, sexual content.
    - 'R18': Restricted 18. To be shown only in specially licensed cinemas, or supplied only in licensed sex shops.
    
    KEY RULES (UK):
    - Sexual Violence: Any depiction of non-consensual sexual activity usually pushes towards 18.
    - Drugs: Detailed portrayal of drug mechanics pushes to 18.
    - Discrimination: Discriminatory language or behavior usually requires 12A or 15 depending on context and condemnation.`,
    validRatings: ['U', 'PG', '12A', '15', '18', 'R18']
  },
  DE: {
    instructions: `Target Region Standard: FSK (Freiwillige Selbstkontrolle der Filmwirtschaft - Germany).
    
    RATINGS DEFINITIONS:
    - 'FSK 0': Released without age restriction (white).
    - 'FSK 6': Released for ages 6 and up (yellow).
    - 'FSK 12': Released for ages 12 and up (green). Children from 6 years can attend if accompanied by a parent.
    - 'FSK 16': Released for ages 16 and up (blue). No one under 16 admitted.
    - 'FSK 18': Released for ages 18 and up (red). No youth admitted.
    
    KEY RULES (GERMANY):
    - Vigilantism: Movies where the hero takes the law into their own hands and kills excessively are often FSK 18 or even Index (banned).
    - War/Violence: Realistic depictions of war suffering are allowed in 12/16 if not glorifying. Glorification of violence pushes to 18.
    - Sexual Content: Often more lenient than US/UK, but combined with violence leads to strict 18 rating.`,
    validRatings: ['FSK 0', 'FSK 6', 'FSK 12', 'FSK 16', 'FSK 18']
  },
  JP: {
     instructions: `Target Region Standard: EIRIN (Japan).
     - G: General.
     - PG12: Parental Guidance requested for under 12.
     - R15+: Restricted to 15 and over.
     - R18+: Restricted to 18 and over.`,
     validRatings: ['G', 'PG', 'PG-13', 'R', 'NC-17'] // Fallback to compatible types
  }
};

/**
 * Programmatic Temporal Event Fusion
 * Cross-references triggers within a 5-second window to detect correlated threats
 * (e.g., visual weapon/aggression + auditory screaming/gunshots/hate speech)
 * and elevates their severity or updates their descriptions to reflect the fused context.
 */
export const fuseTemporalEvents = (triggers: ContentTrigger[]): ContentTrigger[] => {
    const sorted = [...triggers].sort((a, b) => a.timestamp - b.timestamp);
    const fused: ContentTrigger[] = [];
    const windowSeconds = 5;

    for (let i = 0; i < sorted.length; i++) {
        let current = { ...sorted[i] };

        for (let j = i + 1; j < sorted.length; j++) {
            const next = sorted[j];
            if (next.timestamp - current.timestamp > windowSeconds) break;

            const isVisualThreat = current.type === 'Violence' || current.type === 'Sexual' || current.type === 'Theme';
            const isAudioThreat = next.type === 'Profanity' || next.type === 'Substance' || next.type === 'Violence';
            
            if (isVisualThreat && isAudioThreat) {
                current.severity = 'High';
                current.description = `[Fused Multi-Modal Event] ${current.description} at TC ${Math.floor(current.timestamp/60)}:${Math.floor(current.timestamp%60).toString().padStart(2,'0')} correlated with auditory triggers (${next.description}) within a close temporal window.`;
                current.confidence = Math.min(1.0, Math.max(current.confidence, next.confidence) * 1.15);
                
                // Remove the fused target to avoid listing it separately
                sorted.splice(j, 1);
                j--;
            }
        }
        fused.push(current);
    }
    return fused;
};

const generateMockAnalysis = (
  input: { text?: string; images?: string[]; audio?: string; duration?: number },
  region: string = "US"
): AnalysisResult => {
  const title = input.text || "Uploaded Video Master";
  
  // Determine content profile based on name or text
  let violence = 20;
  let profanity = 15;
  let substance = 10;
  let sexual = 5;
  let theme = 25;
  let dread = 15;
  let tension = 20;
  let melancholy = 10;
  
  const searchText = (input.text || "").toLowerCase() + (title || "").toLowerCase();
  
  if (searchText.includes("kannathil") || searchText.includes("war") || searchText.includes("conflict")) {
    violence = 55;
    theme = 70;
    dread = 45;
    tension = 60;
    melancholy = 65;
    profanity = 20;
  } else if (searchText.includes("horror") || searchText.includes("scary") || searchText.includes("dread")) {
    dread = 85;
    tension = 90;
    melancholy = 40;
    violence = 40;
  } else if (searchText.includes("action") || searchText.includes("fight") || searchText.includes("weapon")) {
    violence = 80;
    tension = 75;
    profanity = 45;
  } else if (searchText.includes("sex") || searchText.includes("intimate") || searchText.includes("naked")) {
    sexual = 85;
    theme = 50;
    profanity = 30;
  }

  // Calculate composite score
  const score = Math.min(100, Math.round((violence * 0.4) + (sexual * 0.3) + (profanity * 0.15) + (theme * 0.15)));
  
  // Determine rating based on score and region
  let rating = Rating.G;
  if (region === 'US') {
    if (score > 75) rating = Rating.R;
    else if (score > 45) rating = Rating.PG13;
    else if (score > 20) rating = Rating.PG;
    else rating = Rating.G;
  } else if (region === 'IN') {
    if (score > 75) rating = Rating.A;
    else if (score > 60) rating = Rating.UA16;
    else if (score > 45) rating = Rating.UA13;
    else if (score > 25) rating = Rating.UA7;
    else if (score > 15) rating = Rating.UA;
    else rating = Rating.U;
  } else if (region === 'UK') {
    if (score > 75) rating = Rating.BBFC_18;
    else if (score > 55) rating = Rating.BBFC_15;
    else if (score > 35) rating = Rating.BBFC_12A;
    else if (score > 15) rating = Rating.PG;
    else rating = Rating.U;
  } else if (region === 'DE') {
    if (score > 75) rating = Rating.FSK_18;
    else if (score > 55) rating = Rating.FSK_16;
    else if (score > 35) rating = Rating.FSK_12;
    else if (score > 15) rating = Rating.FSK_6;
    else rating = Rating.FSK_0;
  } else {
    // JP
    if (score > 75) rating = Rating.R;
    else if (score > 45) rating = Rating.PG13;
    else if (score > 20) rating = Rating.PG;
    else rating = Rating.G;
  }

  // Triggers list
  const triggers: ContentTrigger[] = [];
  const suggestedCuts: SuggestedCut[] = [];
  
  if (violence > 40) {
    triggers.push({
      id: `trig-v-${Date.now()}`,
      type: 'Violence',
      timestamp: 45,
      description: "Characters engaging in intense physical conflict with impact shots.",
      severity: violence > 70 ? 'High' : 'Medium',
      confidence: 0.92,
      intent: 'Aggressive',
      tone: 'Dramatic'
    });
    
    if (violence > 60) {
      suggestedCuts.push({
        id: `cut-v-${Date.now()}`,
        startTime: 40,
        endTime: 50,
        reason: "Reduce explicit violence and weapons impact to secure a lower age rating.",
        type: 'Violence'
      });
    }
  }

  if (profanity > 30) {
    triggers.push({
      id: `trig-p-${Date.now()}`,
      type: 'Profanity',
      timestamp: 84,
      description: "Aggressive use of strong language in dialog sequence.",
      severity: profanity > 60 ? 'High' : 'Medium',
      confidence: 0.95,
      intent: 'Aggressive',
      tone: 'Tense'
    });
    
    if (profanity > 50) {
      suggestedCuts.push({
        id: `cut-p-${Date.now()}`,
        startTime: 82,
        endTime: 86,
        reason: "Mute or cut strong verbal slurs and explicit language.",
        type: 'Profanity'
      });
    }
  }

  if (sexual > 40) {
    triggers.push({
      id: `trig-s-${Date.now()}`,
      type: 'Sexual',
      timestamp: 120,
      description: "Intimate scene depicting partial nudity and suggestive behavior.",
      severity: sexual > 70 ? 'High' : 'Medium',
      confidence: 0.89,
      intent: 'Casual',
      tone: 'Romantic'
    });
    
    if (sexual > 60) {
      suggestedCuts.push({
        id: `cut-s-${Date.now()}`,
        startTime: 115,
        endTime: 125,
        reason: "Trim explicit physical intimacy and visible exposure.",
        type: 'Sexual'
      });
    }
  }

  return {
    overallRating: rating,
    score: score,
    summary: `Content certified as ${rating} in region ${region}. Primary triggers are ${triggers.map(t => t.type.toLowerCase()).join(', ') || 'none'}.`,
    detailedAnalysis: `### Regional Certification Report\n\n**Visual Style:** The director uses highly contrasting lighting and tight framing to capture tension. In moments of conflict, the camera utilizes hand-held movements to increase the sense of chaos and realism.\n\n**Audio Landscape:** The sound design features a swelling orchestral score punctuated by localized high-impact sound design (screams, glass breaks). Vocal tracks indicate elevated emotional arousal and aggression during key arguments.\n\n**Justification:** The rating tier of **${rating}** is warranted primarily because of the ${triggers.length > 0 ? triggers.map(t => `${t.severity.toLowerCase()} ${t.type.toLowerCase()}`).join(' and ') : 'absence of significant themes or triggers'}. Lowering the rating is possible by complying with the suggested compliance cuts.`,
    triggers: triggers,
    suggestedCuts: suggestedCuts,
    culturalNotes: `In ${region}, content standards restrict ${violence > 50 ? 'violence' : sexual > 50 ? 'sexual behavior' : 'strong language'} strictly. Indian CBFC standards require a statutory anti-tobacco scroll if smoking is depicted, whereas US standards focus heavily on explicit intimacy.`,
    thematicIntensity: { dread, tension, melancholy },
    syntheticContent: [],
    financialImpact: {
      predictedRevenue: "$14.5M - $18.2M",
      ratingPenalty: rating === Rating.R || rating === Rating.A ? "25% Teen Access Deficit" : "Minimal Penalty",
      marketAccess: region === 'IN' ? ["CBFC Certified UA", "Multiplex Release"] : ["Wide Release", "Streaming Compliant"]
    }
  };
};

const generateMockMovieKnowledge = (title: string): MovieKnowledge => {
  const norm = title.toLowerCase();
  
  if (norm.includes("batman")) {
    return {
      title: "The Batman",
      type: "Movie",
      year: "2022",
      certificates: [
        { region: "US", standard: "MPAA", rating: "PG-13", reason: "Strong violent content, drug content, and language." },
        { region: "IN", standard: "CBFC", rating: "UA 16+", reason: "Action violence and dark themes." },
        { region: "UK", standard: "BBFC", rating: "15", reason: "Strong threat and violence." },
        { region: "DE", standard: "FSK", rating: "FSK 12", reason: "Violence and scary scenes." }
      ],
      analysis: "The movie was rated 15 in the UK due to BBFC's strict thresholds on sustained psychological threat and dark tone, whereas US MPAA granted a PG-13 because the violence lacked explicit gore.",
      contentDNA: { violence: 65, sex: 15, profanity: 35 }
    };
  } else if (norm.includes("oppenheimer")) {
    return {
      title: "Oppenheimer",
      type: "Movie",
      year: "2023",
      certificates: [
        { region: "US", standard: "MPAA", rating: "R", reason: "Some sexuality, nudity, and language." },
        { region: "IN", standard: "CBFC", rating: "UA 16+", reason: "Nudity censored / blurred, mature themes." },
        { region: "UK", standard: "BBFC", rating: "15", reason: "Infrequent nudity and strong language." },
        { region: "DE", standard: "FSK", rating: "FSK 12", reason: "Thematic density and language." }
      ],
      analysis: "Rated R in the US due to explicit depiction of sexual intimacy and nudity. The Indian release received a UA 16+ after digital modifications to cover nudity in accordance with regional compliance laws.",
      contentDNA: { violence: 25, sex: 55, profanity: 45 }
    };
  } else if (norm.includes("dune")) {
    return {
      title: "Dune: Part Two",
      type: "Movie",
      year: "2024",
      certificates: [
        { region: "US", standard: "MPAA", rating: "PG-13", reason: "Sequences of strong violence and brief strong language." },
        { region: "IN", standard: "CBFC", rating: "UA 13+", reason: "Fantasy violence and epic battles." },
        { region: "UK", standard: "BBFC", rating: "12A", reason: "Moderate violence and threat." },
        { region: "DE", standard: "FSK", rating: "FSK 12", reason: "Action battles." }
      ],
      analysis: "Rated consistently PG-13 / 12A across global markets as the violence, although frequent, is stylized science fiction without graphic realism or sadism.",
      contentDNA: { violence: 55, sex: 10, profanity: 20 }
    };
  } else {
    // Deadpool & Wolverine
    return {
      title: "Deadpool & Wolverine",
      type: "Movie",
      year: "2024",
      certificates: [
        { region: "US", standard: "MPAA", rating: "R", reason: "Strong bloody violence and language throughout, gore, and sexual references." },
        { region: "IN", standard: "CBFC", rating: "A", reason: "Graphic cartoonish violence, crude profanity, and sexual innuendo." },
        { region: "UK", standard: "BBFC", rating: "15", reason: "Strong bloody violence and sexual references." },
        { region: "DE", standard: "FSK", rating: "FSK 16", reason: "Bloody action scenes." }
      ],
      analysis: "Highly restricted globally due to highly creative, explicit, and self-referential gore/violence combined with near-constant sexual references and crude profanity.",
      contentDNA: { violence: 85, sex: 45, profanity: 80 }
    };
  }
};
const fetchHF = async (model: string, init: RequestInit): Promise<Response> => {
    try {
        const proxyResponse = await fetch(`/hf-proxy/models/${model}`, init);
        if (proxyResponse.status !== 404) {
            return proxyResponse;
        }
    } catch (proxyError) {
        console.warn("HF Proxy fetch failed, trying direct HF URL...", proxyError);
    }
    return await fetch(`https://api-inference.huggingface.co/models/${model}`, init);
};

const callTextModelOpenRouter = async (apiKey: string, model: string, systemPrompt: string, userPrompt: string): Promise<string> => {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: model,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ],
            temperature: 0.1
        })
    });
    
    if (!response.ok) {
        throw new Error(`OpenRouter query failed with status: ${response.status} ${response.statusText}`);
    }
    
    const result = await response.json();
    const text = result.choices?.[0]?.message?.content;
    if (!text) {
        throw new Error("Unexpected OpenRouter response format");
    }
    return text;
};

const captionImageHF = async (token: string, model: string, base64Image: string): Promise<string> => {
    const cleanData = base64Image.split(',')[1] || base64Image;
    const binaryString = atob(cleanData);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    
    const response = await fetchHF(model, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "image/jpeg"
        },
        body: bytes
    });
    
    if (!response.ok) return "Unable to generate visual description";
    const result = await response.json();
    if (Array.isArray(result) && result[0]?.generated_text) {
        return result[0].generated_text;
    }
    return "Visual content analyzed";
};

const transcribeAudioHF = async (token: string, model: string, base64Audio: string): Promise<string> => {
    const binaryString = atob(base64Audio);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    
    const response = await fetchHF(model, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "audio/wav"
        },
        body: bytes
    });
    
    if (!response.ok) return "Silent or unparsed audio track";
    const result = await response.json();
    return result.text || "";
};

const callTextModelHF = async (token: string, model: string, systemPrompt: string, userPrompt: string): Promise<string> => {
    const response = await fetchHF(model, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            inputs: `<|im_start|>system\n${systemPrompt}<|im_end|>\n<|im_start|>user\n${userPrompt}<|im_end|>\n<|im_start|>assistant\n`,
            parameters: {
                max_new_tokens: 2500,
                temperature: 0.1
            }
        })
    });
    
    if (!response.ok) {
        throw new Error(`Text model query failed with status: ${response.status} ${response.statusText}`);
    }
    
    const result = await response.json();
    let text = "";
    if (Array.isArray(result) && result[0]?.generated_text) {
        text = result[0].generated_text;
    } else if (result.generated_text) {
        text = result.generated_text;
    } else if (result[0]?.text) {
        text = result[0].text;
    } else {
        throw new Error("Unexpected Hugging Face text model format");
    }
    
    if (text.includes("<|im_start|>assistant\n")) {
        text = text.split("<|im_start|>assistant\n")[1];
    }
    return text;
};

const analyzeContentHF = async (
  input: { text?: string; images?: string[]; audio?: string; duration?: number },
  region: string,
  token: string,
  textModel: string,
  whisperModel: string,
  captionModel: string
): Promise<AnalysisResult> => {
    const duration = input.duration || 600;
    const config = REGION_CONFIGS[region] || REGION_CONFIGS['US'];
    
    let transcript = "";
    let captions: string[] = [];
    const tasks: Promise<any>[] = [];
    
    if (input.audio) {
        tasks.push(
            transcribeAudioHF(token, whisperModel, input.audio)
                .then(res => { transcript = res; })
                .catch(err => console.warn("Whisper transcription error:", err))
        );
    }
    
    if (input.images && input.images.length > 0) {
        const imageTasks = input.images.map((img, idx) => 
            captionImageHF(token, captionModel, img)
                .then(caption => { captions.push(`[Frame at T+${Math.floor(idx * (duration / input.images!.length))}s]: ${caption}`); })
                .catch(() => {})
        );
        tasks.push(Promise.all(imageTasks));
    }
    
    await Promise.all(tasks);
    
    const basePrompt = `
      You are an expert film certification and content rating specialist.
      Analyze the provided content to determine the age rating for region ${region}.
      
      ${config.instructions}
    `;
    
    const userPrompt = `
      Determine:
      1. The likely certification rating based on the region. Valid ratings are: ${config.validRatings.join(', ')}
      2. A list of specific triggers (Violence, Profanity, Substance, Sexual, Theme, Synthetic).
      3. A numeric intensity score (0-100).
      4. A concise summary of the reasoning.
      5. Detailed Analysis Report explaining the rating.
      6. Suggested Cuts with start/end timecodes.
      7. Thematic Intensity Scores (0-100) for Dread, Tension, Melancholy.
      
      Input Data:
      ${input.text ? `Scene Description: "${input.text}"` : ""}
      ${transcript ? `Audio Speech Transcript: "${transcript}"` : ""}
      ${captions.length > 0 ? `Visual Frame Descriptions:\n${captions.join('\n')}` : ""}
      
      Provide the response strictly as a single JSON object with this format, without markdown wrapping:
      {
        "overallRating": "R",
        "score": 65,
        "summary": "Brief summary...",
        "detailedAnalysis": "Formal report paragraph...",
        "culturalNotes": "Regional standards explanation...",
        "triggers": [
           { "type": "Violence", "timestamp": 45, "description": "Trigger description...", "severity": "Medium", "confidence": 0.85, "intent": "Aggressive", "tone": "Dramatic" }
        ],
        "suggestedCuts": [
           { "startTime": 40, "endTime": 50, "reason": "Cut description...", "type": "Violence" }
        ],
        "thematicIntensity": { "dread": 40, "tension": 50, "melancholy": 10 },
        "syntheticContent": []
      }
    `;
    
    const textResponse = await callTextModelHF(token, textModel, basePrompt, userPrompt);
    const parsed = cleanAndParseJSON(textResponse);
    
    const rawTriggers: ContentTrigger[] = (parsed.triggers || []).map((t: any, idx: number) => ({
      ...t,
      id: `trig-${idx}-${Date.now()}`,
      timestamp: t.timestamp !== undefined ? Math.floor(t.timestamp) : Math.floor(Math.random() * duration)
    }));

    const fusedTriggers = fuseTemporalEvents(rawTriggers);

    const suggestedCuts: SuggestedCut[] = (parsed.suggestedCuts || []).map((c: any, idx: number) => ({
      ...c,
      id: `cut-${idx}-${Date.now()}`
    }));

    return {
      overallRating: parsed.overallRating as Rating,
      score: parsed.score || 0,
      summary: parsed.summary || "Analysis complete.",
      detailedAnalysis: parsed.detailedAnalysis || parsed.summary || "No detailed report available.", 
      triggers: fusedTriggers,
      suggestedCuts: suggestedCuts,
      culturalNotes: parsed.culturalNotes || "No specific cultural notes.",
      thematicIntensity: parsed.thematicIntensity || { dread: 0, tension: 0, melancholy: 0 },
      syntheticContent: [],
      financialImpact: {
         predictedRevenue: parsed.financialImpact?.predictedRevenue || "$12.5M",
         ratingPenalty: parsed.financialImpact?.ratingPenalty || "Minimal",
         marketAccess: parsed.financialImpact?.marketAccess || ["Wide Release"]
      }
    };
};

/**
 * Analyzes content.
 * Supports text, video frames (visual), and audio (auditory) analysis.
 */
const analyzeContentOpenRouter = async (
  input: { text?: string; images?: string[]; audio?: string; duration?: number },
  region: string,
  apiKey: string,
  model: string
): Promise<AnalysisResult> => {
    const duration = input.duration || 600;
    const config = REGION_CONFIGS[region] || REGION_CONFIGS['US'];
    
    let transcript = "";
    let captions: string[] = [];
    const tasks: Promise<any>[] = [];
    
    const hf = getHFConfig();
    if (input.audio && hf.token) {
        tasks.push(
            transcribeAudioHF(hf.token, hf.whisperModel, input.audio)
                .then(res => { transcript = res; })
                .catch(err => console.warn("Whisper transcription error:", err))
        );
    }
    
    if (input.images && input.images.length > 0 && hf.token) {
        const imageTasks = input.images.map((img, idx) => 
            captionImageHF(hf.token, hf.captionModel, img)
                .then(caption => { captions.push(`[Frame at T+${Math.floor(idx * (duration / input.images!.length))}s]: ${caption}`); })
                .catch(() => {})
        );
        tasks.push(Promise.all(imageTasks));
    }
    
    await Promise.all(tasks);
    
    const basePrompt = `
      You are an expert film certification and content rating specialist.
      Analyze the provided content to determine the age rating for region ${region}.
      
      ${config.instructions}
    `;
    
    const userPrompt = `
      Determine:
      1. The likely certification rating based on the region. Valid ratings are: ${config.validRatings.join(', ')}
      2. A list of specific triggers (Violence, Profanity, Substance, Sexual, Theme, Synthetic).
      3. A numeric intensity score (0-100).
      4. A concise summary of the reasoning.
      5. Detailed Analysis Report explaining the rating.
      6. Suggested Cuts with start/end timecodes.
      7. Thematic Intensity Scores (0-100) for Dread, Tension, Melancholy.
      
      Input Data:
      ${input.text ? `Scene Description: "${input.text}"` : ""}
      ${transcript ? `Audio Speech Transcript: "${transcript}"` : ""}
      ${captions.length > 0 ? `Visual Frame Descriptions:\n${captions.join('\n')}` : ""}
      
      Provide the response strictly as a single JSON object with this format, without markdown wrapping:
      {
        "overallRating": "R",
        "score": 65,
        "summary": "Brief summary...",
        "detailedAnalysis": "Formal report paragraph...",
        "culturalNotes": "Regional standards explanation...",
        "triggers": [
           { "type": "Violence", "timestamp": 45, "description": "Trigger description...", "severity": "Medium", "confidence": 0.85, "intent": "Aggressive", "tone": "Dramatic" }
        ],
        "suggestedCuts": [
           { "startTime": 40, "endTime": 50, "reason": "Cut description...", "type": "Violence" }
        ],
        "thematicIntensity": { "dread": 40, "tension": 50, "melancholy": 10 },
        "syntheticContent": []
      }
    `;
    
    const textResponse = await callTextModelOpenRouter(apiKey, model, basePrompt, userPrompt);
    const parsed = cleanAndParseJSON(textResponse);
    
    const rawTriggers: ContentTrigger[] = (parsed.triggers || []).map((t: any, idx: number) => ({
      ...t,
      id: `trig-${idx}-${Date.now()}`,
      timestamp: t.timestamp !== undefined ? Math.floor(t.timestamp) : Math.floor(Math.random() * duration)
    }));

    const fusedTriggers = fuseTemporalEvents(rawTriggers);

    const suggestedCuts: SuggestedCut[] = (parsed.suggestedCuts || []).map((c: any, idx: number) => ({
      ...c,
      id: `cut-${idx}-${Date.now()}`
    }));

    return {
      overallRating: parsed.overallRating as Rating,
      score: parsed.score || 0,
      summary: parsed.summary || "Analysis complete.",
      detailedAnalysis: parsed.detailedAnalysis || parsed.summary || "No detailed report available.", 
      triggers: fusedTriggers,
      suggestedCuts: suggestedCuts,
      culturalNotes: parsed.culturalNotes || "No specific cultural notes.",
      thematicIntensity: parsed.thematicIntensity || { dread: 0, tension: 0, melancholy: 0 },
      syntheticContent: [],
      financialImpact: {
         predictedRevenue: parsed.financialImpact?.predictedRevenue || "$12.5M",
         ratingPenalty: parsed.financialImpact?.ratingPenalty || "Minimal",
         marketAccess: parsed.financialImpact?.marketAccess || ["Wide Release"]
      }
    };
};

export const analyzeContent = async (
  input: { text?: string; images?: string[]; audio?: string; duration?: number },
  region: string = "US"
): Promise<AnalysisResult> => {
  const provider = getProviderConfig();
  const isDemoMode = getDemoModeConfig();

  const runFallback = (error: any): AnalysisResult => {
      console.warn("Live AI analysis failed. Falling back to Demo Sandbox Engine.", error);
      const mockResult = generateMockAnalysis(input, region);
      return {
          ...mockResult,
          fallbackDemoMode: true
      };
  };

  if (isDemoMode) {
      await new Promise(res => setTimeout(res, 2500));
      return {
          ...generateMockAnalysis(input, region),
          fallbackDemoMode: false
      };
  }

  if (provider === 'openrouter') {
      const { apiKey, model } = getOpenRouterConfig();
      if (!apiKey) {
          return runFallback(new Error("OpenRouter API Key is missing. Please configure your key in settings."));
      }
      try {
          return await analyzeContentOpenRouter(input, region, apiKey, model);
      } catch (error: any) {
          return runFallback(error);
      }
  }

  if (provider === 'huggingface') {
      const { token, textModel, whisperModel, captionModel } = getHFConfig();
      if (!token) {
          return runFallback(new Error("Hugging Face Access Token is missing. Please configure your token in settings."));
      }
      try {
          return await analyzeContentHF(input, region, token, textModel, whisperModel, captionModel);
      } catch (error: any) {
          return runFallback(error);
      }
  }

  // Gemini live path
  const { apiKey } = getGeminiConfig();
  if (!apiKey) {
      return runFallback(new Error("Gemini API Key is missing."));
  }

  const isVideo = (input.images && input.images.length > 0) || !!input.audio;
  const duration = input.duration || 600;
  const config = REGION_CONFIGS[region] || REGION_CONFIGS['US'];

  const basePrompt = `
    You are an expert film certification and content rating specialist with deep knowledge of global regulatory standards (MPAA, BBFC, CBFC, FSK, EIRIN).
    Analyze the provided content for content certification purposes.
    
    ${config.instructions}
    
    The content includes ${input.images ? 'visual frames ' : ''} ${input.audio ? 'and an audio track' : ''}.

    **ADVANCED ANALYSIS REQUIREMENTS & TEMPORAL SIGNAL FUSION:**
    1. **Multi-Modal Temporal Event Fusion (Correlated Threat Scoring):** 
       - Cross-reference visual keyframes with audio tracks. If you detect a weapon or aggressive stance visually AND hear high-intensity, threatening speech or loud sound effects (gunshots, screaming) at overlapping temporal ranges, fuse them into a single high-severity Trigger event.
       - Synthesize audio transcript cues (what is spoken) with visual contextual indicators (who is speaking and their facial expression) to evaluate genuine intent (e.g. theatrical drama vs. comedic parody).
    2. **Audio Sentiment, Speech-to-Text & Intensity Mapping:** 
       - Segment audio stream to identify peaks in vocal volume and emotional aggression.
       - Map the intent behind profanity. Is it casual expression, comedic joke, demeaning insult, or systemic hate speech? Hateful slurs carry absolute priority flags.
    3. **Cultural Nuance Engine:**
       - Look for region-specific compliance criteria: public smoking/tobacco (strictly requires a warning message in India CBFC), religious symbols/insults, national pride insults, or localized gestures.
    4. **Thematic Intensity (Vibe Analytics):**
       - Measure "thematic intensity" scores: Dread, Tension, and Melancholy (0-100). Highlight scenes where sustained psychological horror or tension (e.g. silent stalking, monster shadow) is present without active violence.
    5. **Synthetic Content (Deepfake/SGI) Detection:**
       - Scan visual inputs for digital face swaps, SGI characters, de-aged actors, or artificial voice replication. Create a log with confidence values.
    6. **Financial Impact Prediction:**
       - Estimate potential revenue loss/gain based on the predicted rating (e.g., impact of 'A' vs 'UA-16+' in India).
    
    Determine:
    1. The likely certification rating based on the region provided.
    2. A list of specific triggers (Violence, Profanity, Substance, Sexual, Theme, Synthetic).
    3. A numeric intensity score (0-100).
    4. A concise summary of the reasoning.
    5. Detailed Analysis Report: Formal report on visual style, audio landscape, tone, and justification.
    6. Suggested Cuts: Specific time ranges to lower the rating.
    7. **Thematic Intensity Scores:** (0-100) for Dread, Tension, Melancholy.
    8. **Synthetic Content Log:** List of detected AI-generated or modified imagery.
    9. **Financial Impact Summary:** Predicted revenue impact and market access notes.

    ${isVideo ? 'Analyze the multi-modal inputs (visuals and/or audio) combined.' : `Scene Description: "${input.text}"`}
  `;

  const parts: any[] = [{ text: basePrompt }];

  if (input.images) {
    input.images.forEach(base64Data => {
      const cleanData = base64Data.split(',')[1] || base64Data;
      parts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: cleanData
        }
      });
    });
  }

  if (input.audio) {
    parts.push({
        inlineData: {
            mimeType: 'audio/wav',
            data: input.audio
        }
    });
  }

  try {
    const resultText = await withRetry(async () => {
        const client = getGeminiClient();
        const { model } = getGeminiConfig();
        const response = await client.models.generateContent({
          model: model,
          contents: { parts }, 
          config: {
            responseMimeType: "application/json",
            maxOutputTokens: 4000, 
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                overallRating: { 
                  type: Type.STRING, 
                  enum: config.validRatings
                },
                score: { type: Type.NUMBER },
                summary: { type: Type.STRING },
                detailedAnalysis: { type: Type.STRING },
                culturalNotes: { type: Type.STRING },
                triggers: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      type: { type: Type.STRING, enum: ['Violence', 'Profanity', 'Substance', 'Sexual', 'Theme', 'Synthetic'] },
                      timestamp: { type: Type.NUMBER },
                      description: { type: Type.STRING },
                      severity: { type: Type.STRING, enum: ['Low', 'Medium', 'High'] },
                      confidence: { type: Type.NUMBER },
                      intent: { type: Type.STRING, enum: ['Aggressive', 'Casual', 'Hateful', 'Comedic', 'Educational'] },
                      tone: { type: Type.STRING }
                    }
                  }
                },
                suggestedCuts: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      startTime: { type: Type.NUMBER },
                      endTime: { type: Type.NUMBER },
                      reason: { type: Type.STRING },
                      type: { type: Type.STRING, enum: ['Violence', 'Profanity', 'Substance', 'Sexual', 'Theme'] }
                    }
                  }
                },
                thematicIntensity: {
                  type: Type.OBJECT,
                  properties: {
                    dread: { type: Type.NUMBER },
                    tension: { type: Type.NUMBER },
                    melancholy: { type: Type.NUMBER }
                  }
                },
                syntheticContent: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      type: { type: Type.STRING, enum: ['Deepfake', 'SGI', 'De-aged', 'Non-consensual'] },
                      timestamp: { type: Type.NUMBER },
                      confidence: { type: Type.NUMBER },
                      description: { type: Type.STRING }
                    }
                  }
                },
                financialImpact: {
                  type: Type.OBJECT,
                  properties: {
                    predictedRevenue: { type: Type.STRING },
                    ratingPenalty: { type: Type.STRING },
                    marketAccess: { type: Type.ARRAY, items: { type: Type.STRING } }
                  }
                }
              }
            }
          }
        });
        
        if (!response.text) throw new Error("Empty response from AI");
        return response.text;
    });

    const parsed = cleanAndParseJSON(resultText);
    const rawTriggers: ContentTrigger[] = (parsed.triggers || []).map((t: any, idx: number) => ({
      ...t,
      id: `trig-${idx}-${Date.now()}`,
      timestamp: t.timestamp !== undefined ? Math.floor(t.timestamp) : Math.floor(Math.random() * duration)
    }));

    const fusedTriggers = fuseTemporalEvents(rawTriggers);

    const suggestedCuts: SuggestedCut[] = (parsed.suggestedCuts || []).map((c: any, idx: number) => ({
      ...c,
      id: `cut-${idx}-${Date.now()}`
    }));

    return {
      overallRating: parsed.overallRating as Rating,
      score: parsed.score || 0,
      summary: parsed.summary || "Analysis complete.",
      detailedAnalysis: parsed.detailedAnalysis || parsed.summary || "No detailed report available.", 
      triggers: fusedTriggers,
      suggestedCuts: suggestedCuts,
      culturalNotes: parsed.culturalNotes || "No specific cultural notes.",
      thematicIntensity: parsed.thematicIntensity || { dread: 0, tension: 0, melancholy: 0 },
      syntheticContent: (parsed.syntheticContent || []).map((s: any, idx: number) => ({
        ...s,
        id: `synth-${idx}-${Date.now()}`
      })),
      financialImpact: parsed.financialImpact,
      fallbackDemoMode: false
    };
  } catch (error: any) {
    return runFallback(error);
  }
};

/**
 * Retrieves historical certification data for a movie title.
 * Acts as a Machine Learning Model Database by querying the LLM's knowledge base.
 */
export const getMovieCertificates = async (title: string): Promise<MovieKnowledge | null> => {
  const isDemoMode = getDemoModeConfig();
  const { apiKey } = getGeminiConfig();
  
  if (isDemoMode || !apiKey) {
      await new Promise(res => setTimeout(res, 1200));
      return generateMockMovieKnowledge(title);
  }

  const prompt = `
    Act as a global media certification database for both Movies and TV Series. 
    Retrieve the official historical certification/rating data for the title "${title}".
    
    Determine if this is a 'Movie' or a 'Series'.

    If it is a TV Series, provide the TV Parental Guidelines (e.g., TV-MA, TV-14) for the US, and equivalent TV ratings for other regions.
    If it is a Movie, provide the Theatrical ratings (e.g., R, PG-13).

    Return a structured JSON object with the following:
    1. Title, Type (Movie or Series), and Release Year (e.g., "2008-2013" for series).
    2. A list of 'certificates' for these regions: 'US' (MPAA or TV Guidelines), 'UK' (BBFC), 'India' (CBFC or U/A), 'Japan' (EIRIN), 'Germany' (FSK). 
       - Include the 'rating' (e.g., R, TV-MA, 15, UA).
       - Include the 'standard' (e.g., "MPAA", "TV Guidelines", "BBFC").
       - Include a brief 'reason' (e.g., "Strong violence", "Drug use").
    3. An 'analysis' paragraph explaining the variance in ratings across regions (e.g., why it was 15 in UK but R in US).
    4. A 'contentDNA' object with numeric scores (0-100) for 'violence', 'sex', and 'profanity' based on the movie's content profile.
    
    If the title does not exist, return null.
  `;

  try {
    // Retry database queries as well
    return await withRetry(async () => {
        const client = getGeminiClient();
        const { model } = getGeminiConfig();
        const response = await client.models.generateContent({
          model: model,
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                type: { type: Type.STRING, enum: ['Movie', 'Series'] },
                year: { type: Type.STRING },
                certificates: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      region: { type: Type.STRING },
                      standard: { type: Type.STRING },
                      rating: { type: Type.STRING },
                      reason: { type: Type.STRING }
                    }
                  }
                },
                analysis: { type: Type.STRING },
                contentDNA: {
                  type: Type.OBJECT,
                  properties: {
                    violence: { type: Type.NUMBER },
                    sex: { type: Type.NUMBER },
                    profanity: { type: Type.NUMBER }
                  }
                }
              }
            }
          }
        });

        const text = response.text;
        if (!text) return null;
        return cleanAndParseJSON(text) as MovieKnowledge;
    });
  } catch (error) {
    console.error("Global Database Query Failed:", error);
    return null;
  }
};