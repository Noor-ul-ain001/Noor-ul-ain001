// Builds every animated profile SVG from live GitHub data and refreshes README stats.
// usage: GITHUB_TOKEN=... node scripts/build.js   (falls back to scripts/stats.json when offline)
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const ROOT = path.join(__dirname, '..'), A = path.join(__dirname, 'assets');
const USER = 'Noor-ul-ain001';
const PORTFOLIO = 'noor-ul-ain-dev.vercel.app';

/* ------------------------------------------------------------------ data */
async function gh(url) {
  const headers = { 'User-Agent': 'profile-build', Accept: 'application/vnd.github+json' };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const r = await fetch('https://api.github.com/' + url, { headers });
  if (!r.ok) throw new Error(`${url} -> ${r.status}`);
  return r.json();
}
async function search(q) {
  let items = [], page = 1, total = 0;
  do {
    const j = await gh(`search/issues?q=${encodeURIComponent(q)}&per_page=100&page=${page++}`);
    total = j.total_count; items.push(...j.items);
    if (!j.items.length) break;
  } while (items.length < total && page <= 10);
  return { total, items };
}
async function gql(query) {
  if (!process.env.GITHUB_TOKEN) throw new Error('graphql needs GITHUB_TOKEN');
  const r = await fetch('https://api.github.com/graphql', { method: 'POST', headers: { 'User-Agent': 'profile-build', Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }, body: JSON.stringify({ query }) });
  const j = await r.json();
  if (!r.ok || j.errors) throw new Error('graphql: ' + JSON.stringify(j.errors || r.status));
  return j.data;
}
async function isLive(url) {
  try {
    const r = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(15000), headers: { 'User-Agent': 'profile-build' } });
    return r.status < 400;
  } catch { return false; }
}
// each source falls back to the last good value in stats.json, so one outage never blanks the profile
async function loadStats() {
  const cacheFile = path.join(__dirname, 'stats.json');
  const cache = fs.existsSync(cacheFile) ? JSON.parse(fs.readFileSync(cacheFile, 'utf8')) : {};
  const st = { ...cache, generated: new Date().toISOString().slice(0, 10) };
  const attempt = async (name, fn) => { try { await fn(); } catch (e) { console.warn(`${name} failed, using cache:`, e.message); } };
  await attempt('prs', async () => {
    const [merged, open, user] = await Promise.all([
      search(`author:${USER} type:pr is:merged -user:${USER}`),
      search(`author:${USER} type:pr is:open -user:${USER}`),
      gh(`users/${USER}`),
    ]);
    st.prs = merged.items.map(i => ({
      repo: i.repository_url.split('/repos/')[1], number: i.number, title: i.title,
      date: (i.pull_request.merged_at || i.closed_at).slice(0, 10), url: i.html_url,
    })).sort((a, b) => b.date.localeCompare(a.date) || b.number - a.number);
    Object.assign(st, { open: open.total, repos: user.public_repos, followers: user.followers });
  });
  await attempt('contributions', async () => {
    const d = await gql(`query { user(login:"${USER}") { contributionsCollection { totalCommitContributions totalPullRequestContributions totalPullRequestReviewContributions totalIssueContributions contributionCalendar { totalContributions weeks { contributionDays { date contributionCount } } } } } }`);
    const c = d.user.contributionsCollection;
    st.contrib = {
      total: c.contributionCalendar.totalContributions, commits: c.totalCommitContributions, prs: c.totalPullRequestContributions,
      reviews: c.totalPullRequestReviewContributions, issues: c.totalIssueContributions,
      days: c.contributionCalendar.weeks.flatMap(w => w.contributionDays).map(x => [x.date, x.contributionCount]),
    };
  });
  await attempt('uptime', async () => {
    const urls = [...PROJECTS, ...BUILDS].map(x => x.url);
    const res = await Promise.all(urls.map(isLive));
    st.live = Object.fromEntries(urls.map((u, i) => [u, res[i]]));
  });
  fs.writeFileSync(cacheFile, JSON.stringify(st, null, 1));
  return st;
}

/* ------------------------------------------------------------------ deployed work */
const PROJECTS = [
  { name: 'Shieldly', tag: 'AI SAFETY AGENT', stack: 'Next.js · TypeScript · AI', url: 'https://shieldly-tau.vercel.app', g: 'shield', desc: 'Turns online abuse into a case you can file — manipulation checks, tamper-evident evidence and NCCIA complaint drafts, in English & Roman Urdu.' },
  { name: 'KSoR', tag: 'OPEN-SOURCE SDK', stack: 'Knowledge System of Record', url: 'https://ksor-blush.vercel.app', g: 'book', desc: 'An SDK for governed, authoritative knowledge systems for humans and AI agents — it solves the authority problem, not just search.' },
  { name: 'TaskFlow', tag: 'AGENTIC PM', stack: 'FastAPI · Next.js · AI', url: 'https://hackathon-todo-phase-3.vercel.app', g: 'bot', desc: 'The project-management platform designed for the Agent Era — AI-powered task intelligence, built across a multi-phase hackathon.' },
  { name: 'IRIS AXIS', tag: 'CLIENT · SECURITY', stack: 'Vite · React', url: 'https://iris-axis.vercel.app', g: 'eye', desc: 'Professional remote CCTV monitoring for U.S. homes and businesses — trained human attention and timely incident reporting.' },
  { name: "Pixel's AI Academy", tag: 'EDU GAME', stack: 'HTML · CSS · JavaScript', url: 'https://summer-camp-game.vercel.app', g: 'game', desc: 'Learn AI by helping Pixel at his help booth — retrieval modes, supervised vs unsupervised and reinforcement learning, one level each.' },
  { name: 'MCP Transports', tag: 'VISUAL EXPLAINER', stack: 'HTML · CSS · JavaScript', url: 'https://mcp-2.vercel.app', g: 'plug', desc: 'A complete visual breakdown of how MCP clients and servers talk — the transports that carry JSON-RPC between them.' },
  { name: 'JS Visualizer', tag: 'DEV TOOL', stack: 'JavaScript', url: 'https://js-visualizer-theta.vercel.app', g: 'code', desc: 'Step through JavaScript line by line and watch the call stack and memory change as your code runs.' },
  { name: 'The Buzz Crew', tag: 'AGENCY SITE', stack: 'Next.js · TypeScript', url: 'https://thebuzzcrew.vercel.app', g: 'globe', desc: 'Full-service digital agency from Karachi — social, SEO, web & software, UI/UX and Meta ads for brands in PK, UAE and UK.' },
];
const BUILDS = [
  { name: 'Portfolio', tag: 'NEXT.JS · MOTION', url: 'https://noor-ul-ain-dev.vercel.app', c: '#c6ff3d' },
  { name: 'Aesthetoderm', tag: 'CLIENT · CLINIC', url: 'https://aesthetoderm-website.vercel.app', c: '#2ee6ff' },
  { name: 'Refine Aesthetics', tag: 'CLIENT · CLINIC', url: 'https://refine-aesthetics-website.vercel.app', c: '#5b7cff' },
  { name: 'Aurelia Parfum', tag: 'REACT · GSAP', url: 'https://aurelia-parfum.vercel.app', c: '#ff5ea8' },
  { name: 'Palmo Coconut', tag: 'THREE.JS · GSAP', url: 'https://palmo-coconut.vercel.app', c: '#c6ff3d' },
  { name: 'DriveHouse Motors', tag: 'REACT', url: 'https://velox-motors-app-pied.vercel.app', c: '#2ee6ff' },
  { name: 'Smash Burger', tag: 'GSAP SCROLL', url: 'https://smash-burger-landing.vercel.app', c: '#5b7cff' },
  { name: 'Scroll Chapters', tag: 'NEXT.JS · LENIS', url: 'https://scroll-video-chapters.vercel.app', c: '#ff5ea8' },
  { name: 'Nooritoo Shop', tag: 'E-COMMERCE', url: 'https://noorito-ecom.vercel.app', c: '#c6ff3d' },
  { name: 'iPhone Website', tag: 'PRODUCT LANDING', url: 'https://iphone-website-sepia.vercel.app', c: '#2ee6ff' },
];
const host = u => u.replace(/^https?:\/\//, '').replace(/\/$/, '');

/* ------------------------------------------------------------------ theme */
const b64 = f => fs.readFileSync(path.join(A, f)).toString('base64');
const FONT_D = b64('display.woff2'), FONT_M = b64('mono.woff2');
const ICON = n => fs.readFileSync(path.join(A, 'icons', n + '.svg'), 'utf8').match(/ d="([^"]+)"/)[1];
// "acid terminal": lime -> cyan -> electric blue, with a hot-pink counter-accent
const C = { bg: '#05080e', tx: '#ecfdf5', mu: '#8ea4b8', dim: '#566a80', y: '#c6ff3d', o: '#2ee6ff', m: '#5b7cff', t: '#ff5ea8', skin: '#eab896', hair: '#1c1a2b' };
const BRAND = {
  python: '#4B8BBE', typescript: '#3178C6', react: '#61DAFB', nextdotjs: '#ffffff', tailwindcss: '#38BDF8', fastapi: '#05998B',
  nodedotjs: '#5FA04E', postgresql: '#6B9BD1', docker: '#2496ED', git: '#F05032', githubactions: '#2088FF', vercel: '#ffffff',
  opencv: '#7c62ff', anthropic: '#D97757', openai: '#ffffff', framer: '#ffffff', drizzle: '#C5F74F', linkedin: '#3b8be0',
  github: '#ffffff', gmail: '#EA4335'
};
const r2 = n => Math.round(n * 100) / 100;
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const mdate = d => `${MON[+d.slice(5, 7) - 1]} ${+d.slice(8, 10)}, ${d.slice(0, 4)}`;
function rng(seed) { return () => (seed = (seed * 9301 + 49297) % 233280) / 233280; }

function head(p, W, H, o = {}) {
  const fonts = o.noFont ? '' : `@font-face{font-family:'${p}D';src:url(data:font/woff2;base64,${FONT_D}) format('woff2');font-weight:700}
@font-face{font-family:'${p}M';src:url(data:font/woff2;base64,${FONT_M}) format('woff2');font-weight:500}
.d{font-family:'${p}D','Segoe UI',sans-serif;font-weight:700}
.m{font-family:'${p}M',Consolas,monospace;font-weight:500}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" fill="none">
<style>${fonts}</style>
<defs>
<pattern id="${p}dots" width="12" height="12" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".8" fill="#fff" fill-opacity=".05"/></pattern>
<linearGradient id="${p}hair" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${C.y}" stop-opacity=".7"/><stop offset=".35" stop-color="${C.m}" stop-opacity=".12"/><stop offset=".65" stop-color="${C.t}" stop-opacity=".12"/><stop offset="1" stop-color="${C.m}" stop-opacity=".7"/>
<animateTransform attributeName="gradientTransform" type="rotate" values="0 .5 .5;360 .5 .5" dur="8s" repeatCount="indefinite"/></linearGradient>
<linearGradient id="${p}aur" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${C.y}"/><stop offset=".5" stop-color="${C.o}"/><stop offset="1" stop-color="${C.m}"/></linearGradient>
<linearGradient id="${p}scan" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.m}" stop-opacity="0"/><stop offset=".5" stop-color="${C.m}" stop-opacity=".07"/><stop offset="1" stop-color="${C.m}" stop-opacity="0"/></linearGradient>
<radialGradient id="${p}glowM" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="${C.m}" stop-opacity=".3"/><stop offset="1" stop-color="${C.m}" stop-opacity="0"/></radialGradient>
<radialGradient id="${p}glowT" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="${C.t}" stop-opacity=".25"/><stop offset="1" stop-color="${C.t}" stop-opacity="0"/></radialGradient>
<linearGradient id="${p}shine" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".09"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
<filter id="${p}blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6"/></filter>
<filter id="${p}neon" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
<filter id="${p}soft" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="45"/></filter>`;
}
// card with rotating hairline border, drifting particles and a slow scanline
let cardN = 0;
function card(p, x, y, w, h, o = {}) {
  const id = `${p}cc${cardN++}`, rand = rng(x * 7 + y * 13 + w);
  let fx = '';
  for (let k = 0; k < (o.particles ?? 14); k++) {
    const px = r2(x + 10 + rand() * (w - 20)), py = r2(y + h * (.4 + rand() * .6)), d = r2(6 + rand() * 7), c = [C.y, C.m, C.t][k % 3];
    fx += `<circle cx="${px}" cy="${py}" r="${r2(.8 + rand() * 1.4)}" fill="${c}" opacity="0"><animateTransform attributeName="transform" type="translate" values="0 0;${r2(rand() * 20 - 10)} -${r2(h * .5)}" dur="${d}s" begin="-${r2(rand() * d)}s" repeatCount="indefinite"/><animate attributeName="opacity" values="0;.7;0" dur="${d}s" begin="-${r2(rand() * d)}s" repeatCount="indefinite"/></circle>`;
  }
  // drifting aurora blobs behind the content
  const R = Math.min(w, h) * .45;
  const blobs = [[C.y, .2, .3, 18], [C.m, .8, .7, 23], [C.t, .55, .1, 29]].map(([c, fx0, fy0, d], k) =>
    `<circle cx="${r2(x + w * fx0)}" cy="${r2(y + h * fy0)}" r="${r2(R)}" fill="${c}" opacity="${k === 2 ? .07 : .11}" filter="url(#${p}soft)"><animateTransform attributeName="transform" type="translate" values="0 0;${r2(w * (k % 2 ? -.25 : .25))} ${r2(h * .2)};${r2(w * (k % 2 ? .1 : -.1))} ${r2(-h * .15)};0 0" dur="${d}s" repeatCount="indefinite"/></circle>`).join('');
  return `<clipPath id="${id}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="22"/></clipPath>
<rect x="${x + .5}" y="${y + .5}" width="${w - 1}" height="${h - 1}" rx="22" fill="${C.bg}"/>
<g clip-path="url(#${id})">${blobs}</g>
<rect x="${x + .5}" y="${y + .5}" width="${w - 1}" height="${h - 1}" rx="22" fill="url(#${p}dots)"/>
<g clip-path="url(#${id})">${fx}<rect x="${x}" y="${y - 80}" width="${w}" height="80" fill="url(#${p}scan)"><animateTransform attributeName="transform" type="translate" values="0 0;0 ${h + 80}" dur="7s" repeatCount="indefinite"/></rect></g>
<rect x="${x + .5}" y="${y + .5}" width="${w - 1}" height="${h - 1}" rx="22" stroke="url(#${p}hair)" stroke-width="1.3"/>`;
}
const label = (x, y, t, col = C.o) => `<text x="${x}" y="${y}" class="m" font-size="12" letter-spacing="1.6" fill="${col}">${esc(t)}</text>`;
const title = (x, y, t, s = 26) => `<text x="${x}" y="${y}" class="d" font-size="${s}" fill="${C.tx}">${esc(t)}</text>`;
const icon = (n, cx, cy, size, fill) => `<g transform="translate(${r2(cx - size / 2)},${r2(cy - size / 2)}) scale(${r2(size / 24)})"><path d="${ICON(n)}" fill="${fill || BRAND[n]}"/></g>`;
const pulseDot = (x, y, c, r = 4) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" opacity="0"><animate attributeName="r" values="${r};${r * 2.6}" dur="1.6s" repeatCount="indefinite"/><animate attributeName="opacity" values=".6;0" dur="1.6s" repeatCount="indefinite"/></circle><circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/>`;
const cursor = (x, y, h, c = C.t, w = 1.6) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"><animate attributeName="opacity" values="1;0;1" keyTimes="0;.5;1" calcMode="discrete" dur="1s" repeatCount="indefinite"/></rect>`;
// entrance: fade + rise, frozen at the finished state
const enter = (delay, dur = 2.4) => {
  const a = r2(delay / dur), b = r2(Math.min(1, a + .25));
  return `<animate attributeName="opacity" values="0;0;1;1" keyTimes="0;${a};${b};1" dur="${dur}s" fill="freeze"/><animateTransform attributeName="transform" type="translate" values="0 18;0 18;0 0;0 0" keyTimes="0;${a};${b};1" dur="${dur}s" fill="freeze"/>`;
};
function countUp(x, y, n, size, fill, suffix = '', anchor = 'start') {
  const steps = Math.min(n, 14), dur = 2, span = .8;
  let s = '';
  for (let j = 0; j <= steps; j++) {
    const v = Math.round(n * j / steps), a = r2(j / (steps + 1) * span), b = r2((j + 1) / (steps + 1) * span);
    let anim;
    if (j === steps) anim = `<animate attributeName="opacity" calcMode="discrete" values="0;1" keyTimes="0;${a}" dur="${dur}s" fill="freeze"/>`;
    else if (j === 0) anim = `<animate attributeName="opacity" calcMode="discrete" values="1;0" keyTimes="0;${b}" dur="${dur}s" fill="freeze"/>`;
    else anim = `<animate attributeName="opacity" calcMode="discrete" values="0;1;0" keyTimes="0;${a};${b}" dur="${dur}s" fill="freeze"/>`;
    s += `<text x="${x}" y="${y}" text-anchor="${anchor}" class="d" font-size="${size}" fill="${fill}" opacity="${j === steps ? 1 : 0}">${v}${j === steps ? suffix : ''}${anim}</text>`;
  }
  return s;
}
function slot(i, n, on, off, t = 0.02) {
  const f = x => r2(x * 1000) / 1000;
  if (i === 0) return { kt: [0, f(1 / n - t), f(1 / n), f(1 - t), 1].join(';'), v: [on, on, off, off, on].join(';') };
  if (i === n - 1) return { kt: [0, f(i / n - t), f(i / n), f(1 - t), 1].join(';'), v: [off, off, on, on, off].join(';') };
  return { kt: [0, f(i / n - t), f(i / n), f((i + 1) / n - t), f((i + 1) / n), 1].join(';'), v: [off, off, on, on, off, off].join(';') };
}
function wrap(s, n) {
  const out = []; let line = '';
  for (const w of s.split(' ')) { if ((line + ' ' + w).trim().length > n) { out.push(line.trim()); line = w; } else line += ' ' + w; }
  if (line.trim()) out.push(line.trim());
  return out;
}

