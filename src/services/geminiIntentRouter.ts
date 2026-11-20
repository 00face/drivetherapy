/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Gemini Multi-Tool Intent Router
 * Classifies natural-language user prompts into actionable workspace intents:
 *  - 'google_photos_search'  (e.g. "find a picture of a cat in my google photos")
 *  - 'google_drive_search'   (e.g. "please locate copies of my resume in google drive")
 *  - 'image_style_transfer'  (e.g. "make the selected photo anime style")
 *  - 'destructive_guard'     (e.g. "delete all blurry photos" — refuses silent mutation)
 *  - 'workspace_chat'        (general harmonized index / storage / OAuth / catalog chat)
 */

import { detectRequestedArtStyle, type ArtStylePreset } from './localImageStylizer';

export type GeminiChatIntentType =
  | 'google_photos_search'
  | 'google_drive_search'
  | 'image_style_transfer'
  | 'destructive_guard'
  | 'workspace_chat';

export interface GeminiDetectedIntent {
  type: GeminiChatIntentType;
  extractedQuery: string;
  photosCategories: string[];
  artStyle?: ArtStylePreset;
}

const PHOTOS_CONCEPT_TO_CATEGORIES: Array<{ pattern: RegExp; categories: string[] }> = [
  { pattern: /\b(cat|cats|kitten|dog|dogs|puppy|pet|pets|animal|animals|bird|wildlife)\b/i, categories: ['PETS', 'ANIMALS'] },
  { pattern: /\b(beach|ocean|sea|mountain|forest|nature|landscape|sunset|sunrise|sky)\b/i, categories: ['LANDSCAPES'] },
  { pattern: /\b(city|building|street|architecture|urban|skyline)\b/i, categories: ['CITYSCAPES'] },
  { pattern: /\b(food|meal|dinner|lunch|coffee|restaurant|cake|pizza)\b/i, categories: ['FOOD'] },
  { pattern: /\b(selfie|selfies)\b/i, categories: ['SELFIES'] },
  { pattern: /\b(person|people|portrait|family|friend|friends|wedding|party)\b/i, categories: ['PEOPLE'] },
  { pattern: /\b(receipt|receipts|invoice|bill)\b/i, categories: ['RECEIPTS', 'DOCUMENTS'] },
  { pattern: /\b(document|documents|scan|whiteboard|screenshot|notes)\b/i, categories: ['DOCUMENTS'] },
  { pattern: /\b(flower|flowers|plant|garden)\b/i, categories: ['FLOWERS'] },
  { pattern: /\b(night|stars|astro|fireworks)\b/i, categories: ['NIGHT'] },
  { pattern: /\b(travel|vacation|trip|holiday|airport)\b/i, categories: ['TRAVEL'] },
];

export function mapPromptToPhotosCategories(prompt: string): string[] {
  const matched = new Set<string>();
  for (const rule of PHOTOS_CONCEPT_TO_CATEGORIES) {
    if (rule.pattern.test(prompt)) {
      for (const c of rule.categories) matched.add(c);
    }
  }
  return Array.from(matched);
}

function extractCleanSubjectQuery(prompt: string): string {
  return (prompt || '')
    .toLowerCase()
    .replace(/\b(in|from|on)\s+(my\s+)?(google\s+photos|google\s+drive|photos|drive)\b/gi, ' ')
    .replace(/\b(google\s+photos|google\s+drive)\b/gi, ' ')
    .replace(/\b(please|can you|could you|help me|locate|find|search|show|get|look for|where is|where are)\b/gi, ' ')
    .replace(/\b(copies of|copy of|a picture of|pictures of|a photo of|photos of|an image of|images of|my|the|all|some|any|a|an)\b/gi, ' ')
    .replace(/[^a-z0-9._\-\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function detectGeminiChatIntent(
  prompt: string,
  _hasAttachedAsset = false
): GeminiDetectedIntent {
  const clean = (prompt || '').trim();
  const lower = clean.toLowerCase();

  // 1. Sacred Non-Destructive Guardrail: never silently delete/overwrite/move user files
  if (/\b(delete|remove|erase|wipe|permanently\s+delete|trash\s+all|overwrite|destroy)\b/.test(lower) &&
      /\b(file|files|photo|photos|image|images|folder|drive|local|blurry|duplicate|duplicates)\b/.test(lower)) {
    return {
      type: 'destructive_guard',
      extractedQuery: extractCleanSubjectQuery(clean),
      photosCategories: [],
    };
  }

  // 2. Non-Destructive Image Style Transfer (e.g. "make the selected photo anime style")
  const hasStyleVerb = /\b(make|turn|convert|transform|stylize|style|render|restyle|filter|apply)\b/.test(lower);
  const hasStyleKeyword =
    /\b(anime|manga|ghibli|cel[\s-]?shad|cartoon|watercolor|water[\s-]?color|cyberpunk|neon|noir|sketch|pencil|vintage|retro|oil\s?paint|style)\b/.test(
      lower
    );
  const mentionsPhotoTarget = /\b(photo|image|picture|selected|this|attached|shot|frame)\b/.test(lower);
  if (hasStyleVerb && hasStyleKeyword && (mentionsPhotoTarget || _hasAttachedAsset)) {
    return {
      type: 'image_style_transfer',
      extractedQuery: clean,
      photosCategories: [],
      artStyle: detectRequestedArtStyle(clean),
    };
  }

  // 3. Google Photos Search (e.g. "find a picture of a cat in my google photos")
  if (/\bgoogle\s+photos\b/.test(lower) || (/\bphotos?\b/.test(lower) && /\b(find|search|locate|show)\b/.test(lower) && mapPromptToPhotosCategories(lower).length > 0)) {
    return {
      type: 'google_photos_search',
      extractedQuery: extractCleanSubjectQuery(clean),
      photosCategories: mapPromptToPhotosCategories(clean),
    };
  }

  // 4. Google Drive Live Search (e.g. "please locate copies of my resume in google drive")
  if (
    (/\bgoogle\s+drive\b/.test(lower) || /\bin\s+drive\b/.test(lower)) &&
    /\b(find|locate|search|show|copies|copy|resume|pdf|doc|docx|sheet|file|files|where)\b/.test(lower)
  ) {
    return {
      type: 'google_drive_search',
      extractedQuery: extractCleanSubjectQuery(clean),
      photosCategories: [],
    };
  }

  return {
    type: 'workspace_chat',
    extractedQuery: extractCleanSubjectQuery(clean),
    photosCategories: mapPromptToPhotosCategories(clean),
  };
}
