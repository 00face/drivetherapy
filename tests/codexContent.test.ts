import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CODEX_ENTRIES,
  getCodexTopicById,
  searchCodexEntries,
} from '../src/services/codexContent';

describe('Drive Therapy Codex Content & Contextual Help', () => {
  it('contains entries across walkthroughs, faq, glossary, and use-cases', () => {
    const categories = new Set(CODEX_ENTRIES.map((e) => e.category));
    assert.ok(categories.has('walkthroughs'));
    assert.ok(categories.has('faq'));
    assert.ok(categories.has('glossary'));
    assert.ok(categories.has('use-cases'));
  });

  it('resolves contextual semantic topics by topicId', () => {
    const mapTopic = getCodexTopicById('map-studio');
    const modelsTopic = getCodexTopicById('local-models');
    assert.equal(mapTopic.topicId, 'map-studio');
    assert.equal(modelsTopic.topicId, 'local-models');
    assert.ok(mapTopic.shortTooltip.length > 10);
    assert.ok(modelsTopic.bullets.length >= 2);
  });

  it('filters Codex entries by category and search query', () => {
    const gpxMatches = searchCodexEntries('GPX');
    assert.ok(gpxMatches.length >= 1);
    const glossaryOnly = searchCodexEntries('', 'glossary');
    assert.ok(glossaryOnly.every((e) => e.category === 'glossary'));
  });
});