/* ------------------------------------------------------------------ avatar */
function avatarHead(o = {}) {
  const blink = o.blink ? `<animate attributeName="ry" values="5;5;.6;5;5" keyTimes="0;.9;.93;.96;1" dur="${o.blink}" repeatCount="indefinite"/>` : '';
  const rightEye = o.wink ? `<path d="M9 3 Q15 -4 21 3" stroke="${C.hair}" stroke-width="3" stroke-linecap="round"/>` : `<ellipse cx="15" cy="2" rx="4" ry="5" fill="${C.hair}">${blink}</ellipse><circle cx="15" cy="0" r="1.4" fill="#fff" opacity=".9"/>`;
  return `<circle r="42" fill="${C.skin}"/>
<path d="M-44 6 C-52 -48 -10 -62 8 -56 C40 -50 54 -22 45 8 C38 -12 22 -22 4 -20 C-14 -30 -36 -16 -44 6 Z" fill="${C.hair}"/>
<path d="M-44 4 C-47 26 -42 40 -33 46 L-36 8 Z M44 6 C47 28 42 40 33 46 L36 8 Z" fill="${C.hair}"/>
<ellipse cx="-15" cy="2" rx="4" ry="5" fill="${C.hair}">${blink}</ellipse><circle cx="-15" cy="0" r="1.4" fill="#fff" opacity=".9"/>${rightEye}
<circle cx="-25" cy="16" r="5.5" fill="${C.m}" opacity=".35"/><circle cx="25" cy="16" r="5.5" fill="${C.m}" opacity=".35"/>
<path d="M-12 19 Q0 31 12 19" stroke="#8a4636" stroke-width="3" stroke-linecap="round"/>
<path d="M-47 -2 C-47 -68 47 -68 47 -2" stroke="${C.t}" stroke-width="6" stroke-linecap="round"/>
<rect x="-55" y="-12" width="13" height="28" rx="6" fill="${C.t}"/><rect x="42" y="-12" width="13" height="28" rx="6" fill="${C.t}"/>`;
}
const hoodieDef = p => `<linearGradient id="${p}hood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.m}"/><stop offset="1" stop-color="#2333a8"/></linearGradient>`;
const ARM = '#3f5ff0';
const torso = (p, bottom = 140) => `<path d="M-88 ${bottom} C-88 85 -62 62 0 60 C62 62 88 85 88 ${bottom} Z" fill="url(#${p}hood)"/>
<rect x="-12" y="30" width="24" height="34" rx="8" fill="${C.skin}"/>
<path d="M-26 62 Q0 86 26 62" stroke="#b7c6ff" stroke-width="4" fill="none" stroke-linecap="round"/>
<path d="M-10 72 L-12 100 M10 72 L12 100" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>`;

