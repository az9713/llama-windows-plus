// Core of the four Llama bookmarks-bar buttons. llama-buttons.html turns this function into
// self-contained javascript: bookmarks; check.js tests it with a fake window.
// Each bookmark runs: llamaButton({ instruction: "..." }).go()
// It opens Llama's chat page (served by the Llama server) in its own browser window and sends the
// prompt there: ?q= sends it at once, ?load=true loads the model first if none is loaded.
function llamaButton(cfg, w) {
  w = w || window;
  var d = w.document;
  var SERVER = 'http://127.0.0.1:9931/';
  var MODEL = cfg.model || 'ggml-org/gemma-3-4b-it-qat-GGUF:Q4_0';
  var MAX_URL = 30000; // tested 2026-10-25: the server answered a 30,000-character address
  // The model reads 4096 tokens (prompt + answer). Wikipedia text measured 2.7 characters per token
  // (12,000 characters = 4,421 tokens, refused), so 7,000 characters leaves room for the answer.
  var MAX_TEXT = 7000;
  var CUT = '\n\n[The text was cut. Only the start is included.]';

  function isPassword(el) { return !!el && el.type === 'password'; }
  function boxSelection(el) {
    try {
      if (el && !isPassword(el) && typeof el.value === 'string' && el.selectionEnd > el.selectionStart) {
        return el.value.slice(el.selectionStart, el.selectionEnd);
      }
    } catch (e) {} // input types such as number have no selection
    return '';
  }
  function selection(win) {
    if (isPassword(win.document.activeElement)) return ''; // Chrome reports a password selection as dots
    var t = String(win.getSelection ? win.getSelection() : '');
    if (!t.trim()) t = boxSelection(win.document.activeElement);
    if (!t.trim()) {
      var frames = win.document.querySelectorAll('iframe,frame');
      for (var i = 0; i < frames.length && !t.trim(); i++) {
        try { t = selection(frames[i].contentWindow); } catch (e) {} // a frame from another site throws
      }
    }
    return t;
  }
  function linkFor(prompt) {
    return SERVER + '?model=' + encodeURIComponent(MODEL) + '&load=true&q=' + encodeURIComponent(prompt);
  }

  var text = selection(w).trim();
  var whole = !text;
  if (whole) {
    // Send the main content, not the menus and footers. A feed has many <article>s: use one only if it is the only one.
    var arts = d.querySelectorAll('article');
    var main = d.querySelector('main, [role="main"]') || (arts.length === 1 ? arts[0] : null);
    var mainText = ((main && main.innerText) || '').trim();
    text = mainText.length >= 500 ? mainText : ((d.body && d.body.innerText) || '').trim();
  }
  text = text.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n');
  var head = cfg.instruction + '\n\n' + (whole ? 'Title: ' + d.title + '\n\n' : '');
  var prompt = text.length > MAX_TEXT ? head + text.slice(0, MAX_TEXT) + CUT : head + text;

  // Text in a non-Latin script encodes to up to 9 characters per letter: cut until the address fits.
  if (linkFor(prompt).length > MAX_URL) {
    var lo = 0, hi = Math.min(text.length, MAX_TEXT);
    while (lo < hi) {
      var mid = Math.ceil((lo + hi) / 2);
      if (linkFor(head + text.slice(0, mid) + CUT).length <= MAX_URL) lo = mid; else hi = mid - 1;
    }
    prompt = head + text.slice(0, lo) + CUT;
  }
  var url = linkFor(prompt);
  return {
    prompt: prompt, url: url,
    go: function () {
      var s = w.screen || {}, width = 560, height = Math.min(820, (s.availHeight || 900) - 60);
      var left = (s.availLeft || 0) + Math.max(0, (s.availWidth || 1200) - width - 24);
      var top = (s.availTop || 0) + 24;
      // One named window, reused by each click: you can move, resize and minimize it.
      // Each open chat window keeps one connection to the server, and Chrome allows 6 for each
      // server: with a new window per click, the 5th click got no answer (tested 2026-10-25).
      var win = w.open(url, 'llama-chat', 'popup,width=' + width + ',height=' + height + ',left=' + left + ',top=' + top);
      if (win) win.focus();
    }
  };
}

if (typeof module !== 'undefined') module.exports = llamaButton;
