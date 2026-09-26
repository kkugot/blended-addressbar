const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { runInNewContext } = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

test('Zen checkbox and Sine preference stay in sync and clean up on unload', () => {
  const pref = 'uc.blended-addressbar.split-focus-on-hover';
  let saved = false;
  const observers = new Set();
  const elements = new Map();
  const pane = { hidden: false, after(element) { elements.set(element.id, element); } };
  const document = {
    documentElement: {},
    querySelector(selector) {
      return selector === 'setting-pane[data-category="paneTabsBrowsing"]' ? pane : null;
    },
    getElementById(id) { return elements.get(id) ?? null; },
    createElementNS(_namespace, tag) { return element(tag); },
    createXULElement(tag) { return element(tag); },
    addEventListener() {}, removeEventListener() {},
  };
  function element(tag) {
    return {
      tag, style: {}, children: [], listeners: new Map(),
      setAttribute() {},
      append(...children) { this.children.push(...children); },
      addEventListener(name, callback) { this.listeners.set(name, callback); },
      remove() { elements.delete(this.id); },
    };
  }
  const Services = { prefs: {
    getBoolPref(name, fallback) { return name === pref ? saved : fallback; },
    setBoolPref(name, value) {
      assert.equal(name, pref);
      saved = value;
      for (const observer of observers) observer.observe();
    },
    addObserver(name, observer) { assert.equal(name, pref); observers.add(observer); },
    removeObserver(name, observer) { assert.equal(name, pref); observers.delete(observer); },
  } };
  const window = { addEventListener() {}, removeEventListener() {} };
  class MutationObserver { observe() {} disconnect() {} }

  const source = readFileSync(join(__dirname, '..', 'hover-settings.uc.js'), 'utf8');
  runInNewContext(source, { document, window, Services, MutationObserver });
  const section = document.getElementById('blended-split-hover-settings');
  assert.ok(section);
  const checkbox = section.children[0].children[0].children[0].children[0];
  assert.equal(checkbox.checked, false);
  checkbox.checked = true;
  checkbox.listeners.get('change')();
  assert.equal(saved, true);
  Services.prefs.setBoolPref(pref, false);
  assert.equal(checkbox.checked, false);
  window.BlendedSplitHoverSettings.destroy();
  assert.equal(document.getElementById('blended-split-hover-settings'), null);
  assert.equal(observers.size, 0);
});