/* ------------------------------------------------------------------ hero */
function hero(S) {
  const p = 'h', W = 1200, H = 440;
  let s = head(p, W, H) + hoodieDef(p) + `
<linearGradient id="${p}name" x1="0" y1="0" x2="560" y2="0" gradientUnits="userSpaceOnUse" spreadMethod="repeat">
<stop offset="0" stop-color="${C.y}"/><stop offset=".33" stop-color="${C.o}"/><stop offset=".66" stop-color="${C.m}"/><stop offset="1" stop-color="${C.y}"/>
<animateTransform attributeName="gradientTransform" type="translate" values="0 0;560 0" dur="6s" repeatCount="indefinite"/></linearGradient>
<mask id="${p}rise"><rect x="0" y="128" width="700" height="110" fill="#fff"><animate attributeName="y" values="240;240;128" keyTimes="0;.35;1" dur="1.4s" fill="freeze"/></rect></mask>
<clipPath id="${p}type"><rect x="56" y="100" width="170" height="40"><animate attributeName="width" values="${Array.from({ length: 15 }, (_, k) => k === 14 ? 170 : k * 12).join(';')}" dur="1.1s" calcMode="discrete" fill="freeze"/></rect></clipPath>
<clipPath id="${p}vf"><rect x="680" y="40" width="470" height="360" rx="18"/></clipPath>
<radialGradient id="${p}melt" cx=".5" cy=".48" r=".62"><stop offset=".55" stop-color="#fff"/><stop offset="1" stop-color="#000"/></radialGradient>
<mask id="${p}mm"><rect x="680" y="40" width="470" height="360" fill="url(#${p}melt)"/></mask>
<linearGradient id="${p}sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#04121a"/><stop offset=".7" stop-color="#0a2a3a"/><stop offset="1" stop-color="#03080d"/></linearGradient>
<linearGradient id="${p}sun" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.y}"/><stop offset=".55" stop-color="${C.o}"/><stop offset="1" stop-color="${C.m}"/></linearGradient>
</defs>
${card(p, 0, 0, W, H, { particles: 22 })}
<circle cx="830" cy="210" r="280" fill="url(#${p}glowM)"/>`;
  s += `
<g><rect x="56" y="52" width="196" height="30" rx="15" fill="${C.t}" fill-opacity=".08" stroke="${C.t}" stroke-opacity=".45"/>
${pulseDot(75, 67, '#34d399')}
<text x="90" y="71.5" class="m" font-size="12" letter-spacing="1.6" fill="#ffd1ea">OPEN TO COLLABS</text></g>
<g clip-path="url(#${p}type)"><text x="56" y="128" class="m" font-size="20" fill="${C.mu}">Hi there, I'm</text></g>
<rect x="216" y="111" width="10" height="21" fill="${C.o}"><animate attributeName="opacity" values="1;0;1" dur="1s" calcMode="discrete" keyTimes="0;.5;1" repeatCount="indefinite"/></rect>
<g mask="url(#${p}rise)"><g><animateTransform attributeName="transform" type="translate" values="0 26;0 26;0 0" keyTimes="0;.35;1" dur="1.4s" fill="freeze"/>
<text x="52" y="218" class="d" font-size="80" letter-spacing="-2" fill="${C.t}" opacity="0">Noor ul Ain<animate attributeName="opacity" values="0;0;.8;0;.6;0;0" keyTimes="0;.86;.87;.88;.89;.9;1" dur="5s" repeatCount="indefinite"/><animateTransform attributeName="transform" type="translate" values="-4 0;-4 0;5 -1;-3 1;-4 0" keyTimes="0;.86;.87;.89;1" dur="5s" repeatCount="indefinite"/></text>
<text x="52" y="218" class="d" font-size="80" letter-spacing="-2" fill="url(#${p}name)">Noor ul Ain<animate attributeName="letter-spacing" values="28;28;-2" keyTimes="0;.3;1" keySplines="0 0 1 1;.2 .9 .3 1" calcMode="spline" dur="1.6s" fill="freeze"/><animateTransform attributeName="transform" type="translate" values="0 0;0 0;3 0;-2 0;0 0;0 0" keyTimes="0;.86;.87;.88;.9;1" dur="5s" repeatCount="indefinite"/></text></g></g>`;
  const roles = ['Agentic AI Engineer', 'spec-kit Contributor', 'MCP Workflow Builder', 'Full-Stack Developer'];
  // typewriter: each role types in, holds, then deletes itself
  s += `<text x="56" y="266" class="m" font-size="20" fill="${C.o}">&gt;</text>`;
  roles.forEach((r, i) => {
    const w = r.length * 12, a = i / 4, b = (i + 1) / 4, f = n => r2(n * 1000) / 1000;
    const kt = i === 0 ? [0, .1, .2, .24, 1] : [0, f(a), f(a + .1), f(b - .05), f(b - .01), 1];
    const vw = i === 0 ? [0, w, w, 0, 0] : [0, 0, w, w, 0, 0];
    s += `<clipPath id="${p}role${i}"><rect x="80" y="244" width="${i ? 0 : w}" height="30"><animate attributeName="width" values="${vw.join(';')}" keyTimes="${kt.join(';')}" dur="12s" repeatCount="indefinite"/></rect></clipPath>
<g clip-path="url(#${p}role${i})"><text x="80" y="266" class="m" font-size="20" fill="${C.tx}">${esc(r)}</text></g>
<rect x="${80 + (i ? 0 : w) + 2}" y="250" width="10" height="20" fill="${C.y}" opacity="${i ? 0 : 1}"><animate attributeName="x" values="${vw.map(v => 82 + v).join(';')}" keyTimes="${kt.join(';')}" dur="12s" repeatCount="indefinite"/><animate attributeName="opacity" values="${i === 0 ? '1;1;0;0;1' : '0;0;1;1;0;0'}" keyTimes="${i === 0 ? '0;.24;.245;.999;1' : [0, f(a), f(a + .005), f(b - .01), f(b - .005), 1].join(';')}" dur="12s" repeatCount="indefinite"/></rect>`;
  });
  const up = S.prs.length;
  s += `
<text x="56" y="310" class="m" font-size="14" fill="#cfe4ec">I build multi-agent systems, RAG pipelines &amp; MCP</text>
<text x="56" y="332" class="m" font-size="14" fill="#cfe4ec">workflows — from first spec to production deploy.</text>
<g class="m" font-size="13" fill="${C.mu}">
<path d="M64 366 c-5 0 -8 4 -8 8 c0 6 8 13 8 13 s8 -7 8 -13 c0 -4 -3 -8 -8 -8 z" stroke="${C.m}" stroke-width="1.6"/><circle cx="64" cy="374" r="2.4" fill="${C.m}"/>
<text x="80" y="383">Karachi, Pakistan</text>
<path d="M232 386 v-17 l8 -4 v21 M240 386 v-14 l8 3 v11 M228 386 h24" stroke="${C.y}" stroke-width="1.6"/>
<text x="260" y="383">Panaversity · GIAIC</text>
<circle cx="440" cy="369" r="3" stroke="${C.t}" stroke-width="1.6"/><circle cx="440" cy="385" r="3" stroke="${C.t}" stroke-width="1.6"/><circle cx="452" cy="377" r="3" stroke="${C.t}" stroke-width="1.6"/><path d="M440 372 v10 M443 370 q9 0 9 4" stroke="${C.t}" stroke-width="1.6"/>
<text x="464" y="383">${up} merged PRs</text>
</g>`;
  // the animated "video": code rain, holographic globe, perspective grid, waving coder
  const glyphs = '01{}<>/=;$#:+*', rr = rng(11);
  let rain = '';
  for (let k = 0; k < 22; k++) {
    const x = r2(694 + k * 21), d = r2(3 + rr() * 4), col = Array.from({ length: 9 }, () => glyphs[Math.floor(rr() * glyphs.length)]);
    rain += `<g opacity=".5"><animateTransform attributeName="transform" type="translate" values="0 -150;0 330" dur="${d}s" begin="-${r2(rr() * d)}s" repeatCount="indefinite"/>${col.map((g, j) => `<text x="${x}" y="${40 + j * 15}" class="m" font-size="12" fill="${j === 8 ? '#fff' : C.y}" fill-opacity="${r2(.15 + j * .1)}">${esc(g)}</text>`).join('')}</g>`;
  }
  let grid = '';
  for (let k = -7; k <= 7; k++) grid += `<line x1="${915 + k * 16}" y1="300" x2="${915 + k * 110}" y2="420" stroke="${C.m}" stroke-opacity=".45"/>`;
  for (let k = 0; k < 6; k++) grid += `<line x1="680" y1="300" x2="1150" y2="300" stroke="${C.m}" stroke-opacity=".5"><animateTransform attributeName="transform" type="translate" values="0 0;0 110" keySplines=".6 0 1 1" calcMode="spline" dur="3s" begin="-${k * .5}s" repeatCount="indefinite"/><animate attributeName="stroke-opacity" values=".15;.7" dur="3s" begin="-${k * .5}s" repeatCount="indefinite"/></line>`;
  const codeBars = [[38, C.m], [62, C.t], [48, C.y], [30, C.t]];
  let code = '';
  codeBars.forEach(([w, c], k) => {
    const a = r2(.1 + k * .15), b = r2(a + .14);
    code += `<rect x="12" y="${26 + k * 10}" width="${w}" height="4" rx="2" fill="${c}" opacity=".85"><animate attributeName="width" values="0;0;${w};${w}" keyTimes="0;${a};${b};1" dur="4s" repeatCount="indefinite"/></rect>`;
  });
  const stars = Array.from({ length: 14 }, (_, k) => { const r = rng(k + 3); return `<circle cx="${r2(700 + r() * 430)}" cy="${r2(55 + r() * 110)}" r="${r2(.8 + r())}" fill="#fff"><animate attributeName="opacity" values=".2;1;.2" dur="${r2(1.5 + r() * 2)}s" repeatCount="indefinite"/></circle>`; }).join('');
  s += `
<g clip-path="url(#${p}vf)"><g mask="url(#${p}mm)">
<rect x="680" y="40" width="470" height="360" fill="url(#${p}sky)"/>${stars}
${rain}
<circle cx="915" cy="190" r="120" fill="${C.o}" opacity=".16" filter="url(#${p}blur)"/>
<g stroke="${C.o}" stroke-width="1.3" fill="none" opacity=".75">
<circle cx="915" cy="190" r="100" stroke="url(#${p}sun)"/>
${[0, 1, 2, 3].map(k => `<ellipse cx="915" cy="190" rx="100" ry="100" stroke-opacity=".55"><animate attributeName="rx" values="100;0;100" dur="6s" begin="-${k * 1.5}s" repeatCount="indefinite"/></ellipse>`).join('')}
${[-60, -30, 0, 30, 60].map(dy => `<ellipse cx="915" cy="${190 + dy}" rx="${r2(Math.sqrt(10000 - dy * dy))}" ry="${r2(Math.sqrt(10000 - dy * dy) * .16)}" stroke-opacity=".4"/>`).join('')}
<g><animateTransform attributeName="transform" type="rotate" values="0 915 190;360 915 190" dur="14s" repeatCount="indefinite"/><ellipse cx="915" cy="190" rx="135" ry="24" stroke="${C.y}" stroke-dasharray="4 10" transform="rotate(-18 915 190)"/></g>
</g>
<rect x="680" y="300" width="470" height="100" fill="#03080d"/>${grid}
<g><animate attributeName="opacity" values="1;1;0;1" keyTimes="0;.88;.95;1" dur="4s" repeatCount="indefinite"/>
<g transform="translate(915,0)">
<g transform="translate(-205,252)"><rect width="104" height="72" rx="10" fill="#0a1420" fill-opacity=".9" stroke="${C.t}" stroke-opacity=".5"/>
<circle cx="12" cy="12" r="3" fill="#f87171"/><circle cx="22" cy="12" r="3" fill="#fbbf24"/><circle cx="32" cy="12" r="3" fill="#34d399"/>${code}
<animateTransform attributeName="transform" type="translate" values="-205 252;-205 244;-205 252" dur="4s" repeatCount="indefinite"/></g>
<g transform="translate(-120,150)"><g><animateTransform attributeName="transform" type="scale" values="0;0;1.12;1;1;0;0" keyTimes="0;.08;.16;.2;.78;.84;1" dur="4s" repeatCount="indefinite"/>
<path d="M-48 -20 h96 a10 10 0 0 1 10 10 v20 a10 10 0 0 1 -10 10 h-70 l-12 12 v-12 h-14 a10 10 0 0 1 -10 -10 v-20 a10 10 0 0 1 10 -10 z" fill="#fff"/>
<text x="0" y="5" text-anchor="middle" class="m" font-size="14" fill="${C.bg}">hi there!</text></g></g>
<g transform="translate(0,200)">
<g><animateTransform attributeName="transform" type="translate" values="0 0;0 -3;0 0" dur="2s" repeatCount="indefinite"/>${torso(p)}<g>${avatarHead({ blink: '4s' })}</g></g>
<g><animateTransform attributeName="transform" type="rotate" values="0 62 84;-22 62 84;6 62 84;-22 62 84;6 62 84;-22 62 84;0 62 84;0 62 84" keyTimes="0;.1;.2;.3;.4;.5;.6;1" dur="4s" repeatCount="indefinite"/>
<path d="M62 84 L108 14" stroke="${ARM}" stroke-width="24" stroke-linecap="round"/><circle cx="112" cy="6" r="15" fill="${C.skin}"/>
<path d="M104 -6 v-10 M112 -9 v-12 M120 -6 v-10" stroke="${C.skin}" stroke-width="6" stroke-linecap="round"/></g>
<rect x="-98" y="88" width="196" height="100" rx="9" fill="#0f1c2b" stroke="#24405a"/>
<g transform="translate(0,138)" stroke="${C.y}" stroke-width="1.8" fill="none"><animate attributeName="opacity" values=".45;1;.45" dur="2s" repeatCount="indefinite"/>
<ellipse rx="22" ry="8"/><ellipse rx="22" ry="8" transform="rotate(60)"/><ellipse rx="22" ry="8" transform="rotate(-60)"/><circle r="3" fill="${C.y}"/></g>
<rect x="-210" y="186" width="420" height="16" rx="7" fill="#132232"/>
<g transform="translate(150,152)"><rect width="30" height="34" rx="6" fill="${C.t}"/><path d="M30 8 h6 a7 7 0 0 1 0 14 h-6" stroke="${C.t}" stroke-width="4"/>
${[0, 1, 2].map(k => `<path d="M${7 + k * 8} -6 q-4 -6 0 -12 q4 -6 0 -12" stroke="#fff" stroke-opacity=".5" stroke-width="2" stroke-linecap="round"><animateTransform attributeName="transform" type="translate" values="0 4;0 -8" dur="2s" begin="${-k * .6}s" repeatCount="indefinite"/><animate attributeName="opacity" values="0;1;0" dur="2s" begin="${-k * .6}s" repeatCount="indefinite"/></path>`).join('')}
</g></g></g></g></g></g>`;
  const br = d => `<path d="${d}" stroke="#fff" stroke-opacity=".85" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="60"><animate attributeName="stroke-dashoffset" values="60;0" dur=".9s" fill="freeze"/></path>`;
  s += `
<g>${br('M700 88 V60 H728')}${br('M1102 60 H1130 V88')}${br('M700 352 V380 H728')}${br('M1102 380 H1130 V352')}</g>
<circle cx="722" cy="80" r="5" fill="#ef4444"><animate attributeName="opacity" values="1;0;1" keyTimes="0;.5;1" calcMode="discrete" dur="1.2s" repeatCount="indefinite"/></circle>
<text x="734" y="84.5" class="m" font-size="12" fill="#fecaca" letter-spacing="1.5">REC</text>
<text x="1110" y="84.5" text-anchor="end" class="m" font-size="11" fill="#d6f5ff">noor_intro.mp4 · 1080p</text>
${[0, 1, 2, 3].map(k => { const t = slot(k, 4, 1, 0, 0); return `<text x="722" y="364" class="m" font-size="11" fill="#d6f5ff" opacity="${k ? 0 : 1}">00:00:0${k}<animate attributeName="opacity" calcMode="discrete" values="${t.v}" keyTimes="${t.kt}" dur="4s" repeatCount="indefinite"/></text>`; }).join('')}
<rect x="800" y="358" width="300" height="4" rx="2" fill="#fff" fill-opacity=".18"/>
<rect x="800" y="358" width="300" height="4" rx="2" fill="url(#${p}aur)"><animate attributeName="width" values="0;300" dur="4s" repeatCount="indefinite"/></rect>
<circle cx="1100" cy="360" r="5" fill="#fff"><animate attributeName="cx" values="800;1100" dur="4s" repeatCount="indefinite"/></circle>
</svg>`;
  return s;
}

