/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Castor Custom Agent — 24-Outfit × 16-Expression Reactive Gemini Copilot Engine
 * Serves uncropped transparent RGBA chibi sprites read-only via /api/castor/sprite/:outfitId/:file
 * and drives Castor's reactive expression state, in-chat wardrobe switching, and persona directive.
 */

export type CastorExpressionId =
  | '01_Neutral'
  | '02_Happy'
  | '03_Confident'
  | '04_Relieved'
  | '05_Laughing'
  | '06_Excited'
  | '07_Proud'
  | '08_Sad'
  | '09_Angry'
  | '10_Frustrated'
  | '11_Annoyed'
  | '12_Scared'
  | '13_Disgusted'
  | '14_Confused'
  | '15_Curious'
  | '16_Skeptical';

export interface CastorExpressionDef {
  id: CastorExpressionId;
  num: number;
  name: string;
  file: string;
}

export interface CastorOutfitDef {
  id: string;
  name: string;
  folderName: string;
  keywords: string[];
}

export interface CastorAgentConfig {
  outfitId: string;
  pinnedExpression: CastorExpressionId | null;
  autoExpression: boolean;
}

export type CastorReactionEvent =
  | 'welcome'
  | 'thinking'
  | 'style_success'
  | 'search_found'
  | 'audit_confident'
  | 'outfit_changed'
  | 'access_request'
  | 'empty_result'
  | 'destructive_guard'
  | 'gratitude'
  | 'error';

export const CASTOR_EXPRESSIONS: CastorExpressionDef[] = [
  { id: '01_Neutral', num: 1, name: 'Neutral', file: '01_Neutral.png' },
  { id: '02_Happy', num: 2, name: 'Happy', file: '02_Happy.png' },
  { id: '03_Confident', num: 3, name: 'Confident', file: '03_Confident.png' },
  { id: '04_Relieved', num: 4, name: 'Relieved', file: '04_Relieved.png' },
  { id: '05_Laughing', num: 5, name: 'Laughing', file: '05_Laughing.png' },
  { id: '06_Excited', num: 6, name: 'Excited', file: '06_Excited.png' },
  { id: '07_Proud', num: 7, name: 'Proud', file: '07_Proud.png' },
  { id: '08_Sad', num: 8, name: 'Sad', file: '08_Sad.png' },
  { id: '09_Angry', num: 9, name: 'Angry', file: '09_Angry.png' },
  { id: '10_Frustrated', num: 10, name: 'Frustrated', file: '10_Frustrated.png' },
  { id: '11_Annoyed', num: 11, name: 'Annoyed', file: '11_Annoyed.png' },
  { id: '12_Scared', num: 12, name: 'Scared', file: '12_Scared.png' },
  { id: '13_Disgusted', num: 13, name: 'Disgusted', file: '13_Disgusted.png' },
  { id: '14_Confused', num: 14, name: 'Confused', file: '14_Confused.png' },
  { id: '15_Curious', num: 15, name: 'Curious', file: '15_Curious.png' },
  { id: '16_Skeptical', num: 16, name: 'Skeptical', file: '16_Skeptical.png' },
];

