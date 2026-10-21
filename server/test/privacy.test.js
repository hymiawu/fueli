import { test } from 'node:test';
import assert from 'node:assert/strict';
import { redactPII, cleanText, stripImageMetadata, cleanImage } from '../src/guard.js';
import { mealCalorieTarget, planMeals } from '../src/agents/mealPlanner.js';
import { summarizeFridge } from '../src/tools/fridge.js';

test('personal identifiers are redacted from text sent to the model', () => {
  const out = redactPII('Email me at jane@example.com or call +1 (310) 555-0123, see https://x.com/me @janedoe');
  assert.ok(!out.includes('example.com') && !out.includes('555') && !out.includes('x.com') && !out.includes('@janedoe'));
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
    chunk('IHDR', 'header'), chunk('tEXt', 'Author\0Jane'), chunk('eXIf', 'GPS'), chunk('IDAT', 'pixels'), chunk('IEND', ''),
  ]);
  const out = stripImageMetadata(png).toString('latin1');
  assert.ok(!out.includes('Jane') && !out.includes('GPS'));
  assert.ok(out.includes('IHDR') && out.includes('pixels') && out.includes('IEND'));
});

test('meal calorie target replaces body measurements', () => {
  assert.equal(mealCalorieTarget({ weight: '62', activity: 'Moderately Active', goal: 'Build Muscle' }), 750);
  assert.equal(mealCalorieTarget({ weight: '', activity: 'Sedentary' }), null);
});

test('gender adjusts the calorie target: Female 10% lower, Male and no answer unchanged', () => {
  const p = { weight: '62', activity: 'Moderately Active', goal: 'Build Muscle' };
  assert.equal(mealCalorieTarget({ ...p, gender: 'Female' }), 700);
  assert.equal(mealCalorieTarget({ ...p, gender: 'Male' }), 750);
  assert.equal(mealCalorieTarget({ ...p, gender: 'Prefer not to say' }), 750);
  assert.equal(mealCalorieTarget(p), 750);
});

test('the meal prompt carries no height, weight or gender', async () => {
  const sent = [];
  const meal = { name: 'Tofu bowl', type: 'Dinner', ingredients: ['150g tofu'], structuredIngredients: [{ name: 'tofu', quantity: 150, unit: 'g' }], recipe: 'Step 1: Cook.', calories: 500, protein: 30, carbs: 40, fat: 15, prepTime: '15 min', missingIngredients: [] };
  const capture = async (args) => { sent.push(JSON.stringify(args.messages)); return { meals: [meal] }; };
  const profile = { height: '163', weight: '62', gender: 'Female', activity: 'Moderately Active', goal: 'Build Muscle', diet: 'No Restriction' };
  await planMeals({ fridge: [{ name: 'tofu', quantity: '400', unit: 'g' }], profile, neededTypes: ['Dinner'], useLibrary: false }, { runAgent: capture, jsonCompletion: capture });
  const prompt = sent.join(' ');
  assert.ok(prompt.includes('approxCaloriesPerMeal'), 'the calorie target is sent');
  assert.doesNotMatch(prompt, /163|"weight"|"height"|gender|female/i);
});

test('only JPEG, PNG, GIF and WebP images are accepted', () => {
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(200)]);
  assert.ok(cleanImage(png.toString('base64')));
  const heic = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypheic', 'latin1'), Buffer.alloc(200)]);
  assert.throws(() => cleanImage(heic.toString('base64')), (e) => e.status === 400 && /JPEG, PNG, GIF or WebP/.test(e.message));
});