/* ------------------------------------------------------------------ about + life */
function about(S) {
  const p = 'a', W = 1200, H = 460;
  const sk = S.prs.filter(x => x.repo === 'github/spec-kit').length;
  let s = head(p, W, H) + `
<linearGradient id="${p}tile" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${C.o}" stop-opacity=".3"/><stop offset="1" stop-color="${C.m}" stop-opacity=".3"/></linearGradient>
<clipPath id="${p}slides"><rect x="636" y="116" width="540" height="214" rx="16"/></clipPath>
${[['#163f12', '#0a1420'], ['#0b2f4a', '#0a1420'], ['#26205c', '#0a1420'], ['#4a0f36', '#0a1420']].map(([a, b], i) => `<linearGradient id="${p}s${i}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`).join('')}
</defs>
${card(p, 0, 0, 588, H)}${card(p, 612, 0, 588, H)}
${label(32, 44, '// WHAT I BUILD')}${title(32, 80, 'Agents that actually ship')}
<rect x="32" y="100" width="524" height="200" rx="12" fill="#0a1520" stroke="#fff" stroke-opacity=".08"/>
<path d="M32 130 H556" stroke="#fff" stroke-opacity=".08"/>
<circle cx="50" cy="115" r="4.5" fill="#f87171"/><circle cx="64" cy="115" r="4.5" fill="#fbbf24"/><circle cx="78" cy="115" r="4.5" fill="#34d399"/>
<rect x="100" y="106" width="440" height="18" rx="9" fill="#fff" fill-opacity=".05"/>
<text x="114" y="119" class="m" font-size="11" fill="${C.mu}">https://<tspan fill="${C.tx}">${PORTFOLIO}</tspan></text>
${cursor(r2(116 + (8 + PORTFOLIO.length) * 6.6), 109, 12)}`;
  const kids = ['Mapper', 'Auditor', 'Skills', 'Prioritizer'];
  const ox = 294, oy = 160;
  s += `<rect x="${ox - 70}" y="${oy - 16}" width="140" height="32" rx="10" fill="${C.m}" fill-opacity=".14" stroke="${C.m}" stroke-opacity=".6"><animate attributeName="stroke-opacity" values=".3;.9;.3" dur="2.5s" repeatCount="indefinite"/></rect>
<text x="${ox}" y="${oy + 4.5}" text-anchor="middle" class="m" font-size="12" fill="${C.tx}">orchestrator.run()</text>`;
  kids.forEach((k, i) => {
    const x = 56 + i * 122 + 50, y = 258;
    const d = `M${ox} ${oy + 16} C${ox} ${oy + 50} ${x} ${y - 50} ${x} ${y - 16}`;
    const a = r2(i * .2), b = r2(a + .35);
    s += `<path d="${d}" stroke="${C.o}" stroke-opacity=".4" stroke-dasharray="3 5"><animate attributeName="stroke-dashoffset" values="0;-16" dur="1s" repeatCount="indefinite"/></path>
<circle r="3.5" fill="${C.y}" opacity="0"><animateMotion path="${d}" keyPoints="0;0;1;1" keyTimes="0;${a};${b};1" calcMode="linear" dur="2.5s" repeatCount="indefinite"/><animate attributeName="opacity" values="0;0;1;1;0;0" keyTimes="0;${a};${r2(a + .02)};${r2(b - .02)};${b};1" dur="2.5s" repeatCount="indefinite"/></circle>
<rect x="${x - 50}" y="${y - 16}" width="100" height="32" rx="10" fill="#fff" fill-opacity=".04" stroke="#fff" stroke-opacity=".14"/>
<rect x="${x - 50}" y="${y - 16}" width="100" height="32" rx="10" stroke="${C.y}" stroke-opacity="0"><animate attributeName="stroke-opacity" values="0;0;.9;0;0" keyTimes="0;${b};${r2(b + .05)};${r2(Math.min(b + .3, .99))};1" dur="2.5s" repeatCount="indefinite"/></rect>
<text x="${x}" y="${y + 4.5}" text-anchor="middle" class="m" font-size="12" fill="#d9ecf2">${k}</text>`;
  });
  const caps = [
    ['Multi-agent orchestration', 'harness files · loop engineering · human-in-the-loop', 'graph'],
    ['RAG pipelines', 'vector search · semantic retrieval · FastAPI', 'db'],
    ['MCP workflows', 'Claude Code · MCP servers · spec-driven dev', 'plug'],
  ];
  const glyph = {
    graph: (x, y) => `<circle cx="${x - 6}" cy="${y - 5}" r="3"/><circle cx="${x + 7}" cy="${y - 6}" r="3"/><circle cx="${x}" cy="${y + 7}" r="3"/><path d="M${x - 4} ${y - 3} L${x - 1} ${y + 4} M${x + 5} ${y - 4} L${x + 1} ${y + 4} M${x - 3} ${y - 5} H${x + 4}"/>`,
    db: (x, y) => `<ellipse cx="${x}" cy="${y - 6}" rx="8" ry="3"/><path d="M${x - 8} ${y - 6} v12 a8 3 0 0 0 16 0 v-12 M${x - 8} ${y} a8 3 0 0 0 16 0"/>`,
    plug: (x, y) => `<path d="M${x - 4} ${y - 9} v5 M${x + 4} ${y - 9} v5 M${x - 7} ${y - 4} h14 v4 a7 7 0 0 1 -14 0 z M${x} ${y + 7} v4"/>`,
  };
  caps.forEach(([t, sub, g], i) => {
    const y = 330 + i * 42;
    s += `<g opacity="1">${enter(.3 + i * .25)}<rect x="32" y="${y}" width="32" height="32" rx="9" fill="url(#${p}tile)" stroke="#fff" stroke-opacity=".1"/>
<g stroke="${C.tx}" stroke-width="1.6" fill="none" stroke-linecap="round">${glyph[g](48, y + 16)}</g>
<text x="78" y="${y + 14}" class="d" font-size="15" fill="${C.tx}">${t}</text>
<text x="78" y="${y + 29}" class="m" font-size="11" fill="${C.dim}">${sub}</text></g>`;
  });
  const X = 612;
  s += `${label(X + 24, 44, '// OFF THE KEYBOARD', C.m)}${title(X + 24, 80, 'Life beyond the terminal')}`;
  const N = 4, D = '16s', segW = 129;
  for (let i = 0; i < N; i++) {
    const x = X + 24 + i * (segW + 8);
    const kt = i === 0 ? '0;.25;1' : i === N - 1 ? `0;.75;1` : `0;${i / N};${(i + 1) / N};1`;
    const v = i === 0 ? `0;${segW};${segW}` : i === N - 1 ? `0;0;${segW}` : `0;0;${segW};${segW}`;
    s += `<rect x="${x}" y="98" width="${segW}" height="4" rx="2" fill="#fff" fill-opacity=".14"/>
<rect x="${x}" y="98" width="${i ? 0 : segW}" height="4" rx="2" fill="url(#${p}aur)"><animate attributeName="width" values="${v}" keyTimes="${kt}" dur="${D}" repeatCount="indefinite"/></rect>`;
  }
  const cx = X + 24 + 270, cy = 205;
  const slides = [
    ['Shipping open-source PRs', `${sk} merged into github/spec-kit`, `
<g stroke="${C.y}" stroke-width="4" stroke-linecap="round" fill="none"><path d="M${cx - 120} ${cy} H${cx + 120}"/><path d="M${cx - 60} ${cy} C${cx - 30} ${cy} ${cx - 30} ${cy - 50} ${cx} ${cy - 50} H${cx + 30} C${cx + 60} ${cy - 50} ${cx + 60} ${cy} ${cx + 90} ${cy}" stroke="${C.m}"/></g>
${[-120, -60, 0, 90, 120].map(d => `<circle cx="${cx + d}" cy="${cy}" r="9" fill="#0a1420" stroke="${C.y}" stroke-width="4"/>`).join('')}
<circle cx="${cx}" cy="${cy - 50}" r="9" fill="#0a1420" stroke="${C.m}" stroke-width="4"/><circle cx="${cx + 30}" cy="${cy - 50}" r="9" fill="#0a1420" stroke="${C.m}" stroke-width="4"/>
<text x="${cx}" y="${cy + 52}" text-anchor="middle" class="d" font-size="34" fill="#fff">${sk} merged</text>`],
    ['Hackathon nights', 'DYLP GenAI Hackathon 2026 · HungerMap PK', `
<circle cx="${cx + 110}" cy="${cy - 50}" r="26" fill="#fde68a"/><circle cx="${cx + 122}" cy="${cy - 58}" r="24" fill="#0a1a24"/>
${[[-150, -60], [-90, -30], [-180, 10], [60, -70], [170, 0]].map(([dx, dy], k) => `<circle cx="${cx + dx}" cy="${cy + dy}" r="2.4" fill="#fff"><animate attributeName="opacity" values=".2;1;.2" dur="1.6s" begin="${-k * .3}s" repeatCount="indefinite"/></circle>`).join('')}
<rect x="${cx - 70}" y="${cy - 40}" width="140" height="86" rx="8" fill="#0f1c2b" stroke="${C.o}" stroke-opacity=".6"/>
<rect x="${cx - 60}" y="${cy - 30}" width="120" height="66" rx="4" fill="#081019"/>
${[0, 1, 2, 3].map(k => `<rect x="${cx - 50}" y="${cy - 20 + k * 13}" width="${[70, 90, 50, 80][k]}" height="5" rx="2.5" fill="${[C.m, C.t, C.y, C.o][k]}" opacity=".85"/>`).join('')}
<path d="M${cx - 90} ${cy + 50} H${cx + 90} l-12 10 H${cx - 78} z" fill="#16283a"/>`],
    ['Always learning', 'Panaversity Agent Factory · Anthropic certified', `
<path d="M${cx - 90} ${cy - 20} L${cx} ${cy - 60} L${cx + 90} ${cy - 20} L${cx} ${cy + 20} Z" fill="${C.t}" fill-opacity=".85"/>
<path d="M${cx - 50} ${cy} v30 c0 14 100 14 100 0 v-30 L${cx} ${cy + 20} Z" fill="#0e7490"/>
<path d="M${cx + 70} ${cy - 12} v40" stroke="${C.y}" stroke-width="3"/><circle cx="${cx + 70}" cy="${cy + 32}" r="6" fill="${C.y}"/>
<text x="${cx}" y="${cy + 72}" text-anchor="middle" class="m" font-size="13" fill="#ffd1ea">MCP · Claude Code · Claude 101</text>`],
    ['Teaching AI through play', 'AI Fluency Arcade · 13 prompting concepts', `
<rect x="${cx - 100}" y="${cy - 36}" width="200" height="90" rx="45" fill="${C.y}" fill-opacity=".92"/>
<path d="M${cx - 60} ${cy + 9} h28 M${cx - 46} ${cy - 5} v28" stroke="#3a2308" stroke-width="8" stroke-linecap="round"/>
<circle cx="${cx + 42}" cy="${cy}" r="8" fill="#3a2308"/><circle cx="${cx + 62}" cy="${cy + 18}" r="8" fill="#3a2308"/>
<text x="${cx}" y="${cy - 52}" text-anchor="middle" class="d" font-size="18" fill="${C.y}">LEVEL 13 · PROMPT MASTER</text>`],
  ];
  s += `<g clip-path="url(#${p}slides)">`;
  slides.forEach(([t, sub, art], i) => {
    const o = slot(i, N, 1, 0, .02), tr = slot(i, N, '0 0', '40 0', .02);
    s += `<g opacity="${i ? 0 : 1}"><animate attributeName="opacity" values="${o.v}" keyTimes="${o.kt}" dur="${D}" repeatCount="indefinite"/>
<g><animateTransform attributeName="transform" type="translate" values="${tr.v}" keyTimes="${tr.kt}" dur="${D}" repeatCount="indefinite"/>
<rect x="636" y="116" width="540" height="214" fill="url(#${p}s${i})"/>${art}
<rect x="636" y="282" width="540" height="48" fill="#000" fill-opacity=".35"/>
<text x="656" y="304" class="d" font-size="16" fill="#fff">${t}</text>
<text x="656" y="321" class="m" font-size="11" fill="#d9ecf2">${esc(sub)}</text></g></g>`;
  });
  s += `</g><rect x="636" y="116" width="540" height="214" rx="16" stroke="#fff" stroke-opacity=".1"/>`;
  const rings = [['CODE', .92, C.y], ['LEARN', .85, C.o], ['SHIP', .7, C.m]];
  const circ = r2(2 * Math.PI * 22);
  s += label(X + 24, 362, 'DAILY RINGS', C.dim);
  rings.forEach(([n, f, col], i) => {
    const x = X + 50 + i * 178, y = 408, off = r2(circ * (1 - f));
    s += `<circle cx="${x}" cy="${y}" r="22" stroke="#fff" stroke-opacity=".08" stroke-width="7"/>
<circle cx="${x}" cy="${y}" r="22" stroke="${col}" stroke-width="7" stroke-linecap="round" stroke-dasharray="${circ}" stroke-dashoffset="${off}" transform="rotate(-90 ${x} ${y})"><animate attributeName="stroke-dashoffset" values="${circ};${circ};${off};${off}" keyTimes="0;${r2(i * .06)};${r2(.35 + i * .06)};1" dur="6s" repeatCount="indefinite"/></circle>
<text x="${x + 36}" y="${y - 3}" class="m" font-size="11" letter-spacing="1.4" fill="${C.mu}">${n}</text>
<text x="${x + 36}" y="${y + 16}" class="d" font-size="18" fill="${C.tx}">${Math.round(f * 100)}%</text>`;
  });
  return s + '</svg>';
}

/* ------------------------------------------------------------------ stack */
function stack() {
  const p = 's', W = 1200;
  const groups = [
    ['AI / AGENTS', C.m, ['OpenAI Agents SDK', 'Claude API', 'MCP', 'RAG Pipelines', 'Prompt Engineering', 'Multi-Agent', 'Loop Engineering', 'Claude Code CLI']],
    ['FRONTEND', C.t, ['Next.js', 'React', 'TypeScript', 'Tailwind CSS', 'Framer Motion']],
    ['BACKEND & DATA', C.o, ['FastAPI', 'Python', 'Node.js', 'Neon DB', 'PostgreSQL', 'Drizzle ORM', 'Vector DBs']],
    ['VISION & DEVOPS', C.y, ['OpenCV', 'MediaPipe', 'Docker', 'Vercel', 'Git', 'GitHub Actions']],
  ];
  const X0 = 692, maxX = 1172;
  let y = 108; const chips = [], heads = [];
  groups.forEach(([g, col, items]) => {
    heads.push([g, col, y, items.length]); y += 16;
    let x = X0;
    items.forEach(t => {
      const w = Math.round(t.length * 6.9 + 22);
      if (x + w > maxX) { x = X0; y += 32; }
      chips.push([t, col, x, y, w]); x += w + 8;
    });
    y += 54;
  });
  const H = Math.max(540, y + 6);
  let s = head(p, W, H) + `
<radialGradient id="${p}core" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="#fff7d6"/><stop offset=".4" stop-color="${C.y}"/><stop offset="1" stop-color="${C.m}"/></radialGradient>
</defs>
${card(p, 0, 0, 640, H)}${card(p, 664, 0, 536, H)}
${label(28, 44, '// TECH ORBIT')}${title(28, 80, 'Everything circles the agent')}
${label(692, 44, '// TOOLKIT', C.m)}${title(692, 80, 'Grouped by craft')}`;
  const cx = 320, cy = Math.round(H / 2) + 30;
  const orbits = [
    { rx: 125, ry: 54, rot: -18, dur: 14, icons: ['python', 'typescript', 'fastapi'] },
    { rx: 200, ry: 94, rot: 20, dur: 24, icons: ['react', 'nodedotjs', 'postgresql', 'docker'] },
    { rx: 272, ry: 124, rot: -6, dur: 36, icons: ['openai', 'anthropic', 'git', 'vercel', 'opencv', 'githubactions', 'drizzle', 'framer'] },
  ];
  const pt = (o, t) => {
    const th = o.rot * Math.PI / 180, c = Math.cos(t), sn = Math.sin(t);
    return [r2(cx + o.rx * c * Math.cos(th) - o.ry * sn * Math.sin(th)), r2(cy + o.rx * c * Math.sin(th) + o.ry * sn * Math.cos(th))];
  };
  orbits.forEach((o, i) => {
    const th = o.rot * Math.PI / 180, ax = o.rx * Math.cos(th), ay = o.rx * Math.sin(th);
    const d = `M${r2(cx + ax)} ${r2(cy + ay)} A${o.rx} ${o.ry} ${o.rot} 1 1 ${r2(cx - ax)} ${r2(cy - ay)} A${o.rx} ${o.ry} ${o.rot} 1 1 ${r2(cx + ax)} ${r2(cy + ay)}`;
    s += `<path d="${d}" stroke="url(#${p}aur)" stroke-opacity=".4" stroke-dasharray="2 6"><animate attributeName="stroke-dashoffset" values="0;${i % 2 ? 32 : -32}" dur="3s" repeatCount="indefinite"/></path>`;
  });
  // shockwave rings from the core
  for (let k = 0; k < 3; k++) s += `<circle cx="${cx}" cy="${cy}" r="26" stroke="${C.o}" stroke-width="1.5" opacity="0"><animate attributeName="r" values="26;150" dur="4.5s" begin="-${k * 1.5}s" repeatCount="indefinite"/><animate attributeName="opacity" values=".6;0" dur="4.5s" begin="-${k * 1.5}s" repeatCount="indefinite"/></circle>`;
  // shooting star
  s += `<line x1="0" y1="0" x2="60" y2="0" stroke="url(#${p}aur)" stroke-width="2" stroke-linecap="round" opacity="0"><animateTransform attributeName="transform" type="translate" values="40 140;560 260;560 260" keyTimes="0;.12;1" dur="7s" repeatCount="indefinite"/><animate attributeName="opacity" values="0;1;0;0" keyTimes="0;.06;.12;1" dur="7s" repeatCount="indefinite"/></line>`;
  s += `<circle cx="${cx}" cy="${cy}" r="80" fill="url(#${p}glowM)"/>
<circle cx="${cx}" cy="${cy}" r="30" fill="${C.o}" opacity=".55" filter="url(#${p}blur)"><animate attributeName="r" values="26;34;26" dur="3s" repeatCount="indefinite"/></circle>
<circle cx="${cx}" cy="${cy}" r="26" fill="url(#${p}core)"/>
<g stroke="#fff" stroke-width="1.5" fill="none" opacity=".9"><animateTransform attributeName="transform" type="rotate" values="0 ${cx} ${cy};360 ${cx} ${cy}" dur="10s" repeatCount="indefinite"/>
<ellipse cx="${cx}" cy="${cy}" rx="18" ry="6.5"/><ellipse cx="${cx}" cy="${cy}" rx="18" ry="6.5" transform="rotate(60 ${cx} ${cy})"/><ellipse cx="${cx}" cy="${cy}" rx="18" ry="6.5" transform="rotate(-60 ${cx} ${cy})"/></g>
<circle cx="${cx}" cy="${cy}" r="3.5" fill="#fff"/>`;
  const STEPS = 72;
  let tileN = 0;
  const tile = (n, r) => `<circle r="${r}" stroke="${BRAND[n]}" stroke-width="1.2" opacity="0"><animate attributeName="r" values="${r};${r + 10}" dur="2.6s" begin="-${r2((tileN++ * .37) % 2.6)}s" repeatCount="indefinite"/><animate attributeName="opacity" values=".7;0" dur="2.6s" begin="-${r2(((tileN - 1) * .37) % 2.6)}s" repeatCount="indefinite"/></circle>
<circle r="${r}" fill="#0b1622" stroke="${BRAND[n]}" stroke-opacity=".6" stroke-width="1.4"/>${icon(n, 0, 0, r * 1.05)}`;
  orbits.forEach(o => {
    o.icons.forEach((n, k) => {
      const ph = k / o.icons.length * 2 * Math.PI;
      const vals = []; for (let j = 0; j <= STEPS; j++) vals.push(pt(o, ph + j / STEPS * 2 * Math.PI).join(' '));
      let moons = '';
      if (n === 'react') {
        ['nextdotjs', 'tailwindcss'].forEach((m, mi) => {
          const mv = []; for (let j = 0; j <= 48; j++) { const t = mi * Math.PI + j / 48 * 2 * Math.PI; mv.push(`${r2(34 * Math.cos(t))} ${r2(22 * Math.sin(t))}`); }
          moons += `<g transform="translate(${mv[0]})"><animateTransform attributeName="transform" type="translate" values="${mv.join(';')}" dur="6s" repeatCount="indefinite"/>${tile(m, 10)}</g>`;
        });
        moons = `<ellipse rx="34" ry="22" stroke="#fff" stroke-opacity=".12" stroke-dasharray="2 4"/>` + moons;
      }
      s += `<g transform="translate(${vals[0]})"><animateTransform attributeName="transform" type="translate" values="${vals.join(';')}" dur="${o.dur}s" repeatCount="indefinite"/>${moons}${tile(n, n === 'react' ? 18 : 16)}</g>`;
    });
  });
  heads.forEach(([g, col, hy, n]) => {
    s += `<text x="${X0}" y="${hy + 4}" class="m" font-size="11" letter-spacing="1.6" fill="${col}">${esc(g)} <tspan fill="${C.dim}">· ${n}</tspan></text>`;
  });
  const NC = chips.length, dur = r2(NC * .35);
  chips.forEach(([t, col, x, cy2, w], k) => {
    const a = r2(k / NC), b = r2((k + .5) / NC), c = r2(Math.min((k + 1.5) / NC, 1));
    const anim = c < 1 ? `values="0;0;1;0;0" keyTimes="0;${a};${b};${c};1"` : `values="0;0;1;0" keyTimes="0;${a};${b};1"`;
    s += `<g>${enter(k * .05, 2.6)}<rect x="${x}" y="${cy2}" width="${w}" height="24" rx="12" fill="${col}" fill-opacity=".08" stroke="#fff" stroke-opacity=".12"/>
<rect x="${x}" y="${cy2}" width="${w}" height="24" rx="12" fill="${col}" fill-opacity=".12" stroke="${col}" stroke-width="1.5" opacity="0"><animate attributeName="opacity" ${anim} dur="${dur}s" repeatCount="indefinite"/></rect>
<text x="${x + w / 2}" y="${cy2 + 16}" text-anchor="middle" class="m" font-size="11.5" fill="#d9ecf2">${esc(t)}</text></g>`;
  });
  return s + '</svg>';
}

/* ------------------------------------------------------------------ id + dashboard */
function idDash(S) {
  const p = 'i', W = 1200, H = 520;
  const sk = S.prs.filter(x => x.repo === 'github/spec-kit').length;
  let s = head(p, W, H) + hoodieDef(p) + `
<linearGradient id="${p}strap" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2b45c9"/><stop offset=".5" stop-color="${C.m}"/><stop offset="1" stop-color="#2b45c9"/></linearGradient>
<linearGradient id="${p}metal" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f1f5f9"/><stop offset=".5" stop-color="#94a3b8"/><stop offset="1" stop-color="#e2e8f0"/></linearGradient>
<linearGradient id="${p}gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fde68a"/><stop offset=".5" stop-color="#d97706"/><stop offset="1" stop-color="#fcd34d"/></linearGradient>
<linearGradient id="${p}foil" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".4" stop-color="${C.t}" stop-opacity=".22"/><stop offset=".5" stop-color="#fff" stop-opacity=".35"/><stop offset=".6" stop-color="${C.m}" stop-opacity=".22"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
<linearGradient id="${p}bar" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="${C.m}" stop-opacity=".5"/><stop offset="1" stop-color="${C.o}"/></linearGradient>
<clipPath id="${p}cardc"><rect x="50" y="168" width="240" height="330" rx="18"/></clipPath>
<clipPath id="${p}portc"><rect x="90" y="214" width="160" height="134" rx="14"/></clipPath>
<linearGradient id="${p}portBg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.o}"/><stop offset=".6" stop-color="${C.m}"/><stop offset="1" stop-color="#0a2a3a"/></linearGradient>
</defs>`;
  let bars = '', bx = 74; const rr = rng(7);
  while (bx < 262) { const w = 1 + Math.floor(rr() * 4); bars += `<rect x="${bx}" y="462" width="${w}" height="20" fill="${C.tx}" fill-opacity=".8"/>`; bx += w + 1 + Math.floor(rr() * 3); }
  s += `
<g><animateTransform attributeName="transform" type="translate" values="0 -520;0 0;0 0" keyTimes="0;.18;1" keySplines=".2 .8 .3 1;0 0 1 1" calcMode="spline" dur="3.4s" fill="freeze"/>
<g><animateTransform attributeName="transform" type="rotate" values="0 170 0;0 170 0;11 170 0;-8 170 0;5 170 0;-3 170 0;1.4 170 0;-.5 170 0;0 170 0" keyTimes="0;.18;.3;.42;.54;.66;.78;.9;1" dur="3.4s" fill="freeze"/>
<g><animateTransform attributeName="transform" type="rotate" values="0 170 0;1.2 170 0;0 170 0;-1.2 170 0;0 170 0" dur="6s" repeatCount="indefinite" additive="sum"/>
<rect x="152" y="-12" width="36" height="166" fill="url(#${p}strap)"/>
<text transform="translate(166,8) rotate(90)" class="m" font-size="8.5" letter-spacing=".8" fill="#fff" fill-opacity=".9">AGENT FACTORY · GIAIC</text>
<rect x="150" y="148" width="40" height="18" rx="4" fill="url(#${p}metal)"/><rect x="162" y="164" width="16" height="12" rx="3" stroke="url(#${p}metal)" stroke-width="3"/>
<g clip-path="url(#${p}cardc)">
<rect x="50" y="168" width="240" height="330" fill="#140a22"/><rect x="50" y="168" width="240" height="330" fill="url(#${p}dots)"/>
<rect x="50" y="168" width="240" height="6" fill="url(#${p}aur)"/>
<rect x="150" y="184" width="40" height="7" rx="3.5" fill="#000" fill-opacity=".6"/>
<text x="170" y="206" text-anchor="middle" class="m" font-size="8.5" letter-spacing="2" fill="${C.y}">AGENT FACTORY · ID</text>
<rect x="90" y="214" width="160" height="134" rx="14" fill="url(#${p}portBg)"/>
${[0, 1, 2].map(k => `<rect x="90" y="${300 + k * 10}" width="160" height="${2 + k}" fill="#140a22" opacity=".5"/>`).join('')}
<g clip-path="url(#${p}portc)"><g transform="translate(170,288) scale(.82)">${torso(p)}<g>${avatarHead({ blink: '5s' })}</g></g></g>
<rect x="90" y="214" width="160" height="134" rx="14" stroke="#fff" stroke-opacity=".15"/>
<rect x="90" y="214" width="160" height="134" rx="14" stroke="url(#${p}aur)" stroke-width="3" stroke-linecap="round" stroke-dasharray="70 520"><animate attributeName="stroke-dashoffset" values="590;0" dur="3s" repeatCount="indefinite"/></rect>
<text x="170" y="380" text-anchor="middle" class="d" font-size="23" fill="#fff">Noor ul Ain</text>
<text x="170" y="399" text-anchor="middle" class="m" font-size="9.5" letter-spacing="2.2" fill="${C.o}">AGENTIC AI ENGINEER</text>
<rect x="74" y="418" width="38" height="29" rx="5" fill="url(#${p}gold)"/><path d="M74 428 h12 v-10 M112 428 h-12 v-10 M74 438 h12 v9 M112 438 h-12 v9 M86 428 h14 v10 h-14 z" stroke="#92400e" stroke-opacity=".6" stroke-width="1"/>
<text x="126" y="430" class="m" font-size="10" fill="${C.mu}">GH <tspan fill="${C.tx}">@${USER}</tspan></text>
<text x="126" y="445" class="m" font-size="10" fill="${C.mu}">KHI · PK · ${S.generated.slice(0, 4)}</text>
${bars}
<rect x="-160" y="168" width="140" height="330" fill="url(#${p}foil)" transform="skewX(-18)"><animate attributeName="x" values="-160;-160;460" keyTimes="0;.4;1" dur="4.5s" repeatCount="indefinite"/></rect>
</g>
<rect x="50.5" y="168.5" width="239" height="329" rx="18" stroke="url(#${p}hair)" stroke-width="1.4"/>
</g></g></g>`;
  const X = 360, Wd = 840;
  s += card(p, X, 20, Wd, 480) + label(X + 32, 62, '// LIVE DASHBOARD') + title(X + 32, 96, 'Impact in numbers');
  s += `${pulseDot(X + Wd - 168, 58, '#34d399', 3.5)}<text x="${X + Wd - 156}" y="62" class="m" font-size="11" fill="${C.mu}">SYNCED ${esc(S.generated)}</text>`;
  const kpis = [['SPEC-KIT MERGES', sk, 'github/spec-kit', C.y], ['MERGED PRS', S.prs.length, 'across open source', C.o], ['IN REVIEW', S.open, 'open pull requests', C.m], ['PUBLIC REPOS', S.repos, `${S.followers} followers`, C.t]];
  const tw = (Wd - 64 - 3 * 16) / 4;
  kpis.forEach(([l, n, sub, col], i) => {
    const x = X + 32 + i * (tw + 16), y = 118;
    s += `<rect x="${x}" y="${y}" width="${tw}" height="100" rx="14" fill="#fff" fill-opacity=".03" stroke="#fff" stroke-opacity=".09"/>
<rect x="${x}" y="${y}" width="${tw}" height="100" rx="14" stroke="${col}" stroke-opacity="0"><animate attributeName="stroke-opacity" values="0;0;.8;0;0" keyTimes="0;${r2(i * .2)};${r2(i * .2 + .08)};${r2(i * .2 + .2)};1" dur="5s" repeatCount="indefinite"/></rect>
<rect x="${x + 16}" y="${y + 14}" width="18" height="3" rx="1.5" fill="${col}"/>
<text x="${x + 16}" y="${y + 34}" class="m" font-size="10" letter-spacing="1.4" fill="${C.mu}">${l}</text>
<text x="${x + 16}" y="${y + 86}" class="m" font-size="10.5" fill="${C.dim}">${esc(sub)}</text>${countUp(x + 16, y + 70, n, 36, C.tx)}`;
  });
  // merges per month: last 6 months, vertical bars
  const end = new Date(S.generated + 'T00:00:00Z'), months = [];
  for (let k = 5; k >= 0; k--) {
    const d = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - k, 1)), key = d.toISOString().slice(0, 7);
    months.push([MON[d.getUTCMonth()], S.prs.filter(x => x.date.startsWith(key)).length]);
  }
  const max = Math.max(1, ...months.map(m => m[1]));
  const bxs = X + 32, bys = 246, chH = 140, base = bys + 196;
  s += `<rect x="${bxs}" y="${bys}" width="420" height="230" rx="14" fill="#fff" fill-opacity=".03" stroke="#fff" stroke-opacity=".09"/>
<text x="${bxs + 18}" y="${bys + 28}" class="m" font-size="10" letter-spacing="1.4" fill="${C.mu}">MERGED PRS <tspan fill="${C.dim}">· last 6 months</tspan></text>
<path d="M${bxs + 18} ${base} H${bxs + 402}" stroke="#fff" stroke-opacity=".12"/>`;
  months.forEach(([m, v], i) => {
    const bw = 40, x = bxs + 30 + i * 62, h = Math.max(2, Math.round(v / max * chH)), a = r2(i * .07), b = r2(.45 + i * .07);
    s += `<rect x="${x}" y="${base - h}" width="${bw}" height="${h}" rx="6" fill="url(#${p}bar)"><animate attributeName="height" values="0;0;${h}" keyTimes="0;${a};${b}" dur="2.2s" fill="freeze"/><animate attributeName="y" values="${base};${base};${base - h}" keyTimes="0;${a};${b}" dur="2.2s" fill="freeze"/></rect>
<text x="${x + bw / 2}" y="${base - h - 7}" text-anchor="middle" class="m" font-size="11" fill="${v ? C.y : C.dim}">${v}<animate attributeName="opacity" values="0;0;1" keyTimes="0;${b};1" dur="2.2s" fill="freeze"/></text>
<text x="${x + bw / 2}" y="${base + 18}" text-anchor="middle" class="m" font-size="10.5" fill="${C.mu}">${m}</text>`;
  });
  const nx = X + 468, ny = bys, nw = Wd - 468 - 32;
  s += `<rect x="${nx}" y="${ny}" width="${nw}" height="230" rx="14" fill="#fff" fill-opacity=".03" stroke="#fff" stroke-opacity=".09"/>
${pulseDot(nx + 24, ny + 24, C.m)}
<text x="${nx + 38}" y="${ny + 28}" class="m" font-size="10" letter-spacing="1.4" fill="${C.mu}">NOW</text>`;
  const now = [['LEARNING', 'Panaversity Agent Factory'], ['SHIPPING', `spec-kit fixes · ${S.open} in review`], ['EXPLORING', 'MCP server architecture'], ['OPEN TO', 'Remote AI/ML & agentic roles']];
  now.forEach(([k, v], i) => {
    const y = ny + 62 + i * 42;
    s += `<g>${enter(.4 + i * .2)}<text x="${nx + 18}" y="${y}" class="m" font-size="9.5" letter-spacing="1.4" fill="${C.t}">▸ ${k}</text>
<text x="${nx + 18}" y="${y + 18}" class="d" font-size="14" fill="${C.tx}">${esc(v)}</text></g>`;
  });
  return s + '</svg>';
}

/* ------------------------------------------------------------------ live merge feed */
function feed(S) {
  const p = 'f', W = 1200, H = 430;
  const sk = S.prs.filter(x => x.repo === 'github/spec-kit');
  let s = head(p, W, H) + `<clipPath id="${p}term"><rect x="24" y="70" width="680" height="340" rx="14"/></clipPath>`;
  const latest = S.prs.slice(0, 8), LOOP = 14;
  latest.forEach((x, k) => {
    const a = r2((.6 + k * .9) / LOOP), b = r2((1.3 + k * .9) / LOOP);
    s += `<clipPath id="${p}l${k}"><rect x="44" y="${156 + k * 28}" width="660" height="24"><animate attributeName="width" values="0;0;660;660;0" keyTimes="0;${a};${b};.94;1" dur="${LOOP}s" repeatCount="indefinite"/></rect></clipPath>`;
  });
  s += `</defs>${card(p, 0, 0, 728, H)}${card(p, 752, 0, 448, H)}
${label(24, 44, '// LIVE FROM OPEN SOURCE')}
${pulseDot(250, 40, '#34d399', 3.5)}<text x="262" y="44" class="m" font-size="11" fill="${C.mu}">auto-synced from GitHub · ${esc(S.generated)}</text>
<rect x="24" y="70" width="680" height="340" rx="14" fill="#060d16" stroke="#fff" stroke-opacity=".1"/>
<path d="M24 102 H704" stroke="#fff" stroke-opacity=".08"/>
<circle cx="44" cy="86" r="5" fill="#f87171"/><circle cx="60" cy="86" r="5" fill="#fbbf24"/><circle cx="76" cy="86" r="5" fill="#34d399"/>
<text x="364" y="90" text-anchor="middle" class="m" font-size="11" fill="${C.dim}">noor@agent-factory: ~/open-source</text>
<text x="44" y="134" class="m" font-size="12.5" fill="${C.tx}"><tspan fill="${C.t}">$</tspan> gh search prs --author=${USER} --merged</text>`;
  latest.forEach((x, k) => {
    const y = 156 + k * 28 + 16;
    const mt = x.title.match(/^(\w+(?:\([^)]*\))?!?:)\s*(.*)$/);
    const kind = mt ? mt[1] : '', rest = mt ? mt[2] : x.title;
    const repo = x.repo.split('/')[1].slice(0, 16);
    const room = 80 - 6 - 7 - repo.length - kind.length - 2;
    const msg = rest.length > room ? rest.slice(0, room - 1) + '…' : rest;
    s += `<g clip-path="url(#${p}l${k})"><text x="44" y="${y}" class="m" font-size="12.5" fill="${C.tx}"><tspan fill="#34d399">✔</tspan> <tspan fill="${C.dim}">${x.date.slice(5)}</tspan> <tspan fill="${C.y}">#${x.number}</tspan> <tspan fill="${C.t}">${esc(repo)}</tspan> <tspan fill="${C.o}">${esc(kind)}</tspan> ${esc(msg)}</text></g>`;
  });
  const fy = 156 + latest.length * 28 + 6;
  // highlight bar that scans down the log once it has finished typing
  s += `<rect x="30" y="156" width="668" height="26" rx="6" fill="${C.y}" fill-opacity=".07" stroke="${C.y}" stroke-opacity=".25" opacity="0"><animateTransform attributeName="transform" type="translate" values="${latest.map((_, k) => `0 ${k * 28}`).join(';')}" calcMode="discrete" dur="${r2(latest.length * .5)}s" repeatCount="indefinite"/><animate attributeName="opacity" values="0;0;1;1;0" keyTimes="0;.55;.57;.92;.94" dur="${LOOP}s" repeatCount="indefinite"/></rect>`;
  s += `<path d="M44 ${fy - 12} H684" stroke="#fff" stroke-opacity=".06"/>
<text x="44" y="${fy + 8}" class="m" font-size="12" fill="${C.mu}"><tspan fill="${C.m}">${S.prs.length}</tspan> merged · <tspan fill="${C.m}">${S.open}</tspan> in review · first merge <tspan fill="${C.tx}">${esc(mdate(S.prs[S.prs.length - 1].date))}</tspan></text>`;
  // merge-day heatmap: 18 weeks ending this week
  const X = 752, end = new Date(S.generated + 'T00:00:00Z'), WEEKS = 18;
  const start = new Date(end); start.setUTCDate(end.getUTCDate() - end.getUTCDay() - (WEEKS - 1) * 7);
  const per = {}; S.prs.forEach(x => per[x.date] = (per[x.date] || 0) + 1);
  const lv = n => n === 0 ? ['#fff', .06] : n === 1 ? [C.m, .45] : n === 2 ? [C.m, .8] : n <= 4 ? [C.o, .95] : [C.y, 1];
  s += label(X + 24, 44, '// MERGE DAYS', C.m) + title(X + 24, 80, 'Shipping streak');
  const gx = X + 52, gy = 112, cs = 17, gp = 3;
  ['Mon', 'Wed', 'Fri'].forEach((d, i) => s += `<text x="${X + 24}" y="${gy + (1 + i * 2) * (cs + gp) + 12}" class="m" font-size="9" fill="${C.dim}">${d.slice(0, 1)}</text>`);
  let activeDays = 0, lastMonth = -1;
  for (let w = 0; w < WEEKS; w++) {
    for (let d = 0; d < 7; d++) {
      const day = new Date(start); day.setUTCDate(start.getUTCDate() + w * 7 + d);
      if (day > end) continue;
      const key = day.toISOString().slice(0, 10), n = per[key] || 0, [c, o] = lv(n);
      if (n) activeDays++;
      if (d === 0 && day.getUTCMonth() !== lastMonth) { lastMonth = day.getUTCMonth(); s += `<text x="${gx + w * (cs + gp)}" y="${gy - 6}" class="m" font-size="9" fill="${C.dim}">${MON[lastMonth]}</text>`; }
      const a = r2(w / WEEKS * .6), b = r2(a + .06), c2 = r2(a + .2);
      s += `<rect x="${gx + w * (cs + gp)}" y="${gy + d * (cs + gp)}" width="${cs}" height="${cs}" rx="4" fill="${c}" fill-opacity="${o}">${n ? `<animate attributeName="fill-opacity" values="${o};${o};.15;${o};${o}" keyTimes="0;${a};${b};${c2};1" dur="6s" repeatCount="indefinite"/>` : ''}</rect>`;
    }
  }
  const ly = gy + 7 * (cs + gp) + 22;
  s += `<text x="${gx}" y="${ly}" class="m" font-size="9.5" fill="${C.dim}">less</text>${[0, 1, 2, 3, 5].map((n, i) => { const [c, o] = lv(n); return `<rect x="${gx + 32 + i * 16}" y="${ly - 10}" width="12" height="12" rx="3" fill="${c}" fill-opacity="${o}"/>`; }).join('')}<text x="${gx + 116}" y="${ly}" class="m" font-size="9.5" fill="${C.dim}">more</text>`;
  const best = Object.entries(per).sort((a, b) => b[1] - a[1])[0];
  const stats = [['ACTIVE DAYS', activeDays, C.y], ['SPEC-KIT', sk.length, C.o], ['BEST DAY', best ? best[1] : 0, C.m]];
  stats.forEach(([l, v, col], i) => {
    const x = X + 24 + i * 136, y = ly + 26;
    s += `<rect x="${x}" y="${y}" width="124" height="64" rx="12" fill="#fff" fill-opacity=".03" stroke="#fff" stroke-opacity=".09"/>
<text x="${x + 14}" y="${y + 22}" class="m" font-size="9.5" letter-spacing="1.2" fill="${C.mu}">${l}</text>${countUp(x + 14, y + 52, v, 24, col)}`;
  });
  return s + '</svg>';
}

