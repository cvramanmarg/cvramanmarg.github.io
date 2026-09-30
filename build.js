// Builds the site into ./dist from the daily files in ./briefs and the templates in ./site.
// Run locally with:  node build.js      (GitHub Actions runs it for you on every upload)
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function fail(msg) {
  console.error('\nBUILD FAILED: ' + msg + '\n');
  process.exit(1);
}
function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function dateInfo(d, where) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  if (!m) fail(where + ': "date" must look like 2026-09-30, got "' + d + '"');
  const y = +m[1], mo = +m[2], da = +m[3];
  const dt = new Date(Date.UTC(y, mo - 1, da));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== da) fail(where + ': "' + d + '" is not a real date');
  const weekday = DAYS[dt.getUTCDay()];
  return {
    weekday,
    label: weekday + ', ' + da + ' ' + MONTHS[mo - 1] + ' ' + y,
    short: da + ' ' + MONTHS[mo - 1].slice(0, 3) + ' ' + y,
  };
}
function isStr(v) { return typeof v === 'string' && v.trim().length > 0; }

// ---- load and validate the daily files ----
const briefDir = path.join(ROOT, 'briefs');
if (!fs.existsSync(briefDir)) fail('the "briefs" folder is missing');
const files = fs.readdirSync(briefDir).filter((f) => f.endsWith('.json')).sort();
if (!files.length) fail('no brief files found in the "briefs" folder');

const byDate = {};
for (const f of files) {
  // Main file:  2026-10-01.json      Extra stories added later:  2026-10-01-extra.json (any word after the date)
  const nm = /^(\d{4}-\d{2}-\d{2})(-[a-z0-9]+)?\.json$/.exec(f);
  if (!nm) fail('file name "' + f + '" must look like 2026-09-30.json (or 2026-09-30-extra.json for stories added later)');
  const isExtra = !!nm[2];
  let data;
  try {
    data = JSON.parse(fs.readFileSync(path.join(briefDir, f), 'utf8'));
  } catch (e) {
    fail(f + ' is not valid JSON (' + e.message + '). Check for a missing comma or quote.');
  }
  if (data.date !== nm[1]) fail(f + ': the "date" inside the file (' + data.date + ') must match the date in the file name');
  const info = dateInfo(data.date, f);
  if (!Array.isArray(data.stories)) fail(f + ': "stories" must be a list');
  if (!data.stories.length && !isStr(data.note)) fail(f + ': a day with no stories needs a "note", e.g. "Quiet day. Nothing new found."');
  data.stories.forEach((s, i) => {
    const w = f + ', story ' + (i + 1);
    if (!isStr(s.title)) fail(w + ': "title" is missing');
    if (!isStr(s.body)) fail(w + ': "body" is missing');
    if (s.check !== undefined && typeof s.check !== 'string') fail(w + ': "check" must be text');
    if (s.tag !== undefined && typeof s.tag !== 'string') fail(w + ': "tag" must be text');
    if (!Array.isArray(s.sources) || !s.sources.length) fail(w + ': at least one source is required');
    s.sources.forEach((src, j) => {
      if (!isStr(src.label)) fail(w + ', source ' + (j + 1) + ': "label" is missing');
      if (!/^https?:\/\//i.test(src.url || '')) fail(w + ', source ' + (j + 1) + ': "url" must start with http:// or https://');
    });
  });
  const stories = data.stories.map((s) => ({
    title: s.title.trim(),
    body: s.body.trim(),
    check: (s.check || '').trim(),
    tag: (s.tag || '').trim(),
    sources: s.sources.map((x) => ({ label: x.label.trim(), url: x.url.trim(), date: (x.date || '').trim() })),
  }));
  const day = byDate[data.date] || (byDate[data.date] = { date: data.date, label: info.label, short: info.short, note: '', stories: [], whatsapp: '' });
  day.stories = isExtra ? day.stories.concat(stories) : stories.concat(day.stories); // main file's stories first, extras after
  if (!isExtra) { day.note = data.note || ''; day.whatsapp = data.whatsapp || ''; }
  else if (!day.note && !day.stories.length) day.note = data.note || '';
}
const briefs = Object.keys(byDate).map((k) => byDate[k]);
briefs.forEach((b) => { if (b.stories.length) b.note = ''; });
briefs.sort((a, b) => (a.date < b.date ? 1 : -1)); // newest first

// ---- same markup as site/app.js uses for older briefs ----
function renderStory(s) {
  const paras = s.body.split(/\n{2,}/).map((p) => '<p>' + esc(p) + '</p>').join('');
  const src = s.sources
    .map((x) => '<a href="' + esc(x.url) + '">' + esc(x.label) + '</a>' + (x.date ? ' (' + esc(x.date) + ')' : ''))
    .join('; ');
  return (
    '<article class="story">' +
    (s.tag ? '<div class="tag">' + esc(s.tag) + '</div>' : '') +
    '<h3>' + esc(s.title) + '</h3>' + paras +
    (s.check ? '<div class="check">NEEDS CHECK: ' + esc(s.check) + '</div>' : '') +
    '<div class="src">Sources: ' + src + '</div></article>'
  );
}

const latest = briefs[0];
const latestHtml = latest.stories.length
  ? latest.stories.map(renderStory).join('\n')
  : '<p class="note">' + esc(latest.note) + '</p>';

// ---- optional visitor counter ----
let config = {};
try { config = JSON.parse(fs.readFileSync(path.join(ROOT, 'config.json'), 'utf8')); } catch (e) { config = {}; }
let counter = '';
if (config.goatcounter) {
  if (!/^[a-z0-9-]+$/i.test(config.goatcounter)) fail('config.json: "goatcounter" should be just the site code, e.g. cvramanmarg');
  counter = '<script data-goatcounter="https://' + config.goatcounter + '.goatcounter.com/count" async src="//gc.zgo.at/count.js"></script>';
}

// ---- write dist ----
const dist = path.join(ROOT, 'dist');
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });
for (const f of ['style.css', 'app.js']) fs.copyFileSync(path.join(ROOT, 'site', f), path.join(dist, f));

const firstTitle = latest.stories.length ? latest.stories[0].title : latest.note;
let page = fs.readFileSync(path.join(ROOT, 'site', 'index.template.html'), 'utf8');
page = page
  .replace('<!--DATE-->', esc(latest.label))
  .replace('<!--LATEST-->', latestHtml)
  .replace('<!--DESCRIPTION-->', esc('Daily news brief for the neighbourhoods along CV Raman Marg, South-East Delhi. ' + latest.short + ': ' + firstTitle))
  .replace('<!--COUNTER-->', counter);
fs.writeFileSync(path.join(dist, 'index.html'), page);
fs.writeFileSync(path.join(dist, 'briefs.json'), JSON.stringify(briefs.map(({ whatsapp, ...rest }) => rest)));
fs.writeFileSync(path.join(dist, '.nojekyll'), '');

console.log('Built ' + briefs.length + ' brief(s). Latest: ' + latest.date + (counter ? ' (visitor counter on)' : ' (visitor counter off)'));
