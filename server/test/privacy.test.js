import { test } from 'node:test';
import assert from 'node:assert/strict';
import { redactPII, cleanText, stripImageMetadata } from '../src/guard.js';
import { mealCalorieTarget } from '../src/agents/mealPlanner.js';
import { summarizeFridge } from '../src/tools/fridge.js';

test('personal identifiers are redacted from text sent to the model', () => {
  const out = redactPII('Email me at misia0517@gmail.com or call +1 (310) 555-0123, see https://x.com/me @misia');
  assert.ok(!out.includes('gmail') && !out.includes('555') && !out.includes('x.com') && !out.includes('@misia'));
  assert.match(out, /\[email\].*\[number\].*\[link\].*\[handle\]/);
});

test('ordinary food and fitness numbers are kept', () => {
  assert.equal(cleanText('Lose 3kg in 8 weeks, run 5km by 2026-11-30'), 'Lose 3kg in 8 weeks, run 5km by 2026-11-30');
  assert.equal(redactPII('200g chicken breast'), '200g chicken breast');
});

test('fridge item names are cleaned before reaching the prompt', () => {
  const [item] = summarizeFridge([{ name: "Mom's yogurt call 3105550123", quantity: '1', unit: 'pcs' }]);
  assert.equal(item.name, "Mom's yogurt call [number]");
});

test('JPEG EXIF and comments are removed, image data kept', () => {
  const seg = (marker, body) => Buffer.concat([Buffer.from([0xff, marker]), Buffer.from([0, body.length + 2]), Buffer.from(body)]);
  const jpeg = Buffer.concat([
    Buffer.from([0xff, 0xd8]),
    seg(0xe0, 'JFIF\0'),
    seg(0xe1, 'Exif\0\0GPS 34.07,-118.44'),
    seg(0xfe, 'comment'),
    seg(0xdb, 'quant'),
    Buffer.from([0xff, 0xda, 0, 4, 1, 2]),
    Buffer.from('pixels'),
    Buffer.from([0xff, 0xd9]),
  ]);
  const out = stripImageMetadata(jpeg).toString('latin1');
  assert.ok(!out.includes('GPS') && !out.includes('Exif') && !out.includes('comment'));
  assert.ok(out.includes('JFIF') && out.includes('quant') && out.includes('pixels'));
});

test('PNG text and EXIF chunks are removed', () => {
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    return Buffer.concat([len, Buffer.from(type, 'latin1'), Buffer.from(data, 'latin1'), Buffer.alloc(4)]);
  };
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', 'header'), chunk('tEXt', 'Author\0Misia'), chunk('eXIf', 'GPS'), chunk('IDAT', 'pixels'), chunk('IEND', ''),
  ]);
  const out = stripImageMetadata(png).toString('latin1');
  assert.ok(!out.includes('Misia') && !out.includes('GPS'));
  assert.ok(out.includes('IHDR') && out.includes('pixels') && out.includes('IEND'));
});

test('meal calorie target replaces body measurements', () => {
  assert.equal(mealCalorieTarget({ weight: '62', activity: 'Moderately Active', goal: 'Build Muscle' }), 750);
  assert.equal(mealCalorieTarget({ weight: '', activity: 'Sedentary' }), null);
});
