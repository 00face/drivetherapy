import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CASTOR_EXPRESSIONS,
  CASTOR_OUTFITS,
  buildCastorPersonaDirective,
  detectCastorOutfitCommand,
  extractCastorMoodTag,
  getCastorSpriteUrl,
  resolveCastorExpression,
} from '../src/services/castorAgent';

describe('Castor Custom Agent (24 Outfits × 16 Expressions)', () => {
  it('defines all 24 outfits (C-01..C-24) and all 16 expressions (01_Neutral..16_Skeptical)', () => {
    assert.equal(CASTOR_OUTFITS.length, 24);
    assert.equal(CASTOR_OUTFITS[0].id, 'C-01');
    assert.equal(CASTOR_OUTFITS[23].id, 'C-24');

    assert.equal(CASTOR_EXPRESSIONS.length, 16);
    assert.equal(CASTOR_EXPRESSIONS[0].id, '01_Neutral');
    assert.equal(CASTOR_EXPRESSIONS[15].id, '16_Skeptical');

    assert.equal(
      getCastorSpriteUrl('C-02', '07_Proud'),
      '/api/castor/sprite/C-02/07_Proud.png?v=bust2'
    );
    // Invalid outfit falls back cleanly to C-01
    assert.equal(
      getCastorSpriteUrl('../etc/passwd', '02_Happy'),
      '/api/castor/sprite/C-01/02_Happy.png?v=bust2'
    );
  });

  it('resolves reactive Castor expressions for request and response events', () => {
    assert.equal(resolveCastorExpression('thinking'), '15_Curious');
    assert.equal(resolveCastorExpression('style_success'), '06_Excited');
    assert.equal(resolveCastorExpression('outfit_changed'), '07_Proud');
    assert.equal(resolveCastorExpression('search_found'), '03_Confident');
    assert.equal(resolveCastorExpression('access_request'), '14_Confused');
    assert.equal(resolveCastorExpression('destructive_guard'), '16_Skeptical');
    assert.equal(resolveCastorExpression('error'), '10_Frustrated');
    assert.equal(resolveCastorExpression('audit_confident', 'Thanks Castor, that was stellar!'), '04_Relieved');
  });

  it('extracts and strips optional [CASTOR_MOOD:XX_Name] tags from live Gemini responses', () => {
    const parsed = extractCastorMoodTag('[CASTOR_MOOD:05_Laughing] Found all 3 copies of your resume!');
    assert.equal(parsed.expressionId, '05_Laughing');
    assert.equal(parsed.cleanText, 'Found all 3 copies of your resume!');

    const plain = extractCastorMoodTag('No mood prefix here.');
    assert.equal(plain.expressionId, null);
    assert.equal(plain.cleanText, 'No mood prefix here.');
  });

  it('detects natural-language and ID-based wardrobe switch commands', () => {
    assert.equal(detectCastorOutfitCommand('Castor, switch to your EVA suit')?.id, 'C-02');
    assert.equal(detectCastorOutfitCommand('wear C-24 please')?.id, 'C-24');
    assert.equal(detectCastorOutfitCommand('put on the winter bomber')?.id, 'C-13');
    assert.equal(detectCastorOutfitCommand('find a picture of a cat in my google photos'), null);
  });

  it('builds a concise Castor persona directive including the active outfit', () => {
    const directive = buildCastorPersonaDirective('C-02');
    assert.ok(directive.includes('Castor'));
    assert.ok(directive.includes('C-02: Heavy EVA Combat Suit'));
    assert.ok(directive.includes('Sacred Non-Destructive Integrity'));
    assert.ok(directive.includes('[CASTOR_MOOD:XX_Name]'));
  });
});
