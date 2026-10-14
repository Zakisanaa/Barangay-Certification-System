import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPasswordRecoveryState } from '../src/app/passwordRecoveryState.ts';

function browserAt(search = '', hash = '') {
  const values = new Map();
  return { location: { search, hash }, values, sessionStorage: {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
  } };
}

test('recovery survives Supabase removing the fragment and a page refresh', () => {
  const browser = browserAt('', '#access_token=test-token&type=recovery&refresh_token=test-refresh');
  const initial = createPasswordRecoveryState(browser);
  browser.location.hash = '';
  assert.equal(initial.getSnapshot(), true);
  assert.deepEqual([...browser.values.values()], ['1']);
  const refreshed = createPasswordRecoveryState(browser);
  assert.equal(refreshed.getSnapshot(), true);
  refreshed.clear();
  assert.equal(createPasswordRecoveryState(browser).getSnapshot(), false);
});

test('early recovery events are retained for subscribers mounted later', () => {
  const state = createPasswordRecoveryState(browserAt());
  state.begin();
  assert.equal(state.getSnapshot(), true);
  let updates = 0;
  const unsubscribe = state.subscribe(() => updates++);
  state.clear();
  assert.equal(updates, 1);
  assert.equal(state.getSnapshot(), false);
  unsubscribe();
  state.begin();
  assert.equal(updates, 1);
});

test('explicit reset links work with blocked storage; ordinary sign-in links stay ordinary', () => {
  const browser = browserAt('?recovery=1&staff=1');
  Object.defineProperty(browser, 'sessionStorage', { get() { throw new Error('Storage blocked'); } });
  assert.equal(createPasswordRecoveryState(browser).getSnapshot(), true);
  assert.equal(createPasswordRecoveryState(browserAt('', '#type=signup')).getSnapshot(), false);
  assert.equal(createPasswordRecoveryState(browserAt('', '#type=magiclink')).getSnapshot(), false);
});
