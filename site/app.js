(function () {
  'use strict';

  var briefs = [];
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  var q = document.getElementById('q');
  var clearBtn = document.getElementById('clear');
  var results = document.getElementById('results');
  var browse = document.getElementById('browse');
  var archiveList = document.getElementById('archive-list');
  var todayLabel = document.getElementById('today-label');

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function safeUrl(u) { return /^https?:\/\//i.test(u) ? u : '#'; }
  function reEscape(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  // Escape text, wrapping any search terms in <mark>.
  function hl(text, terms) {
    if (!terms || !terms.length) return esc(text);
    var re = new RegExp('(' + terms.map(reEscape).join('|') + ')', 'ig');
    return text.split(re).map(function (part, i) { return i % 2 ? '<mark>' + esc(part) + '</mark>' : esc(part); }).join('');
  }

  function storyHtml(s, terms) {
    var paras = s.body.split(/\n{2,}/).map(function (p) { return '<p>' + hl(p, terms) + '</p>'; }).join('');
    var src = s.sources.map(function (x) {
      return '<a href="' + esc(safeUrl(x.url)) + '">' + esc(x.label) + '</a>' + (x.date ? ' (' + esc(x.date) + ')' : '');
    }).join('; ');
    return '<article class="story">' +
      (s.tag ? '<div class="tag">' + hl(s.tag, terms) + '</div>' : '') +
      '<h3>' + hl(s.title, terms) + '</h3>' + paras +
      (s.check ? '<div class="check">NEEDS CHECK: ' + hl(s.check, terms) + '</div>' : '') +
      '<div class="src">Sources: ' + src + '</div></article>';
  }

  function dayBody(b, terms) {
    return b.stories.length ? b.stories.map(function (s) { return storyHtml(s, terms); }).join('') : '<p class="note">' + esc(b.note) + '</p>';
  }

  // ---- "Today's brief" vs "Latest brief" (India time) ----
  function istToday() {
    var d = new Date(Date.now() + 5.5 * 3600 * 1000);
    return d.toISOString().slice(0, 10);
  }
  function setLabel() {
    if (!briefs.length) return;
    todayLabel.textContent = briefs[0].date === istToday() ? "Today's brief" : 'Latest brief';
  }

  // ---- archive (older briefs, grouped by month) ----
  function renderArchive() {
    var older = briefs.slice(1);
    if (!older.length) {
      archiveList.innerHTML = '<p class="muted">This is the first brief. Earlier days will be listed here, newest first.</p>';
      return;
    }
    var html = '', lastMonth = '';
    older.forEach(function (b) {
      var key = b.date.slice(0, 7);
      if (key !== lastMonth) {
        lastMonth = key;
        html += '<h3 class="month">' + MONTHS[+key.slice(5) - 1] + ' ' + key.slice(0, 4) + '</h3>';
      }
      var heads = b.stories.length ? b.stories.map(function (s) { return s.title; }).join(' · ') : b.note;
      html += '<details class="day" id="d-' + b.date + '" data-date="' + b.date + '"><summary><span class="dl">' +
        esc(b.label) + '</span><span class="dh">' + esc(heads) + '</span></summary><div class="daybody"></div></details>';
    });
    archiveList.innerHTML = html;
  }

  // Fill a day's stories the first time it is opened.
  archiveList.addEventListener('toggle', function (e) {
    var d = e.target;
    if (!d.open || !d.matches || !d.matches('details.day')) return;
    var body = d.querySelector('.daybody');
    if (body.childNodes.length) return;
    var b = briefs.filter(function (x) { return x.date === d.getAttribute('data-date'); })[0];
    if (b) body.innerHTML = dayBody(b);
  }, true);

  function goTo(date) {
    if (!briefs.length) return;
    if (date === briefs[0].date) {
      document.getElementById('today').scrollIntoView();
      return;
    }
    var d = document.getElementById('d-' + date);
    if (d) { d.open = true; d.scrollIntoView(); }
  }
  function fromHash() {
    var m = /^#(\d{4}-\d{2}-\d{2})$/.exec(location.hash);
    if (m) goTo(m[1]);
  }

  // ---- search ----
  function search(text) {
    var terms = text.toLowerCase().split(/\s+/).filter(function (t) { return t.length >= 2; });
    if (!terms.length) { showBrowse(); return; }
    var hits = [];
    briefs.forEach(function (b) {
      b.stories.forEach(function (s) {
        var hay = (b.label + ' ' + s.title + ' ' + s.body + ' ' + s.check + ' ' + s.tag + ' ' +
          s.sources.map(function (x) { return x.label; }).join(' ')).toLowerCase();
        if (terms.every(function (t) { return hay.indexOf(t) > -1; })) hits.push({ b: b, s: s });
      });
    });
    var html = '<h2>' + (hits.length ? hits.length + (hits.length === 1 ? ' result' : ' results') : 'No results') +
      ' for “' + esc(text.trim()) + '”</h2>';
    if (!hits.length) html += '<p class="muted">Try fewer or different words, for example a place, a road or an organisation.</p>';
    hits.forEach(function (h) {
      html += '<div class="hit-date"><a href="#' + h.b.date + '" data-date="' + h.b.date + '">' + esc(h.b.label) + '</a></div>' + storyHtml(h.s, terms);
    });
    results.innerHTML = html;
    results.hidden = false;
    browse.hidden = true;
    clearBtn.hidden = false;
  }
  function showBrowse() {
    results.hidden = true;
    results.innerHTML = '';
    browse.hidden = false;
    clearBtn.hidden = !q.value;
  }
  function clearSearch() { q.value = ''; showBrowse(); }

  var timer;
  q.addEventListener('input', function () {
    clearTimeout(timer);
    timer = setTimeout(function () { search(q.value); }, 120);
    clearBtn.hidden = !q.value;
  });
  q.addEventListener('keydown', function (e) { if (e.key === 'Escape') { clearSearch(); } });
  clearBtn.addEventListener('click', function () { clearSearch(); q.focus(); });
  results.addEventListener('click', function (e) {
    var a = e.target.closest ? e.target.closest('a[data-date]') : null;
    if (!a) return;
    e.preventDefault();
    var date = a.getAttribute('data-date');
    clearSearch();
    history.replaceState(null, '', '#' + date);
    goTo(date);
  });
  window.addEventListener('hashchange', fromHash);

  // ---- load the data ----
  fetch('briefs.json', { cache: 'no-cache' })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (data) {
      briefs = data;
      setLabel();
      renderArchive();
      fromHash();
      if (q.value) search(q.value);
    })
    .catch(function () {
      archiveList.innerHTML = '<p class="muted">Earlier briefs could not be loaded. Please refresh the page.</p>';
    });
})();