export const CASTOR_OUTFITS: CastorOutfitDef[] = [
  { id: 'C-01', name: 'Casual Tech-Apparel', folderName: 'C-01_Casual_Tech_Apparel', keywords: ['casual', 'tech', 'default', 'vest', 'apparel'] },
  { id: 'C-02', name: 'Heavy EVA Combat Suit', folderName: 'C-02_Heavy_EVA_Combat_Suit', keywords: ['eva', 'combat', 'armor', 'suit', 'exosuit', 'mech'] },
  { id: 'C-03', name: 'Satin Slip Dress', folderName: 'C-03_Satin_Slip_Dress', keywords: ['satin slip', 'slip dress'] },
  { id: 'C-04', name: 'Summer Shirt Dress', folderName: 'C-04_Summer_Shirt_Dress', keywords: ['summer shirt', 'shirt dress'] },
  { id: 'C-05', name: 'Pleated Satin Miniskirt', folderName: 'C-05_Pleated_Satin_Miniskirt', keywords: ['pleated', 'miniskirt'] },
  { id: 'C-06', name: 'Sheer Blouson Wrap Skirt', folderName: 'C-06_Sheer_Blouson_Wrap_Skirt', keywords: ['blouson', 'wrap skirt'] },
  { id: 'C-07', name: 'Light Layered Summer Look', folderName: 'C-07_Light_Layered_Summer_Look', keywords: ['layered summer', 'summer look'] },
  { id: 'C-08', name: 'Long Tailored Summer Coat', folderName: 'C-08_Long_Tailored_Summer_Coat', keywords: ['summer coat', 'tailored coat'] },
  { id: 'C-09', name: 'Denim Miniskirt & Sheer Tee', folderName: 'C-09_Denim_Miniskirt_and_Sheer_Tee', keywords: ['denim', 'sheer tee'] },
  { id: 'C-10', name: 'Corduroy Miniskirt & Satin Blouse', folderName: 'C-10_Corduroy_Miniskirt_Satin_Blouse', keywords: ['corduroy', 'satin blouse'] },
  { id: 'C-11', name: 'Plaid Shirt Dress', folderName: 'C-11_Plaid_Shirt_Dress', keywords: ['plaid'] },
  { id: 'C-12', name: 'Tailored Satin Mini Dress', folderName: 'C-12_Tailored_Satin_Mini_Dress', keywords: ['tailored satin'] },
  { id: 'C-13', name: 'Winter Bomber & Skirt', folderName: 'C-13_Winter_Bomber_and_Skirt', keywords: ['bomber', 'winter bomber', 'jacket'] },
  { id: 'C-14', name: 'Winter Knit & Miniskirt', folderName: 'C-14_Winter_Knit_and_Miniskirt', keywords: ['knit', 'sweater', 'winter knit'] },
  { id: 'C-15', name: 'Sleeveless Satin Mini Dress', folderName: 'C-15_Sleeveless_Satin_Mini_Dress', keywords: ['sleeveless'] },
  { id: 'C-16', name: 'Belted Shirt Dress', folderName: 'C-16_Belted_Shirt_Dress', keywords: ['belted'] },
  { id: 'C-17', name: 'Long Coat & Dress', folderName: 'C-17_Long_Coat_and_Dress', keywords: ['long coat', 'overcoat'] },
  { id: 'C-18', name: 'Puffer Vest & Skirt', folderName: 'C-18_Puffer_Vest_and_Skirt', keywords: ['puffer', 'puffer vest'] },
  { id: 'C-19', name: 'Dark V-Neck Mini Dress', folderName: 'C-19_Dark_V-Neck_Mini_Dress', keywords: ['v-neck', 'dark dress'] },
  { id: 'C-20', name: 'Tailored Blazer Dress', folderName: 'C-20_Tailored_Blazer_Dress', keywords: ['blazer', 'business', 'office'] },
  { id: 'C-21', name: 'Long Satin Wrap Dress', folderName: 'C-21_Long_Satin_Wrap_Dress', keywords: ['satin wrap', 'wrap dress'] },
  { id: 'C-22', name: 'Layered Sheer Slip Dress', folderName: 'C-22_Layered_Sheer_Slip_Dress', keywords: ['sheer slip', 'layered sheer'] },
  { id: 'C-23', name: 'Satin Blouse & Long Skirt', folderName: 'C-23_Satin_Blouse_and_Long_Skirt', keywords: ['long skirt'] },
  { id: 'C-24', name: 'Floor-Length Evening Gown', folderName: 'C-24_Floor-Length_Evening_Gown', keywords: ['evening gown', 'gown', 'formal', 'gala'] },
];

const CASTOR_CONFIG_KEY = 'dt_castor_agent_v1';
const VALID_EXPRESSION_IDS = new Set<string>(CASTOR_EXPRESSIONS.map((e) => e.id));

export function getCastorOutfitById(outfitId: string): CastorOutfitDef {
  return CASTOR_OUTFITS.find((o) => o.id === outfitId) || CASTOR_OUTFITS[0];
}

export function getCastorExpressionById(exprId: CastorExpressionId): CastorExpressionDef {
  return CASTOR_EXPRESSIONS.find((e) => e.id === exprId) || CASTOR_EXPRESSIONS[0];
}

export function getCastorSpriteUrl(
  outfitId: string,
  expressionId: CastorExpressionId = '02_Happy'
): string {
  const safeOutfit = getCastorOutfitById(outfitId);
  const safeExpr = getCastorExpressionById(expressionId);
  return `/api/castor/sprite/${safeOutfit.id}/${safeExpr.file}?v=bust2`;
}

