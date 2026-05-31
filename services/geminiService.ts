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
  const apiKey =
    customApiKey ||
    localStorage.getItem('GEMINI_API_KEY') ||
    (typeof process !== 'undefined' ? (process.env.API_KEY || process.env.GEMINI_API_KEY) : '') ||
    '';

  const model =
    customModelName ||
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
    return JSON.parse(text);
  } catch (e) {
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch && jsonMatch[1]) {
      try {
        return JSON.parse(jsonMatch[1]);
      } catch (e2) {
        // fallthrough
      }
    }

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
async function withRetry<T>(operation: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
  try {
    return await operation();
  } catch (error: any) {
    if (retries <= 0) throw error;

    let errObj = error?.error;
    const rawMsg = error?.message || '';

    if (rawMsg.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(rawMsg);
        errObj = parsed.error || parsed;
      } catch {
        // ignore
      }
    }

    const status = error?.status || errObj?.status;
    const code = error?.code || error?.statusCode || errObj?.code;
    const msg = error?.message || errObj?.message || '';

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

    if (!isRetryable && retries < 2) throw error;

    console.warn(`API Error. Retrying in ${delay}ms... (${retries} attempts left)`, msg);
    await new Promise((res) => setTimeout(res, delay));
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
    validRatings: ['G', 'PG', 'PG-13', 'R', 'NC-17', 'TV-MA', 'TV-14', 'TV-PG', 'TV-G', 'TV-Y7', 'TV-Y'],
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
    validRatings: ['U', 'UA', 'UA 7+', 'UA 13+', 'UA 16+', 'A', 'S'],
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
    validRatings: ['U', 'PG', '12A', '15', '18', 'R18'],
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
    validRatings: ['FSK 0', 'FSK 6', 'FSK 12', 'FSK 16', 'FSK 18'],
  },
  JP: {
    instructions: `Target Region Standard: EIRIN (Japan).
    - G: General.
    - PG12: Parental Guidance requested for under 12.
    - R15+: Restricted to 15 and over.
    - R18+: Restricted to 18 and over.`,
    validRatings: ['G', 'PG', 'PG-13', 'R', 'NC-17'],
  },
};

