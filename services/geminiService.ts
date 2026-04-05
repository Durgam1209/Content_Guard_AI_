import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult, Rating, ContentTrigger, MovieKnowledge, SuggestedCut } from "../types";

// Initialize Gemini Client
// IN PRODUCTION: This key should be proxied through your own backend (e.g. /api/analyze)
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Upgrade to Pro model for deep video understanding and complex reasoning
const modelName = 'gemini-3-pro-preview';

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
        
        // Check for specific retryable errors (503 Service Unavailable, 429 Too Many Requests)
        const isRetryable = error.status === 503 || error.status === 429 || error.message?.includes('fetch');
        if (!isRetryable && retries < 2) throw error; // Don't retry logic errors indefinitely

        console.warn(`API Error. Retrying in ${delay}ms... (${retries} attempts left)`, error.message);
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
 * Analyzes content using Gemini. 
 * Supports text, video frames (visual), and audio (auditory) analysis.
 */
export const analyzeContent = async (
  input: { text?: string; images?: string[]; audio?: string; duration?: number },
  region: string = "US"
): Promise<AnalysisResult> => {
  
  const isVideo = (input.images && input.images.length > 0) || !!input.audio;
  const duration = input.duration || 600; // Default 10 mins if unknown
  
  // Resolve Region Configuration
  const config = REGION_CONFIGS[region] || REGION_CONFIGS['US'];

  const basePrompt = `
    You are an expert film certification and content rating specialist with deep knowledge of global regulatory standards (MPAA, BBFC, CBFC, FSK, EIRIN).
    Analyze the provided content for content certification purposes.
    
    ${config.instructions}
    
    The content includes ${input.images ? 'visual frames ' : ''} ${input.audio ? 'and an audio track' : ''}.

    **ADVANCED ANALYSIS REQUIREMENTS:**
    1. **Audio Sentiment & Tone Mapping:** 
       - Distinguish between "aggressive/hateful" speech and "comedic/casual" swearing.
       - Analyze the intent behind profanity. Note if it is used for humor, characterization, or to demean.
    2. **Cultural Nuance Engine:**
       - Look for region-specific sensitivities: religious symbols, smoking/tobacco (CRITICAL for India), or cultural gestures.
    3. **Thematic Intensity (Vibe Analytics):**
       - Measure "thematic intensity" such as "dread factor" or "sustained psychological tension."
    4. **Synthetic Content (Deepfake/SGI) Detection:**
       - Identify any synthetic content, deepfakes, or de-aged faces. This is critical for compliance with 2026 IT Rules.
    5. **Financial Impact Prediction:**
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

  // Construct parts for Gemini
  const parts: any[] = [{ text: basePrompt }];

  // Add Visuals
  if (input.images) {
    input.images.forEach(base64Data => {
      // Strip header if present (data:image/jpeg;base64,)
      const cleanData = base64Data.split(',')[1] || base64Data;
      parts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: cleanData
        }
      });
    });
  }

  // Add Audio
  if (input.audio) {
    parts.push({
        inlineData: {
            mimeType: 'audio/wav',
            data: input.audio
        }
    });
  }

  try {
    // Wrap the API call in our retry logic
    const resultText = await withRetry(async () => {
        const response = await ai.models.generateContent({
          model: modelName,
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

    // Map parsed data to our internal structure with fail-safes
    const triggers: ContentTrigger[] = (parsed.triggers || []).map((t: any, idx: number) => ({
      ...t,
      id: `trig-${idx}-${Date.now()}`,
      timestamp: Math.floor(Math.random() * duration) // Fallback for timestamps if AI doesn't return them precisely
    }));

    const suggestedCuts: SuggestedCut[] = (parsed.suggestedCuts || []).map((c: any, idx: number) => ({
      ...c,
      id: `cut-${idx}-${Date.now()}`
    }));

    return {
      overallRating: parsed.overallRating as Rating,
      score: parsed.score || 0,
      summary: parsed.summary || "Analysis complete.",
      detailedAnalysis: parsed.detailedAnalysis || parsed.summary || "No detailed report available.", 
      triggers: triggers,
      suggestedCuts: suggestedCuts,
      culturalNotes: parsed.culturalNotes || "No specific cultural notes.",
      thematicIntensity: parsed.thematicIntensity || { dread: 0, tension: 0, melancholy: 0 },
      syntheticContent: (parsed.syntheticContent || []).map((s: any, idx: number) => ({
        ...s,
        id: `synth-${idx}-${Date.now()}`
      })),
      financialImpact: parsed.financialImpact
    };

  } catch (error: any) {
    console.error("Gemini Analysis Failed after Retries:", error);
    const isSafetyError = error.message?.includes("SAFETY");
    return {
      overallRating: Rating.Unrated,
      score: 0,
      summary: isSafetyError 
        ? "Analysis blocked by AI Safety Filters. The content may be too explicit for the current model configuration." 
        : "System is experiencing heavy load or connectivity issues. Please try again.",
      detailedAnalysis: error.message || "Unknown error occurred.",
      triggers: [],
      suggestedCuts: [],
      culturalNotes: "Error Code: " + (error.status || 'Client_Error'),
      thematicIntensity: { dread: 0, tension: 0, melancholy: 0 },
      syntheticContent: []
    };
  }
};

/**
 * Retrieves historical certification data for a movie title.
 * Acts as a Machine Learning Model Database by querying the LLM's knowledge base.
 */
export const getMovieCertificates = async (title: string): Promise<MovieKnowledge | null> => {
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
        const response = await ai.models.generateContent({
          model: modelName,
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