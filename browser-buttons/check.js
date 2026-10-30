// Run: node check.js   -> prints CHECK_OK, or throws on the first failure.
const assert = require('assert');
const llamaButton = require('./buttons.js');

function fakeWindow({ sel = '', body = '', title = 'Page' } = {}) {
  return {
    document: { title, body: { innerText: body }, activeElement: null, main: null, articles: [],
      querySelector(s) { return s === 'main, [role="main"]' ? this.main : null; },
      querySelectorAll(s) { return s === 'article' ? this.articles : []; } },
    getSelection: () => sel,
    location: {},
    opened: null,
    open(url, name, features) { this.opened = { url, name, features }; return { focus() {} }; },
  };
}
const PREFIX = 'http://127.0.0.1:9931/?model=ggml-org%2Fgemma-3-4b-it-qat-GGUF%3AQ4_0&load=true&q=';
const decode = (url) => { assert.ok(url.startsWith(PREFIX), url.slice(0, 90)); return decodeURIComponent(url.slice(PREFIX.length)); };
const cfg = { instruction: 'Explain this in plain language:' };
const CUT = '\n\n[The text was cut. Only the start is included.]';

// 1. Short selection -> the exact prompt, and go() opens one named popup window.
let w = fakeWindow({ sel: '  HbA1c 6.1% falls within the prediabetes range.  ' });
let r = llamaButton(cfg, w);
assert.strictEqual(decode(r.url), 'Explain this in plain language:\n\nHbA1c 6.1% falls within the prediabetes range.');
r.go(); assert.strictEqual(w.opened.url, r.url); assert.strictEqual(w.opened.name, 'llama-chat'); assert.ok(w.opened.features.startsWith('popup,'));

// 2. '+' is encoded as %2B (a raw '+' in an address query means a space).
r = llamaButton(cfg, fakeWindow({ sel: 'C++ and 1+1' }));
assert.ok(r.url.includes('C%2B%2B') && !r.url.includes('+'));

// 3. No selection -> whole page with its title.
r = llamaButton(cfg, fakeWindow({ body: 'Body text.', title: 'Bike lanes' }));
assert.strictEqual(r.prompt, 'Explain this in plain language:\n\nTitle: Bike lanes\n\nBody text.');

// 4. Selection in a text box is used when the page selection is empty.
w = fakeWindow();
w.document.activeElement = { value: 'abc HELLO xyz', selectionStart: 4, selectionEnd: 9 };
assert.strictEqual(llamaButton(cfg, w).prompt, 'Explain this in plain language:\n\nHELLO');

// 5. A password box is never read, and its dots are not sent.
w = fakeWindow({ sel: '•••••••••', body: 'Page.' });
w.document.activeElement = { type: 'password', value: 'secret123', selectionStart: 0, selectionEnd: 9 };
r = llamaButton(cfg, w);
assert.ok(!r.prompt.includes('secret') && !r.prompt.includes('•'));

// 6. Long English text (5,000 characters) goes in full.
const long = 'word '.repeat(1000).trim();
r = llamaButton(cfg, fakeWindow({ sel: long }));
assert.strictEqual(r.prompt, 'Explain this in plain language:\n\n' + long);
assert.ok(r.url.length <= 30000);

// 7. Page longer than 7,000 characters -> cut to 7,000 plus the note.
r = llamaButton(cfg, fakeWindow({ body: 'x'.repeat(20000), title: 'T' }));
assert.strictEqual(r.prompt, 'Explain this in plain language:\n\nTitle: T\n\n' + 'x'.repeat(7000) + CUT);

// 8. Chinese text (9 link characters per letter) is cut to fit 30,000, close to the limit.
r = llamaButton(cfg, fakeWindow({ sel: '中文'.repeat(4000) }));
assert.ok(r.url.length <= 30000 && r.url.length > 29900, `url length ${r.url.length}`);
assert.ok(r.prompt.endsWith(CUT));

// 9. German text fits, and the cut never splits a %XX sequence.
r = llamaButton(cfg, fakeWindow({ sel: 'Größe und Kaution für Haustiere. '.repeat(500) }));
assert.ok(r.url.length <= 30000);
assert.doesNotThrow(() => decode(r.url));

// 10. No selection: the <main> text is sent, not the menus. Too short a <main> -> the whole page.
const MAIN = 'Article text. '.repeat(50).trim();
w = fakeWindow({ body: 'Menu\n' + MAIN + '\nFooter', title: 'T' });
w.document.main = { innerText: MAIN };
assert.strictEqual(llamaButton(cfg, w).prompt, 'Explain this in plain language:\n\nTitle: T\n\n' + MAIN);
w.document.main = { innerText: 'Short.' };
assert.ok(llamaButton(cfg, w).prompt.includes('Menu'));

// 11. One <article> and no <main> -> the article. Two <article>s (a feed) -> the whole page.
w = fakeWindow({ body: 'Menu\n' + MAIN, title: 'T' });
w.document.articles = [{ innerText: MAIN }];
assert.ok(!llamaButton(cfg, w).prompt.includes('Menu'));
w.document.articles = [{ innerText: MAIN }, { innerText: 'Other post' }];
assert.ok(llamaButton(cfg, w).prompt.includes('Menu'));

// 12. The bookmark code that llama-buttons.html builds parses as JavaScript.
const code = '(' + llamaButton.toString() + ')(' + JSON.stringify(cfg) + ').go()';
const href = 'javascript:' + encodeURIComponent('void(' + code + ')');
assert.doesNotThrow(() => new Function(decodeURIComponent(href.slice('javascript:'.length))));
console.log(`CHECK_OK (bookmark length ${href.length} characters)`);