/**
 * Programmatic Temporal Event Fusion
 * Cross-references triggers within a 5-second window to detect correlated threats
 * and elevates their severity or updates their descriptions.
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
        current.description = `[Fused Multi-Modal Event] ${current.description} at TC ${Math.floor(
          current.timestamp / 60
        )}:${Math.floor(current.timestamp % 60)
          .toString()
          .padStart(2, '0')} correlated with auditory triggers (${next.description}) within a close temporal window.`;
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
  region: string = 'US'
): AnalysisResult => {
  const violenceBase = 20;
  const profanityBase = 15;
  const sexualBase = 5;
  const themeBase = 25;

  const searchText = (input.text || '').toLowerCase() + (input.text ? '' : '') + (region || '');

  let violence = violenceBase;
  let profanity = profanityBase;
  let sexual = sexualBase;
  let theme = themeBase;

  if (searchText.includes('horror') || searchText.includes('scary') || searchText.includes('dread')) {
    violence = 40;
    theme = 40;
  } else if (searchText.includes('action') || searchText.includes('fight') || searchText.includes('weapon')) {
    violence = 80;
    profanity = 45;
  } else if (searchText.includes('sex') || searchText.includes('intimate') || searchText.includes('naked')) {
    sexual = 85;
    theme = 50;
    profanity = 30;
  }

  const score = Math.min(100, Math.round(violence * 0.4 + sexual * 0.3 + profanity * 0.15 + theme * 0.15));

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
    else rating = Rating.G;
  } else if (region === 'DE') {
    if (score > 75) rating = Rating.FSK_18;
    else if (score > 55) rating = Rating.FSK_16;
    else if (score > 35) rating = Rating.FSK_12;
    else if (score > 15) rating = Rating.FSK_6;
    else rating = Rating.FSK_0;
  } else {
    if (score > 75) rating = Rating.R;
    else if (score > 45) rating = Rating.PG13;
    else if (score > 20) rating = Rating.PG;
    else rating = Rating.G;
  }

  const triggers: ContentTrigger[] = [];
  const suggestedCuts: SuggestedCut[] = [];

  if (violence > 40) {
    triggers.push({
      id: `trig-v-${Date.now()}`,
      type: 'Violence',
      timestamp: 45,
      description: 'Characters engaging in intense physical conflict with impact shots.',
      severity: violence > 70 ? 'High' : 'Medium',
      confidence: 0.92,
      intent: 'Aggressive',
      tone: 'Dramatic',
    });

    if (violence > 60) {
      suggestedCuts.push({
        id: `cut-v-${Date.now()}`,
        startTime: 40,
        endTime: 50,
        reason: 'Reduce explicit violence and weapons impact to secure a lower age rating.',
        type: 'Violence',
      });
    }
  }

  if (profanity > 30) {
    triggers.push({
      id: `trig-p-${Date.now()}`,
      type: 'Profanity',
      timestamp: 84,
      description: 'Aggressive use of strong language in dialog sequence.',
      severity: profanity > 60 ? 'High' : 'Medium',
      confidence: 0.95,
      intent: 'Aggressive',
      tone: 'Tense',
    });

    if (profanity > 50) {
      suggestedCuts.push({
        id: `cut-p-${Date.now()}`,
        startTime: 82,
        endTime: 86,
        reason: 'Mute or cut strong verbal slurs and explicit language.',
        type: 'Profanity',
      });
    }
  }

  if (sexual > 40) {
    triggers.push({
      id: `trig-s-${Date.now()}`,
      type: 'Sexual',
      timestamp: 120,
      description: 'Intimate scene depicting partial nudity and suggestive behavior.',
      severity: sexual > 70 ? 'High' : 'Medium',
      confidence: 0.89,
      intent: 'Casual',
      tone: 'Romantic',
    });

    if (sexual > 60) {
      suggestedCuts.push({
        id: `cut-s-${Date.now()}`,
        startTime: 115,
        endTime: 125,
        reason: 'Trim explicit physical intimacy and visible exposure.',
        type: 'Sexual',
      });
    }
  }

  return {
    overallRating: rating,
    score,
    summary: `Content certified as ${rating} in region ${region}. Primary triggers are ${
      triggers.map((t) => t.type.toLowerCase()).join(', ') || 'none'
    }.`,
    detailedAnalysis: `### Regional Certification Report\n\n**Visual Style:** The director uses highly contrasting lighting and tight framing to capture tension. In moments of conflict, the camera utilizes hand-held movements to increase the sense of chaos and realism.\n\n**Audio Landscape:** The sound design features a swelling orchestral score punctuated by localized high-impact sound design (screams, glass breaks). Vocal tracks indicate elevated emotional arousal and aggression during key arguments.\n\n**Justification:** The rating tier of **${rating}** is warranted primarily because of the ${
      triggers.length > 0
        ? triggers.map((t) => `${t.severity.toLowerCase()} ${t.type.toLowerCase()}`).join(' and ')
        : 'absence of significant themes or triggers'
    }. Lowering the rating is possible by complying with the suggested compliance cuts.`,
    triggers,
    suggestedCuts,
    culturalNotes: `In ${region}, content standards restrict ${violence > 50 ? 'violence' : sexual > 50 ? 'sexual behavior' : 'strong language'} strictly.`,
    thematicIntensity: { dread: 10, tension: 20, melancholy: 10 },
    syntheticContent: [],
    financialImpact: {
      predictedRevenue: '$14.5M - $18.2M',
      ratingPenalty: rating === Rating.R || rating === Rating.A ? '25% Teen Access Deficit' : 'Minimal Penalty',
      marketAccess: region === 'IN' ? ['CBFC Certified UA', 'Multiplex Release'] : ['Wide Release', 'Streaming Compliant'],
    },
  };
};

const generateMockMovieKnowledge = (title: string): MovieKnowledge => {
  const norm = title.toLowerCase();

  if (norm.includes('batman')) {
    return {
      title: 'The Batman',
      type: 'Movie',
      year: '2022',
      certificates: [
        { region: 'US', standard: 'MPAA', rating: 'PG-13', reason: 'Strong violent content, drug content, and language.' },
        { region: 'IN', standard: 'CBFC', rating: 'UA 16+', reason: 'Action violence and dark themes.' },
        { region: 'UK', standard: 'BBFC', rating: '15', reason: 'Strong threat and violence.' },
        { region: 'DE', standard: 'FSK', rating: 'FSK 12', reason: 'Violence and scary scenes.' },
      ],
      analysis:
        'The movie was rated 15 in the UK due to BBFC\'s strict thresholds on sustained psychological threat and dark tone, whereas US MPAA granted a PG-13 because the violence lacked explicit gore.',
      contentDNA: { violence: 65, sex: 15, profanity: 35 },
    };
  }

  return {
    title,
    type: 'Movie',
    year: '2024',
    certificates: [
      { region: 'US', standard: 'MPAA', rating: 'PG-13', reason: 'Demo data.' },
      { region: 'IN', standard: 'CBFC', rating: 'UA 13+', reason: 'Demo data.' },
      { region: 'UK', standard: 'BBFC', rating: '12A', reason: 'Demo data.' },
      { region: 'DE', standard: 'FSK', rating: 'FSK 12', reason: 'Demo data.' },
    ],
    analysis: 'Demo analysis for UI continuity.',
    contentDNA: { violence: 50, sex: 20, profanity: 30 },
  };
};

const fetchHF = async (model: string, init: RequestInit): Promise<Response> => {
  try {
    const proxyResponse = await fetch(`/hf-proxy/models/${model}`, init);
    if (proxyResponse.status !== 404) return proxyResponse;
  } catch (proxyError) {
    console.warn('HF Proxy fetch failed, trying direct HF URL...', proxyError);
  }
  return await fetch(`https://api-inference.huggingface.co/models/${model}`, init);
};

const callTextModelOpenRouter = async (apiKey: string, model: string, systemPrompt: string, userPrompt: string): Promise<string> => {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenRouter query failed with status: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();
  const text = result.choices?.[0]?.message?.content;
  if (!text) throw new Error('Unexpected OpenRouter response format');
  return text;
};

// OpenRouter-only analysis (NO HF token usage, and NO undefined transcript/captions variables)
const analyzeContentOpenRouter = async (
  input: { text?: string; images?: string[]; audio?: string; duration?: number },
  region: string,
  apiKey: string,
  model: string
): Promise<AnalysisResult> => {
  const duration = input.duration || 600;
  const config = REGION_CONFIGS[region] || REGION_CONFIGS['US'];

  const normalizeTimestamp = (t: any): number => {
    const n = typeof t === 'number' ? t : Number(t);
    if (!isFinite(n)) return Math.floor(Math.random() * duration);
    // allow ms accident
    const seconds = n > duration * 10 ? Math.floor(n / 1000) : Math.floor(n);
    return Math.min(duration, Math.max(0, seconds));
  };

  const imageCount = input.images?.length || 0;
  const hasAudio = !!input.audio;

  const systemPrompt = `You are an expert film certification and content rating specialist.`;

  const userPrompt = `
Analyze the provided content to determine the age rating for region ${region}.

${config.instructions}

INPUT SIGNALS:
- Scene text provided: ${input.text ? 'yes' : 'no'}
- Extracted keyframes: ${imageCount}
- Extracted audio track: ${hasAudio ? 'yes' : 'no'}

Scene text (if any):
${input.text ? input.text : '(none)'}

Return STRICT JSON (no markdown) that matches this schema:
{
  "overallRating": "${config.validRatings.join('|')}",
  "score": number,
  "summary": string,
  "detailedAnalysis": string,
  "culturalNotes": string,
  "triggers": [
    {
      "type": "Violence" | "Profanity" | "Substance" | "Sexual" | "Theme" | "Synthetic",
      "timestamp": number, // SECONDS, within [0, ${duration}]
      "description": string,
      "severity": "Low" | "Medium" | "High",
      "confidence": number, // [0,1]
      "intent": "Aggressive" | "Casual" | "Hateful" | "Comedic" | "Educational",
      "tone": string
    }
  ],
  "suggestedCuts": [
    {"startTime": number, "endTime": number, "reason": string, "type": "Violence" | "Profanity" | "Substance" | "Sexual" | "Theme"}
  ],
  "thematicIntensity": {"dread": number, "tension": number, "melancholy": number},
  "syntheticContent": []
}

Hard rules:
- Timestamps MUST be in seconds.
- Ensure suggestedCuts endTime > startTime.
`;

  const textResponse = await callTextModelOpenRouter(apiKey, model, systemPrompt, userPrompt);
  const parsed = cleanAndParseJSON(textResponse);

  const rawTriggers: ContentTrigger[] = (parsed.triggers || []).map((t: any, idx: number) => {
    const confidence = typeof t?.confidence === 'number' ? t.confidence : Number(t?.confidence);

    return {
      id: `trig-${idx}-${Date.now()}`,
      type: t?.type,
      timestamp: normalizeTimestamp(t?.timestamp),
      description: t?.description || 'Detected event',
      severity: t?.severity || 'Low',
      confidence: isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : 0.5,
      intent: t?.intent || 'Educational',
      tone: t?.tone || '',
    } as ContentTrigger;
  });

  const fusedTriggers = fuseTemporalEvents(rawTriggers);

  const suggestedCuts: SuggestedCut[] = (parsed.suggestedCuts || []).map((c: any, idx: number) => {
    const startTime = normalizeTimestamp(c?.startTime);
    const endTime = normalizeTimestamp(c?.endTime);
    const safeEnd = Math.max(endTime, startTime + 1);

    return {
      id: `cut-${idx}-${Date.now()}`,
      startTime: Math.min(duration, Math.max(0, startTime)),
      endTime: Math.min(duration, safeEnd),
      reason: c?.reason || 'Suggested cut',
      type: c?.type || 'Theme',
    } as SuggestedCut;
  });

  return {
    overallRating: parsed.overallRating as Rating,
    score: typeof parsed.score === 'number' ? parsed.score : Number(parsed.score) || 0,
    summary: parsed.summary || 'Analysis complete.',
    detailedAnalysis: parsed.detailedAnalysis || parsed.summary || 'No detailed report available.',
    triggers: fusedTriggers,
    suggestedCuts,
    culturalNotes: parsed.culturalNotes || 'No specific cultural notes.',
    thematicIntensity: parsed.thematicIntensity || { dread: 0, tension: 0, melancholy: 0 },
    syntheticContent: [],
    financialImpact: parsed.financialImpact || {
      predictedRevenue: '$12.5M',
      ratingPenalty: 'Minimal',
      marketAccess: ['Wide Release'],
    },
    fallbackDemoMode: false,
  };
};

const captionImageHF = async (token: string, model: string, base64Image: string): Promise<string> => {
  const cleanData = base64Image.split(',')[1] || base64Image;
  const binaryString = atob(cleanData);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);

  const response = await fetchHF(model, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'image/jpeg' },
    body: bytes,
  });

  if (!response.ok) return 'Unable to generate visual description';
  const result = await response.json();
  if (Array.isArray(result) && result[0]?.generated_text) return result[0].generated_text;
  return 'Visual content analyzed';
};

const transcribeAudioHF = async (token: string, model: string, base64Audio: string): Promise<string> => {
  const binaryString = atob(base64Audio);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);

  const response = await fetchHF(model, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'audio/wav' },
    body: bytes,
  });

  if (!response.ok) return 'Silent or unparsed audio track';
  const result = await response.json();
  return result.text || '';
};

const callTextModelHF = async (token: string, model: string, systemPrompt: string, userPrompt: string): Promise<string> => {
  const response = await fetchHF(model, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      inputs: `<|im_start|>system\n${systemPrompt}<|im_end|>\n<|im_start|>user\n${userPrompt}<|im_end|>\n<|im_start|>assistant\n`,
      parameters: { max_new_tokens: 2500, temperature: 0.1 },
    }),
  });

  if (!response.ok) throw new Error(`Text model query failed with status: ${response.status} ${response.statusText}`);

  const result = await response.json();
  let text = '';
  if (Array.isArray(result) && result[0]?.generated_text) text = result[0].generated_text;
  else if (result.generated_text) text = result.generated_text;
  else if (result[0]?.text) text = result[0].text;
  else throw new Error('Unexpected Hugging Face text model format');

  if (text.includes('<|im_start|>assistant\n')) text = text.split('<|im_start|>assistant\n')[1];
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

  let transcript = '';
  let captions: string[] = [];
  const tasks: Promise<any>[] = [];

  if (input.audio) {
    tasks.push(
      transcribeAudioHF(token, whisperModel, input.audio)
        .then((res) => {
          transcript = res;
        })
        .catch((err) => console.warn('Whisper transcription error:', err))
    );
  }

  if (input.images && input.images.length > 0) {
    const imageTasks = input.images.map((img, idx) =>
      captionImageHF(token, captionModel, img)
        .then((caption) => {
          captions.push(`[Frame at T+${Math.floor(idx * (duration / input.images!.length))}s]: ${caption}`);
        })
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
${input.text ? `Scene Description: "${input.text}"` : ''}
${transcript ? `Audio Speech Transcript: "${transcript}"` : ''}
${captions.length > 0 ? `Visual Frame Descriptions:\n${captions.join('\n')}` : ''}

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
    timestamp: t.timestamp !== undefined ? Math.floor(t.timestamp) : Math.floor(Math.random() * duration),
  }));

  const fusedTriggers = fuseTemporalEvents(rawTriggers);

  const suggestedCuts: SuggestedCut[] = (parsed.suggestedCuts || []).map((c: any, idx: number) => ({
    ...c,
    id: `cut-${idx}-${Date.now()}`,
  }));

  return {
    overallRating: parsed.overallRating as Rating,
    score: parsed.score || 0,
    summary: parsed.summary || 'Analysis complete.',
    detailedAnalysis: parsed.detailedAnalysis || parsed.summary || 'No detailed report available.',
    triggers: fusedTriggers,
    suggestedCuts,
    culturalNotes: parsed.culturalNotes || 'No specific cultural notes.',
    thematicIntensity: parsed.thematicIntensity || { dread: 0, tension: 0, melancholy: 0 },
    syntheticContent: [],
    financialImpact: {
      predictedRevenue: parsed.financialImpact?.predictedRevenue || '$12.5M',
      ratingPenalty: parsed.financialImpact?.ratingPenalty || 'Minimal',
      marketAccess: parsed.financialImpact?.marketAccess || ['Wide Release'],
    },
  };
};

/**
 * Analyzes content.
 * Supports text, video frames (visual), and audio (auditory) analysis.
 */
