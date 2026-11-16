// Generates Promora's original vector brand assets. Run: node scripts/generate-assets.mjs
// Everything here is hand-authored SVG geometry: no third-party artwork, logos or photographs.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'frontend', 'public', 'assets');
const V = '#6C4CF1', B = '#3B82F6', N = '#111827', L = '#F1EDFF', W = '#FFFFFF', T = '#172033', S = '#F8FAFC';
const manifest = [];
const out = (path, svg, meta) => {
  const file = join(root, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, svg.trim() + '\n');
  manifest.push({ id: path.replace(/\.svg$/, '').replace(/\//g, '.'), path: '/assets/' + path, format: 'svg', status: 'final', source: 'original vector (scripts/generate-assets.mjs)', ...meta });
};
const grad = (id, a = V, b = B) => `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;

// ---- Brand mark: a "P" whose bowl opens into an upward path ending in a node (growth + connection).
const mark = (x, y, s, { tile = true, ink = W, mono = null } = {}) => `
<g transform="translate(${x} ${y}) scale(${s / 64})">
  ${tile ? `<rect width="64" height="64" rx="16" fill="${mono ?? 'url(#pm)'}"/>` : ''}
  <path d="M22 48V20h12a9 9 0 0 1 0 18H22" fill="none" stroke="${ink}" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M38 30l9-9" fill="none" stroke="${ink}" stroke-width="4" stroke-linecap="round" opacity=".55"/>
  <circle cx="49" cy="17" r="4.5" fill="${ink}"/>
</g>`;
const wordmark = (x, y, color, size = 30) =>
  `<text x="${x}" y="${y}" font-family="'Plus Jakarta Sans Variable','Plus Jakarta Sans',Inter,Arial,sans-serif" font-size="${size}" font-weight="800" letter-spacing="3" fill="${color}">PROMORA</text>`;

out('brand/logo-icon.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="Promora"><defs>${grad('pm')}</defs>${mark(0, 0, 64)}</svg>`,
  { purpose: 'Standalone brand icon', width: 64, height: 64, alt: 'Promora icon' });
out('brand/favicon.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs>${grad('pm')}</defs>${mark(0, 0, 64)}</svg>`,
  { purpose: 'Favicon', width: 64, height: 64, alt: '' });
out('brand/logo-horizontal.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 64" role="img" aria-label="Promora"><defs>${grad('pm')}</defs>${mark(0, 8, 48)}${wordmark(62, 43, N)}</svg>`,
  { purpose: 'Primary logo for light backgrounds', width: 260, height: 64, alt: 'Promora' });
out('brand/logo-horizontal-white.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 64" role="img" aria-label="Promora"><defs>${grad('pm')}</defs>${mark(0, 8, 48)}${wordmark(62, 43, W)}</svg>`,
  { purpose: 'Logo for dark backgrounds', width: 260, height: 64, alt: 'Promora' });
out('brand/logo-mono.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 64" role="img" aria-label="Promora">${mark(0, 8, 48, { mono: N })}${wordmark(62, 43, N)}</svg>`,
  { purpose: 'Single-colour logo', width: 260, height: 64, alt: 'Promora' });
out('brand/og-default.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630"><defs>${grad('pm')}${grad('bg', '#1B1F3B', N)}</defs><rect width="1200" height="630" fill="url(#bg)"/>
<circle cx="1020" cy="120" r="260" fill="${V}" opacity=".18"/><circle cx="1100" cy="520" r="180" fill="${B}" opacity=".16"/>
${mark(90, 200, 120)}${wordmark(240, 285, W, 76)}
<text x="92" y="400" font-family="Inter,Arial,sans-serif" font-size="34" fill="#C7CBE6">One Platform. Infinite Possibilities.</text></svg>`,
  { purpose: 'Default Open Graph image', width: 1200, height: 630, alt: 'Promora: One Platform. Infinite Possibilities.' });

// ---- Shared illustration pieces
const card = (x, y, w, h, body = '', r = 18) => `<g transform="translate(${x} ${y})"><rect width="${w}" height="${h}" rx="${r}" fill="${W}" filter="url(#sh)"/>${body}</g>`;
const defs = `<defs>${grad('pm')}${grad('soft', '#EDE8FF', '#E3EEFF')}<filter id="sh" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="14" stdDeviation="16" flood-color="#3B2A8C" flood-opacity=".14"/></filter></defs>`;
const bars = (x, y, hs, c = V) => hs.map((h, i) => `<rect x="${x + i * 22}" y="${y - h}" width="14" height="${h}" rx="5" fill="${c}" opacity="${0.45 + i * 0.55 / hs.length}"/>`).join('');
const line = (w, c = '#E4E7F2', y = 0, x = 0) => `<rect x="${x}" y="${y}" width="${w}" height="9" rx="4.5" fill="${c}"/>`;
const avatar = (cx, cy, r, c) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${c}"/><circle cx="${cx}" cy="${cy - r * 0.18}" r="${r * 0.36}" fill="${W}" opacity=".9"/><path d="M${cx - r * 0.62} ${cy + r * 0.72}a${r * 0.62} ${r * 0.5} 0 0 1 ${r * 1.24} 0" fill="${W}" opacity=".9"/>`;

out('hero/hero-main.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 760" role="img" aria-label="A growth hub connecting businesses, creators and audiences">${defs}
<circle cx="520" cy="380" r="330" fill="url(#soft)"/><circle cx="520" cy="380" r="238" fill="none" stroke="${V}" stroke-opacity=".16" stroke-width="2" stroke-dasharray="4 10"/>
<circle cx="520" cy="380" r="150" fill="none" stroke="${B}" stroke-opacity=".2" stroke-width="2"/>
<g fill="none" stroke-width="3" stroke-linecap="round"><path d="M520 380C420 300 330 250 236 214" stroke="${V}" stroke-opacity=".5"/><path d="M520 380C640 300 720 250 800 196" stroke="${B}" stroke-opacity=".5"/>
<path d="M520 380C420 470 330 540 250 580" stroke="${B}" stroke-opacity=".45"/><path d="M520 380C640 470 720 520 800 566" stroke="${V}" stroke-opacity=".45"/></g>
<circle cx="520" cy="380" r="86" fill="url(#pm)" filter="url(#sh)"/>${mark(476, 336, 88, { tile: false })}
${card(96, 120, 280, 176, `<rect x="20" y="20" width="76" height="76" rx="14" fill="${L}"/><path d="M42 74V46l32 14z" fill="${V}"/>${line(130, '#D9DCEC', 30, 112)}${line(92, '#E9EBF5', 52, 112)}<rect x="112" y="74" width="74" height="24" rx="12" fill="${V}" opacity=".14"/><rect x="20" y="118" width="240" height="38" rx="12" fill="${V}"/>${line(96, W, 133, 92)}`)}
${card(640, 96, 240, 190, `${line(110, '#D9DCEC', 24, 22)}<text x="22" y="76" font-family="Inter,Arial,sans-serif" font-size="30" font-weight="700" fill="${T}">+ growth</text>${bars(26, 166, [34, 52, 44, 70, 62, 92, 84, 110], B)}`)}
${card(120, 500, 250, 150, `${avatar(52, 56, 30, B)}${line(120, '#D9DCEC', 36, 98)}${line(84, '#E9EBF5', 58, 98)}<rect x="22" y="104" width="62" height="24" rx="12" fill="${L}"/><rect x="92" y="104" width="62" height="24" rx="12" fill="#E3EEFF"/><rect x="162" y="104" width="62" height="24" rx="12" fill="${L}"/>`)}
${card(660, 500, 220, 150, `<circle cx="52" cy="52" r="28" fill="${L}"/><path d="M40 60l10-12 8 8 10-14" fill="none" stroke="${V}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>${line(100, '#D9DCEC', 34, 96)}${line(70, '#E9EBF5', 56, 96)}<rect x="22" y="100" width="176" height="12" rx="6" fill="#E9EBF5"/><rect x="22" y="100" width="118" height="12" rx="6" fill="url(#pm)"/>`)}

<circle cx="430" cy="92" r="10" fill="${V}" opacity=".35"/><circle cx="596" cy="700" r="14" fill="${B}" opacity=".3"/><circle cx="900" cy="380" r="8" fill="${V}" opacity=".4"/>
</svg>`, { purpose: 'Homepage hero illustration', width: 960, height: 760, alt: 'A growth hub connecting businesses, creators and audiences', placement: 'Home hero' });

out('illustrations/advertiser.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 480" role="img" aria-label="A business owner creating a campaign">${defs}
<rect x="40" y="40" width="560" height="400" rx="40" fill="url(#soft)"/>
${card(120, 110, 400, 250, `<rect width="400" height="44" rx="18" fill="#F3F4FA"/><circle cx="26" cy="22" r="6" fill="#D5D8E8"/><circle cx="46" cy="22" r="6" fill="#D5D8E8"/>
${line(150, '#D9DCEC', 70, 28)}${line(220, '#E9EBF5', 94, 28)}${line(190, '#E9EBF5', 114, 28)}<rect x="28" y="150" width="150" height="72" rx="14" fill="${L}"/>${bars(46, 208, [18, 30, 24, 42, 50], V)}
<rect x="196" y="150" width="176" height="72" rx="14" fill="#E3EEFF"/><text x="214" y="196" font-family="Inter,Arial,sans-serif" font-size="26" font-weight="700" fill="${T}">Reach</text><rect x="268" y="66" width="104" height="34" rx="17" fill="${V}"/>${line(56, W, 79, 292)}`)}
${card(70, 300, 150, 96, `${avatar(40, 48, 24, V)}${line(60, '#D9DCEC', 34, 76)}${line(44, '#E9EBF5', 54, 76)}`, 16)}
${card(450, 70, 130, 96, `<path d="M26 66l22-24 16 14 26-32" fill="none" stroke="${B}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="90" cy="24" r="7" fill="${B}"/>`, 16)}
</svg>`, { purpose: 'For Advertisers section', width: 640, height: 480, alt: 'A business owner creating a campaign with analytics around the workspace' });

out('illustrations/creator.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 480" role="img" aria-label="A creator discovering promotional opportunities">${defs}
<rect x="40" y="40" width="560" height="400" rx="40" fill="url(#soft)"/>
<g transform="translate(240 70)"><rect width="170" height="340" rx="30" fill="${N}" filter="url(#sh)"/><rect x="10" y="12" width="150" height="316" rx="22" fill="${W}"/><rect x="60" y="20" width="50" height="8" rx="4" fill="#D5D8E8"/>
<rect x="22" y="44" width="126" height="92" rx="14" fill="url(#pm)"/><path d="M74 74v32l28-16z" fill="${W}"/>${line(96, '#D9DCEC', 150, 22)}${line(64, '#E9EBF5', 170, 22)}
<rect x="22" y="196" width="126" height="46" rx="12" fill="${L}"/>${line(70, V, 214, 36)}<rect x="22" y="254" width="126" height="46" rx="12" fill="#E3EEFF"/>${line(84, B, 272, 36)}</g>
${card(70, 120, 150, 110, `${avatar(40, 44, 22, B)}${line(56, '#D9DCEC', 30, 74)}${line(40, '#E9EBF5', 50, 74)}<rect x="18" y="78" width="114" height="14" rx="7" fill="${L}"/>`, 16)}
${card(430, 250, 150, 110, `<circle cx="40" cy="42" r="22" fill="${L}"/><text x="31" y="51" font-family="Inter,Arial,sans-serif" font-size="24" font-weight="700" fill="${V}">₹</text>${line(56, '#D9DCEC', 30, 74)}${line(40, '#E9EBF5', 50, 74)}${bars(20, 100, [8, 14, 12, 20, 18], V)}`, 16)}
<path d="M220 176c20 0 20 30 40 30M410 300c14 0 12-20 30-20" fill="none" stroke="${V}" stroke-width="3" stroke-dasharray="3 8" stroke-linecap="round"/>
</svg>`, { purpose: 'For Creators section', width: 640, height: 480, alt: 'A creator with a phone, profile cards and earnings indicators' });

out('illustrations/marketplace.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 480" role="img" aria-label="A marketplace of promotional opportunities">${defs}
<rect x="40" y="40" width="560" height="400" rx="40" fill="url(#soft)"/>
${[[80, 90, V], [250, 70, B], [420, 100, V], [120, 270, B], [300, 250, V], [460, 280, B]].map(([x, y, c], i) => card(x, y, 150, 150, `<rect x="14" y="14" width="122" height="62" rx="12" fill="${c}" opacity="${i % 2 ? 0.16 : 0.9}"/>${line(86, '#D9DCEC', 90, 14)}${line(60, '#E9EBF5', 108, 14)}<rect x="14" y="124" width="52" height="14" rx="7" fill="${c}" opacity=".22"/>`, 16)).join('')}
<g fill="none" stroke="${V}" stroke-opacity=".5" stroke-width="3" stroke-dasharray="3 8" stroke-linecap="round"><path d="M230 160h20M400 150h20M270 320h30M450 330h10"/></g>
</svg>`, { purpose: 'Marketplace section', width: 640, height: 480, alt: 'Floating campaign cards across business categories' });

// ---- Empty states: one consistent minimal style
const empty = (name, label, glyph) => out(`illustrations/empty-${name}.svg`, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" role="img" aria-label="${label}">
<ellipse cx="120" cy="154" rx="78" ry="9" fill="#E9EBF5"/><circle cx="120" cy="84" r="62" fill="${L}"/>${glyph}
<circle cx="46" cy="44" r="5" fill="${B}" opacity=".5"/><circle cx="198" cy="58" r="4" fill="${V}" opacity=".5"/><circle cx="188" cy="128" r="6" fill="${B}" opacity=".25"/></svg>`,
  { purpose: `Empty state: ${label}`, width: 240, height: 180, alt: label });
const st = `fill="none" stroke="${V}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"`;
empty('campaigns', 'No campaigns found', `<path d="M88 96V74l48-18v58l-48-18z" ${st}/><path d="M96 98v16a8 8 0 0 0 16 0v-10M148 72c8 6 8 20 0 26" ${st}/>`);
empty('promotions', 'No active promotions', `<path d="M112 92l-8 8a14 14 0 0 1-20-20l14-14a14 14 0 0 1 20 0M128 76l8-8a14 14 0 0 1 20 20l-14 14a14 14 0 0 1-20 0" ${st}/>`);
empty('notifications', 'No notifications', `<path d="M96 104V84a24 24 0 0 1 48 0v20l8 10H88zM112 122a8 8 0 0 0 16 0" ${st}/>`);
empty('transactions', 'No transactions', `<rect x="82" y="62" width="76" height="50" rx="10" ${st}/><path d="M82 80h76M96 98h18" ${st}/>`);
empty('referrals', 'No referrals', `<circle cx="104" cy="76" r="12" ${st}/><circle cx="142" cy="92" r="9" ${st}/><path d="M84 114a20 20 0 0 1 40 0M130 114a14 14 0 0 1 26 0" ${st}/>`);
empty('search', 'No search results', `<circle cx="114" cy="80" r="22" ${st}/><path d="M131 97l20 20" ${st}/>`);
empty('analytics', 'No analytics available', `<path d="M86 116V60M86 116h70" ${st}/><path d="M100 100V88M118 100V74M136 100V82" ${st}/>`);

// ---- Category artwork (also used as the default campaign image)
const cats = {
  'businesses-startups': `<rect x="150" y="96" width="60" height="108" rx="6"/><rect x="216" y="130" width="40" height="74" rx="6"/><path d="M166 116h10M186 116h10M166 138h10M186 138h10M166 160h10M186 160h10M230 150h12M230 170h12" stroke-width="7"/>`,
  'products-stores': `<path d="M150 128h100l-10 80h-80z"/><path d="M176 128v-12a24 24 0 0 1 48 0v12"/>`,
  'apps-websites': `<rect x="166" y="88" width="68" height="124" rx="14"/><path d="M190 192h20"/><rect x="180" y="106" width="16" height="16" rx="4"/><rect x="204" y="106" width="16" height="16" rx="4"/><rect x="180" y="130" width="16" height="16" rx="4"/>`,
  'creators-channels': `<rect x="144" y="104" width="112" height="84" rx="16"/><path d="M188 128v36l30-18z"/>`,
  'courses-education': `<path d="M134 136l66-32 66 32-66 32z"/><path d="M160 152v32c22 16 58 16 80 0v-32M266 136v40"/>`,
  'freelancers-agencies': `<rect x="142" y="120" width="116" height="84" rx="12"/><path d="M178 120v-12a8 8 0 0 1 8-8h28a8 8 0 0 1 8 8v12M142 158h116"/>`,
  'events-communities': `<rect x="146" y="104" width="108" height="100" rx="14"/><path d="M146 134h108M174 92v24M226 92v24M172 162h16M212 162h16"/>`,
  'local-real-estate': `<path d="M200 212s-46-44-46-80a46 46 0 0 1 92 0c0 36-46 80-46 80z"/><circle cx="200" cy="130" r="16"/>`,
  'affiliate-referral': `<path d="M190 162l-14 14a24 24 0 0 1-34-34l22-22a24 24 0 0 1 34 0M210 138l14-14a24 24 0 0 1 34 34l-22 22a24 24 0 0 1-34 0"/>`,
};
Object.entries(cats).forEach(([slug, glyph], i) => {
  const [a, b] = i % 3 === 0 ? [V, B] : i % 3 === 1 ? ['#4F46E5', V] : [B, '#22B8CF'];
  out(`categories/${slug}.svg`, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" role="img" aria-label="${slug.replace(/-/g, ' ')}"><defs>${grad('g', a, b)}</defs>
<rect width="400" height="300" fill="url(#g)"/><circle cx="340" cy="40" r="110" fill="${W}" opacity=".1"/><circle cx="40" cy="280" r="90" fill="${W}" opacity=".08"/><circle cx="200" cy="150" r="96" fill="${W}" opacity=".12"/>
<g fill="none" stroke="${W}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round">${glyph}</g></svg>`,
    { purpose: 'Category artwork and default campaign image', width: 400, height: 300, alt: slug.replace(/-/g, ' ') });
});

// ---- Editable social templates (1080 x 1350). Text is live SVG text: open in any vector editor to change it.
const social = (name, kicker, headline, sub, dark) => out(`social/${name}.svg`, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1350"><defs>${grad('pm')}${grad('bg', dark ? '#1B1F3B' : '#F4F1FF', dark ? N : '#EAF2FF')}</defs>
<rect width="1080" height="1350" fill="url(#bg)"/><circle cx="930" cy="170" r="300" fill="${V}" opacity="${dark ? 0.22 : 0.12}"/><circle cx="120" cy="1230" r="260" fill="${B}" opacity="${dark ? 0.2 : 0.12}"/>
${mark(90, 90, 96)}${wordmark(210, 156, dark ? W : N, 44)}
<text x="90" y="520" font-family="Inter,Arial,sans-serif" font-size="38" font-weight="600" letter-spacing="4" fill="${dark ? '#B9A8FF' : V}">${kicker}</text>
${headline.map((l, i) => `<text x="90" y="${640 + i * 112}" font-family="'Plus Jakarta Sans',Inter,Arial,sans-serif" font-size="96" font-weight="800" fill="${dark ? W : T}">${l}</text>`).join('')}
<text x="90" y="${700 + headline.length * 112}" font-family="Inter,Arial,sans-serif" font-size="40" fill="${dark ? '#C7CBE6' : '#4B5575'}">${sub}</text>
<rect x="90" y="1130" width="420" height="96" rx="48" fill="url(#pm)"/><text x="300" y="1192" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-size="38" font-weight="700" fill="${W}">Start on Promora</text></svg>`,
  { purpose: `Social template: ${name.replace(/-/g, ' ')}`, width: 1080, height: 1350, alt: headline.join(' '), placement: 'Instagram / LinkedIn (not bundled in app pages)' });
social('launch-announcement', 'NOW LIVE', ['Your ideas', 'deserve to', 'be seen.'], 'One Platform. Infinite Possibilities.', true);
social('advertiser-acquisition', 'FOR BUSINESSES', ['Pay only for', 'verified', 'results.'], 'Launch a campaign in minutes.', false);
social('creator-recruitment', 'FOR CREATORS', ['Earn from', 'the audience', 'you have.'], 'Pick a campaign. Share your link.', true);
social('business-promotion', 'PROMOTE ANYTHING', ['Products.', 'Apps. Courses.', 'Events.'], 'Find people ready to share it.', false);
social('referral-programme', 'REFER AND EARN', ['Invite a', 'business or', 'creator.'], 'Earn credits when they get active.', true);
social('feature-announcement', 'NEW ON PROMORA', ['Feature', 'headline', 'goes here.'], 'One line that explains the benefit.', false);

writeFileSync(join(root, 'asset-manifest.json'), JSON.stringify({ generatedBy: 'scripts/generate-assets.mjs', note: 'All assets are original vector artwork. Raster "3D editorial" versions described in docs/PROMORA_IMAGE_GENERATION_PROMPTS.md have NOT been generated.', assets: manifest }, null, 2) + '\n');
console.log(`Wrote ${manifest.length} assets and asset-manifest.json`);