/* ------------------------------------------------------------------ journey + credentials */
function timeline(S) {
  const p = 't', W = 1200, H = 500;
  const asc = [...S.prs].reverse();
  const firstSk = asc.find(x => x.repo === 'github/spec-kit');
  const hunger = asc.find(x => /hungermap/i.test(x.repo));
  const mm = d => `${MON[+d.slice(5, 7) - 1]} ${d.slice(0, 4)}`;
  const miles = [
    ['2024', 'Joined Panaversity', 'Agent Factory · GIAIC'],
    ['Apr 2026', 'OpenClaw fixes', 'cron warning · model IDs'],
    [firstSk ? mdate(firstSk.date) : '2026', 'First spec-kit merge', firstSk ? `#${firstSk.number} · docs` : ''],
    [hunger ? mm(hunger.date) : '2026', 'DYLP GenAI Hackathon', 'HungerMap PK database'],
    [mm(S.prs[0].date), `${S.prs.filter(x => x.repo === 'github/spec-kit').length} spec-kit merges`, 'and counting →'],
  ];
  const pts = miles.map((_, i) => [110 + i * 245, i % 2 ? 222 : 176]);
  let d = `M40 ${pts[0][1]} L${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]; d += ` C${x0 + 120} ${y0} ${x1 - 120} ${y1} ${x1} ${y1}`; }
  d += ` L1160 ${pts[pts.length - 1][1]}`;
  let s = head(p, W, H) + `</defs>${card(p, 0, 0, W, H)}
${label(32, 44, '// JOURNEY')}${title(32, 80, 'From learner to open-source contributor')}
<path d="${d}" stroke="#fff" stroke-opacity=".08" stroke-width="6" stroke-linecap="round"/>
<path d="${d}" stroke="${C.o}" stroke-opacity=".5" stroke-width="1.2" stroke-dasharray="2 10" transform="translate(0 12)"><animate attributeName="stroke-dashoffset" values="0;-24" dur="1s" repeatCount="indefinite"/></path>
<path d="${d}" pathLength="1" stroke="url(#${p}aur)" stroke-width="3" stroke-linecap="round" stroke-dasharray="1" stroke-dashoffset="0"><animate attributeName="stroke-dashoffset" values="1;0" dur="2.6s" fill="freeze"/></path>
<circle r="5" fill="#fff" filter="url(#${p}neon)" opacity="0"><animateMotion path="${d}" dur="5s" begin="0s" repeatCount="indefinite"/><animate attributeName="opacity" values="0;0;1;1;0" keyTimes="0;.02;.06;.94;1" dur="5s" repeatCount="indefinite"/></circle>`;
  miles.forEach(([date, t, sub], i) => {
    const [x, y] = pts[i], up = i % 2 === 0, col = [C.y, C.o, C.m, C.t, C.y][i];
    const ty = up ? y - 52 : y + 40;
    s += `<g>${enter(.3 + i * .45, 3)}
<circle cx="${x}" cy="${y}" r="13" fill="${col}" fill-opacity=".15"><animate attributeName="r" values="11;17;11" dur="2.4s" begin="-${i * .5}s" repeatCount="indefinite"/></circle>
<circle cx="${x}" cy="${y}" r="7" fill="${C.bg}" stroke="${col}" stroke-width="3"/>
<text x="${x}" y="${ty}" text-anchor="middle" class="m" font-size="11" letter-spacing="1.2" fill="${col}">${esc(date.toUpperCase())}</text>
<text x="${x}" y="${ty + 20}" text-anchor="middle" class="d" font-size="16" fill="${C.tx}">${esc(t)}</text>
<text x="${x}" y="${ty + 37}" text-anchor="middle" class="m" font-size="10.5" fill="${C.dim}">${esc(sub)}</text></g>`;
  });
  s += label(32, 334, '// CREDENTIALS', C.m);
  const certs = [['ANTHROPIC', 'MCP Fundamentals', '#D97757'], ['ANTHROPIC', 'Claude Code in Action', '#D97757'], ['ANTHROPIC', 'Claude 101', '#D97757'], ['PANAVERSITY', 'Agent Factory Program', C.t], ['PANAVERSITY', 'Agentic AI Architecture', C.t], ['VISTA EQUITY', 'Forage Job Simulation', C.y], ['SKYSCANNER', 'Forage Job Simulation', '#38bdf8']];
  const cw = (W - 64 - 6 * 10) / 7;
  certs.forEach(([iss, name, col], i) => {
    const x = 32 + i * (cw + 10), y = 350, id = `${p}cert${i}`;
    const lines = wrap(name, 15);
    s += `<clipPath id="${id}"><rect x="${x}" y="${y}" width="${cw}" height="128" rx="14"/></clipPath><g>${enter(1.2 + i * .15, 3)}
<rect x="${x}" y="${y}" width="${cw}" height="128" rx="14" fill="#fff" fill-opacity=".03" stroke="${col}" stroke-opacity=".35"/>
<g transform="translate(${x + 28},${y + 32})"><circle r="15" fill="${col}" fill-opacity=".18" stroke="${col}" stroke-width="1.5"/><path d="M-5 -1 l4 4 l7 -8" stroke="${col}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
<g><animateTransform attributeName="transform" type="rotate" values="0;360" dur="${8 + i}s" repeatCount="indefinite"/><circle r="20" stroke="${col}" stroke-opacity=".5" stroke-dasharray="3 6"/></g></g>
<text x="${x + 14}" y="${y + 74}" class="m" font-size="9" letter-spacing="1.2" fill="${col}">${iss}</text>
${lines.map((l, k) => `<text x="${x + 14}" y="${y + 94 + k * 17}" class="d" font-size="13.5" fill="${C.tx}">${esc(l)}</text>`).join('')}
<g clip-path="url(#${id})"><rect x="${x - 80}" y="${y}" width="60" height="128" fill="url(#${p}shine)" transform="skewX(-15)"><animateTransform attributeName="transform" type="translate" values="0 0;0 0;${cw + 200} 0" keyTimes="0;${r2(i / 10)};${r2(i / 10 + .3)}" dur="6s" repeatCount="indefinite" additive="sum"/></rect></g></g>`;
  });
  return s + '</svg>';
}

/* ------------------------------------------------------------------ featured projects (deployed) */
const GLYPH = {
  bot: `<rect x="-11" y="-7" width="22" height="16" rx="5"/><path d="M0 -7 v-5"/><circle cx="0" cy="-13" r="2"/><circle cx="-4.5" cy="1" r="1.6"/><circle cx="4.5" cy="1" r="1.6"/>`,
  shield: `<path d="M0 -12 l10 4 v6 c0 7 -5 11 -10 13 c-5 -2 -10 -6 -10 -13 v-6 z"/><path d="M-4 0 l3 3 l6 -6"/>`,
  book: `<path d="M-11 -9 h8 a3 3 0 0 1 3 3 v15 a3 3 0 0 0 -3 -3 h-8 z M11 -9 h-8 a3 3 0 0 0 -3 3 v15 a3 3 0 0 1 3 -3 h8 z"/>`,
  plug: `<path d="M-4 -11 v6 M4 -11 v6 M-8 -5 h16 v4 a8 8 0 0 1 -16 0 z M0 7 v5"/>`,
  code: `<path d="M-6 -7 l-7 7 l7 7 M6 -7 l7 7 l-7 7 M3 -11 l-6 22"/>`,
  game: `<rect x="-12" y="-7" width="24" height="15" rx="7"/><path d="M-7 0 h6 M-4 -3 v6"/><circle cx="5" cy="-1" r="1.5"/><circle cx="8" cy="2" r="1.5"/>`,
  globe: `<circle r="11"/><path d="M-11 0 h22 M0 -11 c-6 6 -6 16 0 22 c6 -6 6 -16 0 -22"/>`,
  eye: `<path d="M-12 0 c6 -9 18 -9 24 0 c-6 9 -18 9 -24 0 z"/><circle r="4"/>`,
};
const liveBadge = (S, url, x, y) => {
  const up = !S.live || S.live[url] !== false;
  return up ? `${pulseDot(x, y, '#34d399', 3)}<text x="${x + 10}" y="${y + 4}" class="m" font-size="9" letter-spacing="1.2" fill="#6ee7b7">LIVE</text>`
    : `<circle cx="${x}" cy="${y}" r="3" fill="${C.dim}"/><text x="${x + 10}" y="${y + 4}" class="m" font-size="9" letter-spacing="1.2" fill="${C.dim}">OFFLINE</text>`;
};
function projects(S) {
  const p = 'p', W = 1200, cw = 270, ch = 266, gx = 16, H = 104 + 2 * ch + gx + 30;
  const cols = [C.y, C.o, C.m, C.t];
  let s = head(p, W, H) + `</defs>${card(p, 0, 0, W, H)}${label(32, 44, '// FEATURED PROJECTS')}${title(32, 80, 'Shipped, deployed, live')}`;
  const up = PROJECTS.filter(x => !S.live || S.live[x.url] !== false).length;
  s += `${pulseDot(W - 248, 58, '#34d399', 3.5)}<text x="${W - 236}" y="62" class="m" font-size="11" fill="${C.mu}">${up}/${PROJECTS.length} up · checked ${esc(S.generated)}</text>`;
  PROJECTS.forEach((it, i) => {
    const x = 32 + (i % 4) * (cw + gx), y = 104 + Math.floor(i / 4) * (ch + gx), id = `${p}pc${i}`, col = cols[i % 4];
    s += `<clipPath id="${id}"><rect x="${x}" y="${y}" width="${cw}" height="${ch}" rx="16"/></clipPath><g>${enter(.2 + i * .12, 3)}<g><animateTransform attributeName="transform" type="translate" values="0 0;0 -5;0 0" dur="${r2(4 + i * .45)}s" repeatCount="indefinite"/>
<rect x="${x}" y="${y}" width="${cw}" height="${ch}" rx="16" fill="#fff" fill-opacity=".03" stroke="#fff" stroke-opacity=".1"/>
<rect x="${x}" y="${y}" width="${cw}" height="${ch}" rx="16" stroke="${col}" stroke-opacity="0"><animate attributeName="stroke-opacity" values="0;0;.7;0;0" keyTimes="0;${r2(i / 8)};${r2(i / 8 + .06)};${r2(i / 8 + .14)};1" dur="8s" repeatCount="indefinite"/></rect>
<rect x="${x}" y="${y}" width="${cw}" height="3" fill="${col}" opacity=".9" clip-path="url(#${id})"/>
<rect x="${x + 18}" y="${y + 22}" width="44" height="44" rx="12" fill="${col}" fill-opacity=".14" stroke="${col}" stroke-opacity=".5"/>
<g transform="translate(${x + 40},${y + 44})" stroke="${col}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"><g><animateTransform attributeName="transform" type="translate" values="0 0;0 -2;0 0" dur="${2 + i * .3}s" repeatCount="indefinite"/>${GLYPH[it.g]}</g></g>
${liveBadge(S, it.url, x + cw - 64, y + 36)}
<text x="${x + 18}" y="${y + 92}" class="m" font-size="9.5" letter-spacing="1.4" fill="${col}">${it.tag}</text>
<text x="${x + 18}" y="${y + 114}" class="d" font-size="19" fill="${C.tx}">${esc(it.name)}</text>
${wrap(it.desc, 36).slice(0, 5).map((l, k) => `<text x="${x + 18}" y="${y + 138 + k * 16}" class="m" font-size="10.8" fill="#bcd2dc">${esc(l)}</text>`).join('')}
<path d="M${x + 18} ${y + ch - 52} H${x + cw - 18}" stroke="#fff" stroke-opacity=".07"/>
<text x="${x + 18}" y="${y + ch - 33}" class="m" font-size="10" fill="${C.dim}">${esc(it.stack)}</text>
<text x="${x + 18}" y="${y + ch - 14}" class="m" font-size="10.5" fill="${C.o}">${esc(host(it.url).slice(0, 34))}</text>
<g><animateTransform attributeName="transform" type="translate" values="0 0;3 -3;0 0" dur="1.6s" begin="-${r2(i * .2)}s" repeatCount="indefinite"/><path d="M${x + cw - 30} ${y + ch - 14} l8 -8 M${x + cw - 28} ${y + ch - 22} h6 v6" stroke="${C.o}" stroke-width="1.6" stroke-linecap="round"/></g>
<g clip-path="url(#${id})"><rect x="${x - 120}" y="${y}" width="80" height="${ch}" fill="url(#${p}shine)"><animateTransform attributeName="transform" type="translate" values="0 0;0 0;${cw + 200} 0" keyTimes="0;${r2(i / 9)};${r2(i / 9 + .25)}" dur="7s" repeatCount="indefinite"/></rect></g></g></g>`;
  });
  return s + '</svg>';
}

/* ------------------------------------------------------------------ client & creative builds */
function builds(S) {
  const p = 'b', W = 1200, H = 330, tw = (W - 64 - 4 * 14) / 5, th = 96;
  let s = head(p, W, H) + `</defs>${card(p, 0, 0, W, H)}${label(32, 44, '// CLIENT & CREATIVE BUILDS', C.t)}${title(32, 80, 'More live on the web')}`;
  BUILDS.forEach((b, i) => {
    const x = 32 + (i % 5) * (tw + 14), y = 102 + Math.floor(i / 5) * (th + 14), id = `${p}t${i}`;
    s += `<clipPath id="${id}"><rect x="${x}" y="${y}" width="${tw}" height="${th}" rx="14"/></clipPath><g>${enter(.2 + i * .1, 3)}
<rect x="${x}" y="${y}" width="${tw}" height="${th}" rx="14" fill="#fff" fill-opacity=".03" stroke="#fff" stroke-opacity=".1"/>
<g clip-path="url(#${id})"><rect x="${x}" y="${y}" width="4" height="${th}" fill="${b.c}"><animate attributeName="opacity" values=".35;1;.35" dur="3s" begin="-${r2(i * .3)}s" repeatCount="indefinite"/></rect>
<rect x="${x}" y="${y + th - 3}" width="0" height="3" fill="${b.c}" opacity=".8"><animate attributeName="width" values="0;0;${r2(tw)};${r2(tw)}" keyTimes="0;${r2(i / 12)};${r2(i / 12 + .25)};1" dur="5s" repeatCount="indefinite"/><animate attributeName="opacity" values=".8;.8;0" keyTimes="0;.8;1" dur="5s" repeatCount="indefinite"/></rect>
<rect x="${x - 100}" y="${y}" width="60" height="${th}" fill="url(#${p}shine)"><animateTransform attributeName="transform" type="translate" values="0 0;0 0;${r2(tw + 160)} 0" keyTimes="0;${r2(i / 12)};${r2(i / 12 + .3)}" dur="6s" repeatCount="indefinite"/></rect></g>
<text x="${x + 18}" y="${y + 26}" class="m" font-size="9" letter-spacing="1.2" fill="${b.c}">${esc(b.tag)}</text>
${liveBadge(S, b.url, x + tw - 50, y + 22)}
<text x="${x + 18}" y="${y + 52}" class="d" font-size="15.5" fill="${C.tx}">${esc(b.name)}</text>
<text x="${x + 18}" y="${y + 76}" class="m" font-size="9.6" fill="${C.mu}">${esc(host(b.url).length > 31 ? host(b.url).slice(0, 30) + '…' : host(b.url))}</text></g>`;
  });
  return s + '</svg>';
}

/* ------------------------------------------------------------------ contribution skyline */
function city(S) {
  const p = 'k', W = 1200, H = 520, K = S.contrib;
  const days = K.days, months = [];
  days.forEach(([d, n]) => { const k = d.slice(0, 7); if (!months.length || months[months.length - 1][0] !== k) months.push([k, 0]); months[months.length - 1][1] += n; });
  let run = 0, longest = 0; days.forEach(([, n]) => { run = n ? run + 1 : 0; longest = Math.max(longest, run); });
  let current = 0; for (let i = days.length - 1; i >= 0; i--) { if (days[i][1]) current++; else if (i < days.length - 1) break; }
  const best = days.reduce((a, b) => b[1] > a[1] ? b : a, ['', 0]);
  const peak = months.reduce((a, b) => b[1] > a[1] ? b : a);
  let s = head(p, W, H) + `
<linearGradient id="${p}sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#050b16"/><stop offset=".75" stop-color="#0b2236"/><stop offset="1" stop-color="#103048"/></linearGradient>
<linearGradient id="${p}bld" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#16314a"/><stop offset="1" stop-color="#0a1726"/></linearGradient>
<linearGradient id="${p}beam" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="${C.o}" stop-opacity=".35"/><stop offset="1" stop-color="${C.o}" stop-opacity="0"/></linearGradient>
<linearGradient id="${p}water" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0d2a40"/><stop offset="1" stop-color="${C.bg}"/></linearGradient>
<clipPath id="${p}scene"><rect x="330" y="100" width="840" height="390" rx="16"/></clipPath>
</defs>${card(p, 0, 0, W, H, { particles: 10 })}
${label(32, 44, '// CONTRIBUTION CITY')}${title(32, 80, `${K.total} contributions — one tower per month`)}`;
  // stats column
  const tiles = [['CONTRIBUTIONS', K.total, 'last 12 months', C.y], ['COMMITS', K.commits, `${K.prs} pull requests`, C.o], ['LONGEST STREAK', longest, 'days in a row', C.m], ['CURRENT STREAK', current, 'days and counting', C.t], ['BUSIEST DAY', best[1], best[0] ? mdate(best[0]) : '', C.y], ['PEAK MONTH', peak[1], `${MON[+peak[0].slice(5) - 1]} ${peak[0].slice(0, 4)}`, C.o]];
  tiles.forEach(([l, v, sub, col], i) => {
    const x = 32 + (i % 2) * 144, y = 100 + Math.floor(i / 2) * 132;
    s += `<g>${enter(.2 + i * .12, 3)}<rect x="${x}" y="${y}" width="134" height="120" rx="14" fill="#fff" fill-opacity=".03" stroke="#fff" stroke-opacity=".09"/>
<rect x="${x}" y="${y}" width="134" height="120" rx="14" stroke="${col}" stroke-opacity="0"><animate attributeName="stroke-opacity" values="0;0;.8;0;0" keyTimes="0;${r2(i / 7)};${r2(i / 7 + .05)};${r2(i / 7 + .14)};1" dur="7s" repeatCount="indefinite"/></rect>
<rect x="${x + 14}" y="${y + 14}" width="16" height="3" rx="1.5" fill="${col}"/>
<text x="${x + 14}" y="${y + 36}" class="m" font-size="9" letter-spacing="1.1" fill="${C.mu}">${l}</text>${countUp(x + 14, y + 80, v, 32, C.tx)}
<text x="${x + 14}" y="${y + 104}" class="m" font-size="9.5" fill="${C.dim}">${esc(sub)}</text></g>`;
  });
  // skyline scene
  const sx = 330, sy = 100, sw = 840, sh = 390, ground = sy + 300, max = Math.max(...months.map(m => m[1]), 1);
  const rnd = rng(42);
  let stars = '';
  for (let k = 0; k < 40; k++) stars += `<circle cx="${r2(sx + rnd() * sw)}" cy="${r2(sy + 8 + rnd() * 150)}" r="${r2(.5 + rnd() * 1.1)}" fill="#fff"><animate attributeName="opacity" values=".15;.9;.15" dur="${r2(1.5 + rnd() * 3)}s" begin="-${r2(rnd() * 3)}s" repeatCount="indefinite"/></circle>`;
  s += `<g clip-path="url(#${p}scene)">
<rect x="${sx}" y="${sy}" width="${sw}" height="${sh}" fill="url(#${p}sky)"/>${stars}
<circle cx="${sx + sw - 90}" cy="${sy + 70}" r="30" fill="#e8fbff"/><circle cx="${sx + sw - 78}" cy="${sy + 62}" r="27" fill="#07101c"/>
<circle cx="${sx + sw - 90}" cy="${sy + 70}" r="60" fill="${C.o}" opacity=".12" filter="url(#${p}blur)"/>
${[0, 1].map(k => `<path d="M${sx + 200 + k * 420} ${ground} L${sx + 170 + k * 420} ${sy - 40} L${sx + 230 + k * 420} ${sy - 40} Z" fill="url(#${p}beam)"><animateTransform attributeName="transform" type="rotate" values="-25 ${sx + 200 + k * 420} ${ground};25 ${sx + 200 + k * 420} ${ground};-25 ${sx + 200 + k * 420} ${ground}" dur="${8 + k * 3}s" repeatCount="indefinite"/></path>`).join('')}
<line x1="0" y1="0" x2="70" y2="0" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity="0"><animateTransform attributeName="transform" type="translate" values="${sx + 40} ${sy + 30};${sx + 460} ${sy + 120};${sx + 460} ${sy + 120}" keyTimes="0;.1;1" dur="9s" repeatCount="indefinite"/><animate attributeName="opacity" values="0;1;0;0" keyTimes="0;.05;.1;1" dur="9s" repeatCount="indefinite"/></line>`;
  const colW = sw / months.length;
  let labels = '';
  months.forEach(([m, n], i) => {
    const bw = Math.round(colW * (.62 + rnd() * .16)), x = Math.round(sx + i * colW + (colW - bw) / 2);
    const h = Math.max(14, Math.round(n / max * 230)), y = ground - h, isPeak = m === peak[0];
    const a = r2(.05 + i * .05), b = r2(Math.min(.95, a + .35));
    let win = '';
    for (let wy = y + 12; wy < ground - 10; wy += 14) for (let wx = x + 6; wx < x + bw - 8; wx += 10) {
      if (rnd() < .45) continue;
      const lit = rnd(), c = lit > .85 ? C.y : lit > .6 ? C.o : '#ffe9a8';
      win += `<rect x="${wx}" y="${wy}" width="5" height="7" rx="1" fill="${c}" opacity="${r2(.35 + rnd() * .5)}">${rnd() < .25 ? `<animate attributeName="opacity" values=".1;.9;.1" dur="${r2(2 + rnd() * 5)}s" begin="-${r2(rnd() * 5)}s" repeatCount="indefinite"/>` : ''}</rect>`;
    }
    s += `<g><animateTransform attributeName="transform" type="translate" values="0 ${h + 20};0 ${h + 20};0 0" keyTimes="0;${a};${b}" keySplines="0 0 1 1;.2 .9 .3 1" calcMode="spline" dur="3s" fill="freeze"/>
<rect x="${x}" y="${y}" width="${bw}" height="${h}" fill="url(#${p}bld)" stroke="${isPeak ? C.y : C.o}" stroke-opacity="${isPeak ? .8 : .25}"/>${win}
${isPeak ? `<path d="M${x + bw / 2} ${y} v-26" stroke="${C.y}" stroke-width="2"/><circle cx="${x + bw / 2}" cy="${y - 28}" r="3.5" fill="#ef4444"><animate attributeName="opacity" values="1;.1;1" dur="1.2s" repeatCount="indefinite"/></circle>` : ''}
<text x="${x + bw / 2}" y="${y - (isPeak ? 40 : 8)}" text-anchor="middle" class="m" font-size="10.5" fill="${isPeak ? C.y : C.mu}">${n}</text></g>`;
    labels += `<text x="${x + bw / 2}" y="${ground + 32}" text-anchor="middle" class="m" font-size="10" fill="${C.mu}">${MON[+m.slice(5) - 1]}</text>`;
  });
  // water reflection + road with moving car lights
  s += `<rect x="${sx}" y="${ground}" width="${sw}" height="${sh - 300}" fill="url(#${p}water)"/>
<rect x="${sx}" y="${ground}" width="${sw}" height="14" fill="#0b1724"/>
<path d="M${sx} ${ground + 7} H${sx + sw}" stroke="${C.y}" stroke-opacity=".5" stroke-dasharray="14 12"><animate attributeName="stroke-dashoffset" values="0;-52" dur="1.2s" repeatCount="indefinite"/></path>
${[0, 1, 2, 3].map(k => `<g><animateTransform attributeName="transform" type="translate" values="${k % 2 ? `${sx + sw + 20} 0;${sx - 40} 0` : `${sx - 40} 0;${sx + sw + 20} 0`}" dur="${5 + k * 1.7}s" begin="-${k * 1.9}s" repeatCount="indefinite"/><rect x="0" y="${ground + (k % 2 ? 2 : 8)}" width="16" height="4" rx="2" fill="${k % 2 ? '#ef4444' : '#fef3c7'}"/><rect x="${k % 2 ? 16 : -24}" y="${ground + (k % 2 ? 3 : 9)}" width="24" height="2" fill="${k % 2 ? '#ef4444' : '#fef3c7'}" opacity=".35"/></g>`).join('')}
${[0, 1, 2, 3, 4, 5].map(k => `<path d="M${sx + 30 + k * 140} ${ground + 48 + (k % 3) * 12} h${40 + (k % 2) * 30}" stroke="${[C.o, C.y, C.m][k % 3]}" stroke-opacity=".35" stroke-width="2" stroke-linecap="round"><animateTransform attributeName="transform" type="translate" values="0 0;12 0;0 0" dur="${3 + k * .4}s" repeatCount="indefinite"/><animate attributeName="stroke-opacity" values=".1;.45;.1" dur="${2 + k * .3}s" repeatCount="indefinite"/></path>`).join('')}
${labels}</g>
<rect x="${sx}" y="${sy}" width="${sw}" height="${sh}" rx="16" stroke="#fff" stroke-opacity=".1"/>`;
  return s + '</svg>';
}

/* ------------------------------------------------------------------ connect */
function connect() {
  const p = 'c', W = 1200, H = 340;
  let s = head(p, W, H) + hoodieDef(p) + `<clipPath id="${p}cc"><rect x="0" y="0" width="${W}" height="${H}" rx="22"/></clipPath></defs>
${card(p, 0, 0, W, H, { particles: 18 })}
<circle cx="200" cy="230" r="190" fill="url(#${p}glowM)"/>
<g clip-path="url(#${p}cc)"><g transform="translate(170,206)">
${torso(p, 160)}
<g><animateTransform attributeName="transform" type="translate" values="0 0;8 0;0 0" dur="1.4s" repeatCount="indefinite"/>
<path d="M55 84 L150 70" stroke="${ARM}" stroke-width="24" stroke-linecap="round"/>
<circle cx="160" cy="69" r="14" fill="${C.skin}"/><path d="M168 64 H192" stroke="${C.skin}" stroke-width="8" stroke-linecap="round"/></g>
<g>${avatarHead({ wink: true })}</g>
</g></g>
<g filter="url(#${p}neon)"><animate attributeName="opacity" values="1;1;.35;1;.6;1;1" keyTimes="0;.7;.72;.74;.76;.78;1" dur="5s" repeatCount="indefinite"/>
<rect x="40" y="34" width="290" height="62" rx="16" stroke="${C.m}" stroke-width="2.2"><animate attributeName="stroke" values="${C.y};${C.o};${C.m};${C.o};${C.y}" dur="6s" repeatCount="indefinite"/></rect>
<text x="185" y="75" text-anchor="middle" class="d" font-size="28" fill="#fff" stroke="${C.m}" stroke-width=".8">${USER}</text></g>`;
  const spark = (x, y, r, k) => `<path d="M${x} ${y - r} Q${x} ${y} ${x + r} ${y} Q${x} ${y} ${x} ${y + r} Q${x} ${y} ${x - r} ${y} Q${x} ${y} ${x} ${y - r} Z" fill="${C.y}"><animate attributeName="opacity" values=".1;1;.1" dur="1.8s" begin="${-k * .45}s" repeatCount="indefinite"/></path>`;
  s += spark(350, 40, 9, 0) + spark(30, 130, 7, 1) + spark(360, 150, 6, 2) + spark(70, 200, 5, 3);
  const heart = (x, k) => `<path d="M0 3 C-6 -4 -12 2 0 10 C12 2 6 -4 0 3 Z" fill="${C.m}" opacity="0" transform="translate(${x},300)"><animateTransform attributeName="transform" type="translate" values="${x} 300;${x + 6} 230;${x - 4} 170" dur="4s" begin="${-k * 1.3}s" repeatCount="indefinite"/><animate attributeName="opacity" values="0;.9;0" dur="4s" begin="${-k * 1.3}s" repeatCount="indefinite"/></path>`;
  s += heart(300, 0) + heart(330, 1) + heart(50, 2);
  s += label(450, 52, '// CONNECT', C.m) + title(450, 88, "Let's build something agentic", 28);
  const links = [['linkedin', 'LinkedIn', 'in/noor-mudasir-299a64256'], ['github', 'GitHub', '@' + USER], ['vercel', 'Portfolio', PORTFOLIO], ['gmail', 'Email', 'aina25239@gmail.com']];
  links.forEach(([ic, t, h], i) => {
    const x = 450 + (i % 2) * 362, y = 118 + Math.floor(i / 2) * 96, w = 346, hh = 80;
    s += `<g>${enter(.3 + i * .2)}<rect x="${x}" y="${y}" width="${w}" height="${hh}" rx="16" fill="#fff" fill-opacity=".035" stroke="#fff" stroke-opacity=".1"/>
<rect x="${x}" y="${y}" width="${w}" height="${hh}" rx="16" stroke="${C.o}" stroke-opacity="0"><animate attributeName="stroke-opacity" values="0;0;.8;0;0" keyTimes="0;${r2(i * .2)};${r2(i * .2 + .08)};${r2(i * .2 + .2)};1" dur="4s" repeatCount="indefinite"/></rect>
<rect x="${x + 16}" y="${y + 18}" width="44" height="44" rx="12" fill="#0b1622" stroke="${BRAND[ic]}" stroke-opacity=".5"/>${icon(ic, x + 38, y + 40, 22)}
<text x="${x + 76}" y="${y + 36}" class="d" font-size="17" fill="${C.tx}">${t}</text>
<text x="${x + 76}" y="${y + 56}" class="m" font-size="11.5" fill="${C.mu}">${esc(h)}</text>
<g><animateTransform attributeName="transform" type="translate" values="0 0;0 0;6 0;0 0;0 0" keyTimes="0;${r2(i * .15)};${r2(i * .15 + .1)};${r2(i * .15 + .2)};1" dur="3s" repeatCount="indefinite"/>
<path d="M${x + w - 38} ${y + 40} H${x + w - 20} M${x + w - 27} ${y + 33} L${x + w - 20} ${y + 40} L${x + w - 27} ${y + 47}" stroke="${C.o}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></g></g>`;
  });
  return s + '</svg>';
}