export const analyzeContent = async (
  input: { text?: string; images?: string[]; audio?: string; duration?: number },
  region: string = 'US'
): Promise<AnalysisResult> => {
  const provider = getProviderConfig();
  const isDemoMode = getDemoModeConfig();

  const runFallback = (error: any): AnalysisResult => {
    console.warn('Live AI analysis failed. Falling back to Demo Sandbox Engine.', error);
    const mockResult = generateMockAnalysis(input, region);
    return { ...mockResult, fallbackDemoMode: true };
  };

  if (isDemoMode) {
    await new Promise((res) => setTimeout(res, 2500));
    return { ...generateMockAnalysis(input, region), fallbackDemoMode: false };
  }

  if (provider === 'openrouter') {
    const { apiKey, model } = getOpenRouterConfig();
    if (!apiKey) return runFallback(new Error('OpenRouter API Key is missing. Please configure your key in settings.'));
    try {
      return await analyzeContentOpenRouter(input, region, apiKey, model);
    } catch (error: any) {
      return runFallback(error);
    }
  }

  if (provider === 'huggingface') {
    const { token, textModel, whisperModel, captionModel } = getHFConfig();
    if (!token) return runFallback(new Error('Hugging Face Access Token is missing. Please configure your token in settings.'));
    try {
      return await analyzeContentHF(input, region, token, textModel, whisperModel, captionModel);
    } catch (error: any) {
      return runFallback(error);
    }
  }

  // Gemini live path
  const { apiKey } = getGeminiConfig();
  if (!apiKey) return runFallback(new Error('Gemini API Key is missing.'));

  const duration = input.duration || 600;
  const config = REGION_CONFIGS[region] || REGION_CONFIGS['US'];

  const isVideo = (input.images && input.images.length > 0) || !!input.audio;

  const basePrompt = `
You are an expert film certification and content rating specialist with deep knowledge of global regulatory standards (MPAA, BBFC, CBFC, FSK, EIRIN).
Analyze the provided content for content certification purposes.

${config.instructions}

The content includes ${input.images ? 'visual frames ' : ''} ${input.audio ? 'and an audio track' : ''}.

Return JSON with:
- overallRating
- score (0-100)
- summary
- detailedAnalysis
- culturalNotes
- triggers (timestamp in seconds)
- suggestedCuts (start/end in seconds)
- thematicIntensity
- syntheticContent
- financialImpact

${isVideo ? 'Analyze the multi-modal inputs (visuals and/or audio) combined.' : `Scene Description: "${input.text}"`}
`;

  const parts: any[] = [{ text: basePrompt }];

  if (input.images) {
    input.images.forEach((base64Data) => {
      const cleanData = base64Data.split(',')[1] || base64Data;
      parts.push({ inlineData: { mimeType: 'image/jpeg', data: cleanData } });
    });
  }

  if (input.audio) {
    parts.push({ inlineData: { mimeType: 'audio/wav', data: input.audio } });
  }

  try {
    const resultText = await withRetry(async () => {
      const client = getGeminiClient();
      const { model } = getGeminiConfig();

      const response = await client.models.generateContent({
        model,
        contents: { parts },
        config: {
          responseMimeType: 'application/json',
          maxOutputTokens: 4000,
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              overallRating: { type: Type.STRING, enum: config.validRatings },
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
                    tone: { type: Type.STRING },
                  },
                },
              },
              suggestedCuts: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    startTime: { type: Type.NUMBER },
                    endTime: { type: Type.NUMBER },
                    reason: { type: Type.STRING },
                    type: { type: Type.STRING, enum: ['Violence', 'Profanity', 'Substance', 'Sexual', 'Theme'] },
                  },
                },
              },
              thematicIntensity: {
                type: Type.OBJECT,
                properties: {
                  dread: { type: Type.NUMBER },
                  tension: { type: Type.NUMBER },
                  melancholy: { type: Type.NUMBER },
                },
              },
              syntheticContent: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    type: { type: Type.STRING, enum: ['Deepfake', 'SGI', 'De-aged', 'Non-consensual'] },
                    timestamp: { type: Type.NUMBER },
                    confidence: { type: Type.NUMBER },
                    description: { type: Type.STRING },
                  },
                },
              },
              financialImpact: {
                type: Type.OBJECT,
                properties: {
                  predictedRevenue: { type: Type.STRING },
                  ratingPenalty: { type: Type.STRING },
                  marketAccess: { type: Type.ARRAY, items: { type: Type.STRING } },
                },
              },
            },
          },
        },
      });

      if (!response.text) throw new Error('Empty response from AI');
      return response.text;
    });

    const parsed = cleanAndParseJSON(resultText);

    const rawTriggers: ContentTrigger[] = (parsed.triggers || []).map((t: any, idx: number) => ({
      ...t,
      id: `trig-${idx}-${Date.now()}`,
      timestamp:
        t.timestamp !== undefined
          ? Math.min(duration, Math.max(0, Math.floor(Number(t.timestamp))))
          : Math.floor(Math.random() * duration),
      confidence: typeof t.confidence === 'number' ? Math.max(0, Math.min(1, t.confidence)) : 0.5,
    }));

    const fusedTriggers = fuseTemporalEvents(rawTriggers);

    const suggestedCuts: SuggestedCut[] = (parsed.suggestedCuts || []).map((c: any, idx: number) => {
      const startTime = Math.min(duration, Math.max(0, Math.floor(Number(c?.startTime))));
      const endTime0 = Math.min(duration, Math.max(0, Math.floor(Number(c?.endTime))));
      const endTime = Math.max(endTime0, startTime + 1);
      return {
        ...c,
        id: `cut-${idx}-${Date.now()}`,
        startTime,
        endTime,
      };
    });

    return {
      overallRating: parsed.overallRating as Rating,
      score: parsed.score || 0,
      summary: parsed.summary || 'Analysis complete.',
      detailedAnalysis: parsed.detailedAnalysis || parsed.summary || 'No detailed report available.',
      triggers: fusedTriggers,
      suggestedCuts,
      culturalNotes: parsed.culturalNotes || 'No specific cultural notes.',
      thematicIntensity: parsed.thematicIntensity || { dread: 0, tension: 0, melancholy: 0 },
      syntheticContent: (parsed.syntheticContent || []).map((s: any, idx: number) => ({
        ...s,
        id: `synth-${idx}-${Date.now()}`,
        timestamp: Math.min(duration, Math.max(0, Math.floor(Number(s?.timestamp)))),
        confidence: typeof s.confidence === 'number' ? Math.max(0, Math.min(1, s.confidence)) : 0.5,
      })),
      financialImpact: parsed.financialImpact,
      fallbackDemoMode: false,
    };
  } catch (error: any) {
    return runFallback(error);
  }
};

