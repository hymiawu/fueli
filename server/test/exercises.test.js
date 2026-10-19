import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const { exercises } = JSON.parse(readFileSync(new URL('../src/data/exercises.json', import.meta.url), 'utf8'));
const LEVELS = ['beginner', 'intermediate', 'expert'];

test('exercise library has 57 unique exercises', () => {
  assert.equal(exercises.length, 57);
  assert.equal(new Set(exercises.map((e) => e.id)).size, 57);
});

test('every exercise has steps, a main muscle, a known level and two photo links', () => {
  for (const e of exercises) {
    assert.ok(e.name && e.instructions.length > 0, e.id);
    assert.ok(e.primaryMuscles.length > 0, e.id);
    assert.ok(LEVELS.includes(e.level), e.id);
    assert.equal(e.images.length, 2, e.id);
    for (const url of e.images) assert.match(url, /^https:\/\/raw\.githubusercontent\.com\/yuhonas\/free-exercise-db\/main\/exercises\/.+\.jpg$/);
  }
});

test('library covers every level so the level cap can be tested', () => {
  for (const level of LEVELS) assert.ok(exercises.some((e) => e.level === level), level);
});