/* ------------------------------------------------------------------ divider */
function divider() {
  const p = 'v', W = 1200, H = 40;
  // heartbeat line: flat runs with an EKG spike every 300px
  const d = 'M0 20 ' + Array.from({ length: 4 }, (_, k) => { const x = k * 300; return `H${x + 120} L${x + 132} 12 L${x + 142} 34 L${x + 152} 4 L${x + 164} 30 L${x + 172} 20`; }).join(' ') + ' H1200';
  return head(p, W, H, { noFont: true }) + `</defs>
<path d="${d}" stroke="#fff" stroke-opacity=".07" stroke-width="2"/>
<path d="${d}" pathLength="1" stroke="url(#${p}aur)" stroke-width="2.2" stroke-linejoin="round" stroke-dasharray=".25 .75" filter="url(#${p}neon)"><animate attributeName="stroke-dashoffset" values=".25;-.75" dur="3s" repeatCount="indefinite"/></path>
<circle r="4" fill="#fff" filter="url(#${p}neon)"><animateMotion path="${d}" dur="6s" repeatCount="indefinite"/></circle>
<circle r="3" fill="${C.y}" filter="url(#${p}neon)"><animateMotion path="${d}" dur="6s" begin="-3s" repeatCount="indefinite"/></circle>
</svg>`;
}