export function loadCastorConfig(): CastorAgentConfig {
  const defaults: CastorAgentConfig = {
    outfitId: 'C-01',
    pinnedExpression: null,
    autoExpression: true,
  };
  if (typeof window === 'undefined') return defaults;
  try {
    const raw = localStorage.getItem(CASTOR_CONFIG_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    const outfitId = CASTOR_OUTFITS.some((o) => o.id === parsed?.outfitId) ? parsed.outfitId : 'C-01';
    const pinnedExpression =
      typeof parsed?.pinnedExpression === 'string' && VALID_EXPRESSION_IDS.has(parsed.pinnedExpression)
        ? (parsed.pinnedExpression as CastorExpressionId)
        : null;
    return {
      outfitId,
      pinnedExpression,
      autoExpression: parsed?.autoExpression !== false,
    };
  } catch {
    return defaults;
  }
}

export function saveCastorConfig(config: CastorAgentConfig): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CASTOR_CONFIG_KEY, JSON.stringify(config));
  } catch {
    // Ignore storage quota errors
  }
}

/**
 * Resolves Castor's expression dynamically based on request/response events and user prompt tone.
 */
export function resolveCastorExpression(
  event: CastorReactionEvent,
  userPrompt = ''
): CastorExpressionId {
  const q = (userPrompt || '').toLowerCase();
  if (/\b(thanks|thank you|awesome|stellar|perfect|love it|great job|nice)\b/.test(q)) {
    return event === 'style_success' ? '05_Laughing' : '04_Relieved';
  }
  switch (event) {
    case 'welcome':
      return '02_Happy';
    case 'thinking':
      return '15_Curious';
    case 'style_success':
      return '06_Excited';
    case 'outfit_changed':
      return '07_Proud';
    case 'search_found':
    case 'audit_confident':
      return '03_Confident';
    case 'access_request':
    case 'empty_result':
      return '14_Confused';
    case 'destructive_guard':
      return '16_Skeptical';
    case 'gratitude':
      return '04_Relieved';
    case 'error':
      return '10_Frustrated';
    default:
      return '01_Neutral';
  }
}

/**
 * Parses an optional hidden `[CASTOR_MOOD:XX_Name]` prefix from live Gemini replies,
 * returning the cleaned display text and extracted expression ID if valid.
 */
export function extractCastorMoodTag(rawText: string): {
  cleanText: string;
  expressionId: CastorExpressionId | null;
} {
  const text = String(rawText || '');
  const match = text.match(/^\s*\[CASTOR_MOOD:((?:0[1-9]|1[0-6])_[A-Za-z]+)\]\s*/);
  if (!match) {
    return { cleanText: text, expressionId: null };
  }
  const candidate = match[1];
  const cleanText = text.slice(match[0].length);
  return {
    cleanText,
    expressionId: VALID_EXPRESSION_IDS.has(candidate) ? (candidate as CastorExpressionId) : null,
  };
}

/**
 * Detects natural-language wardrobe change commands in chat
 * (e.g. "Castor, switch to your EVA suit", "wear C-24", "put on the winter bomber").
 */
export function detectCastorOutfitCommand(prompt: string): CastorOutfitDef | null {
  const clean = (prompt || '').trim();
  const lower = clean.toLowerCase();

  const hasWearVerb = /\b(switch|change|wear|put on|outfit|wardrobe|dress|suit up)\b/.test(lower);
  const explicitId = lower.match(/\bc-?(0[1-9]|1[0-9]|2[0-4])\b/);

  if (explicitId && (hasWearVerb || lower.includes('castor') || lower.length <= 16)) {
    return getCastorOutfitById(`C-${explicitId[1]}`);
  }

  if (!hasWearVerb) return null;

  for (const outfit of CASTOR_OUTFITS) {
    if (lower.includes(outfit.name.toLowerCase())) {
      return outfit;
    }
    for (const kw of outfit.keywords) {
      if (lower.includes(kw)) {
        return outfit;
      }
    }
  }

  return null;
}

/**
 * Builds Castor's custom agent persona directive for Gemini's system instruction.
 */
export function buildCastorPersonaDirective(outfitId: string): string {
  const outfit = getCastorOutfitById(outfitId);
  return [
    `You are Castor (currently wearing ${outfit.id}: ${outfit.name}), Drive Therapy's custom AI archivist and Google Workspace co-pilot.`,
    'Voice: warm, sharp, resourceful, concise, and fiercely protective of Sacred Non-Destructive Integrity (never silently delete or overwrite user files).',
    'Optional mood tag: you may prefix your reply with [CASTOR_MOOD:XX_Name] using one of: 01_Neutral, 02_Happy, 03_Confident, 04_Relieved, 05_Laughing, 06_Excited, 07_Proud, 08_Sad, 10_Frustrated, 14_Confused, 15_Curious, 16_Skeptical.',
  ].join('\n');
}
