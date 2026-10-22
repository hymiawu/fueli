// Remembering a verified login token for 60 s (server/src/auth.js). No network.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cachedUser, rememberUser } from '../src/auth.js';

test('a verified token is reused for 60 seconds, then checked again', () => {
  const t0 = 1_000_000;
  assert.equal(cachedUser('tok-a', t0), null);
  rememberUser('tok-a', { id: 'u1' }, t0);
  assert.deepEqual(cachedUser('tok-a', t0 + 59_000), { id: 'u1' });
  assert.equal(cachedUser('tok-a', t0 + 61_000), null);
  assert.equal(cachedUser('tok-b', t0), null, 'another token is not affected');
});