/* ------------------------------------------------------------------ README sync */
function syncReadme(S, version) {
  const f = path.join(ROOT, 'README.md');
  let md = fs.readFileSync(f, 'utf8');
  const vals = { merged: S.prs.length, speckit: S.prs.filter(x => x.repo === 'github/spec-kit').length, open: S.open, synced: S.generated };
  md = md.replace(/<!--S:(\w+)-->[\s\S]*?<!--\/S-->/g, (m, k) => k in vals ? `<!--S:${k}-->${vals[k]}<!--/S-->` : m);
  const latest = S.prs.slice(0, 6).map(x => `- ✅ \`${x.date}\` [${x.repo}#${x.number}](${x.url}) — ${x.title.replace(/[[\]]/g, '')}`).join('\n');
  md = md.replace(/<!-- LATEST:START -->[\s\S]*?<!-- LATEST:END -->/, `<!-- LATEST:START -->\n${latest}\n<!-- LATEST:END -->`);
  const st = u => !S.live || S.live[u] !== false ? '🟢 live' : '⚪ offline';
  const rows = [
    '| | Project | What it is | Live link |', '|---|---|---|---|',
    ...PROJECTS.map(x => `| ${st(x.url)} | **${x.name}** | ${x.desc} | [${host(x.url)}](${x.url}) |`),
    ...BUILDS.map(x => `| ${st(x.url)} | **${x.name}** | ${x.tag.charAt(0) + x.tag.slice(1).toLowerCase()} | [${host(x.url)}](${x.url}) |`),
  ].join('\n');
  md = md.replace(/<!-- PROJECTS:START -->[\s\S]*?<!-- PROJECTS:END -->/, `<!-- PROJECTS:START -->\n${rows}\n<!-- PROJECTS:END -->`);
  if (S.contrib) {
    const v2 = { contrib: S.contrib.total, commits: S.contrib.commits };
    md = md.replace(/<!--C:(\w+)-->[\s\S]*?<!--\/C-->/g, (m, k) => k in v2 ? `<!--C:${k}-->${v2[k]}<!--/C-->` : m);
  }
  md = md.replace(/\.svg\?v=[\w-]+/g, `.svg?v=${version}`);
  fs.writeFileSync(f, md);
}

(async () => {
  const S = await loadStats();
  const files = { 'hero.svg': hero, 'about-life.svg': about, 'stack.svg': stack, 'id-dashboard.svg': idDash, 'feed.svg': feed, 'timeline.svg': timeline, 'projects.svg': projects, 'deploys.svg': builds, 'city.svg': city, 'connect.svg': connect, 'divider.svg': divider };
  const hash = crypto.createHash('sha1');
  for (const [f, fn] of Object.entries(files)) {
    const svg = fn(S);
    fs.writeFileSync(path.join(ROOT, f), svg);
    hash.update(svg);
    console.log(f.padEnd(18), (svg.length / 1024).toFixed(1) + 'KB');
  }
  syncReadme(S, hash.digest('hex').slice(0, 8));
  console.log(`${S.prs.length} merged PRs, ${S.open} open, synced ${S.generated}`);
})();