/**
 * Retrieves historical certification data for a movie title.
 */
export const getMovieCertificates = async (title: string): Promise<MovieKnowledge | null> => {
  const isDemoMode = getDemoModeConfig();
  const { apiKey } = getGeminiConfig();

  if (isDemoMode || !apiKey) {
    await new Promise((res) => setTimeout(res, 1200));
    return generateMockMovieKnowledge(title);
  }

  const prompt = `
Act as a global media certification database for both Movies and TV Series.
Retrieve the official historical certification/rating data for the title "${title}".

Determine if this is a 'Movie' or a 'Series'.

If it is a TV Series, provide the TV Parental Guidelines (e.g., TV-MA, TV-14) for the US, and equivalent TV ratings for other regions.
If it is a Movie, provide the Theatrical ratings (e.g., R, PG-13).

Return a structured JSON object with:
1) title, type (Movie/Series), year
2) certificates array for: US, UK, India, Japan, Germany
3) analysis paragraph
4) contentDNA: violence/sex/profanity scores (0-100)

If the title does not exist, return null.
`;

  try {
    return await withRetry(async () => {
      const client = getGeminiClient();
      const { model } = getGeminiConfig();

      const response = await client.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
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
                    reason: { type: Type.STRING },
                  },
                },
              },
              analysis: { type: Type.STRING },
              contentDNA: {
                type: Type.OBJECT,
                properties: {
                  violence: { type: Type.NUMBER },
                  sex: { type: Type.NUMBER },
                  profanity: { type: Type.NUMBER },
                },
              },
            },
          },
        },
      });

      const text = response.text;
      if (!text) return null;
      return cleanAndParseJSON(text) as MovieKnowledge;
    });
  } catch (error) {
    console.error('Global Database Query Failed:', error);
    return null;
  }
};

