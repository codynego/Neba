import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve('..');
const sourceDir = path.join(root, 'social-media-campaign-source-higgsfield');
const outputDir = path.join(root, 'social-media-campaign-30-days-final');
const logoPath = path.join(root, 'frontend', 'public', 'brand', 'getneba-wordmark.svg');
const photoPath = path.join(root, 'frontend', 'public', 'images', 'neba-neighbors.png');

const urls = [
  'https://d8j0ntlcm91z4.cloudfront.net/user_3Jwq02tNuIOphFlcmHBycnoO94g/hf_20260929_143502_193d05ff-b465-433f-8cf7-73212e74c0ad.png',
  'https://d8j0ntlcm91z4.cloudfront.net/user_3Jwq02tNuIOphFlcmHBycnoO94g/hf_20260929_143501_58aecaf3-51ae-408b-ae66-4f42e13d8cd4.png',
  'https://d8j0ntlcm91z4.cloudfront.net/user_3Jwq02tNuIOphFlcmHBycnoO94g/hf_20260929_143501_c47d1eae-868a-485b-8edd-b266f59d8a88.png',
  'https://d8j0ntlcm91z4.cloudfront.net/user_3Jwq02tNuIOphFlcmHBycnoO94g/hf_20260929_143501_9c5ebede-8ade-43da-b378-990424208143.png',
  'https://d8j0ntlcm91z4.cloudfront.net/user_3Jwq02tNuIOphFlcmHBycnoO94g/hf_20260929_143501_12a8d7a3-a5e5-4494-86d5-35deb8b3ca12.png',
  'https://d8j0ntlcm91z4.cloudfront.net/user_3Jwq02tNuIOphFlcmHBycnoO94g/hf_20260929_143501_99f4e627-0fc9-4139-a4cb-e9504fa620dd.png',
  'https://d8j0ntlcm91z4.cloudfront.net/user_3Jwq02tNuIOphFlcmHBycnoO94g/hf_20260929_143542_65322f20-ec48-4b6b-8e58-03ed562691c2.png',
  'https://d8j0ntlcm91z4.cloudfront.net/user_3Jwq02tNuIOphFlcmHBycnoO94g/hf_20260929_143504_51d56bfd-e737-4f26-8073-dd6a7cd82180.png',
  'https://d8j0ntlcm91z4.cloudfront.net/user_3Jwq02tNuIOphFlcmHBycnoO94g/hf_20260929_143542_64d59745-72d4-4bd7-bca1-631b75f117a0.png',
  'https://d8j0ntlcm91z4.cloudfront.net/user_3Jwq02tNuIOphFlcmHBycnoO94g/hf_20260929_143542_c6e00ffb-d450-461f-a7de-401eb4e2e546.png',
  'https://d8j0ntlcm91z4.cloudfront.net/user_3Jwq02tNuIOphFlcmHBycnoO94g/hf_20260929_143504_68033241-b4b4-4bb3-a1ed-3d56823e09c3.png',
  'https://d8j0ntlcm91z4.cloudfront.net/user_3Jwq02tNuIOphFlcmHBycnoO94g/hf_20260929_143504_587765b7-cac0-4b24-85ed-3188f2520ccc.png',
  'https://d8j0ntlcm91z4.cloudfront.net/user_3Jwq02tNuIOphFlcmHBycnoO94g/hf_20260929_143542_cd1b9a6f-f034-4a75-89de-f5701f13b5eb.png',
  'https://d8j0ntlcm91z4.cloudfront.net/user_3Jwq02tNuIOphFlcmHBycnoO94g/hf_20260929_143542_3801725e-38a8-4647-9c40-3132e4457f9e.png',
  'https://d8j0ntlcm91z4.cloudfront.net/user_3Jwq02tNuIOphFlcmHBycnoO94g/hf_20260929_143542_4de421bb-39a9-4059-bab5-3d9927e690b7.png',
  'https://d8j0ntlcm91z4.cloudfront.net/user_3Jwq02tNuIOphFlcmHBycnoO94g/hf_20260929_143623_80a2b98e-e335-45e5-b2fa-201fe3c81505.png',
  'https://d8j0ntlcm91z4.cloudfront.net/user_3Jwq02tNuIOphFlcmHBycnoO94g/hf_20260929_143624_892d0bc5-e8b5-49a9-81b7-71c0924410d8.png',
  'https://d8j0ntlcm91z4.cloudfront.net/user_3Jwq02tNuIOphFlcmHBycnoO94g/hf_20260929_143623_76967905-5b60-48c9-a020-e48cfaa40e71.png',
  'https://d8j0ntlcm91z4.cloudfront.net/user_3Jwq02tNuIOphFlcmHBycnoO94g/hf_20260929_143624_92b98881-e514-451e-afe0-ae31d024dfe1.png',
  'https://d8j0ntlcm91z4.cloudfront.net/user_3Jwq02tNuIOphFlcmHBycnoO94g/hf_20260929_143624_cd80f29a-3e9f-4086-9019-71c576ea51ea.png',
  'https://d8j0ntlcm91z4.cloudfront.net/user_3Jwq02tNuIOphFlcmHBycnoO94g/hf_20260929_143624_ea52a964-2035-4ef4-9d2e-db3eb85bc752.png',
  'https://d8j0ntlcm91z4.cloudfront.net/user_3Jwq02tNuIOphFlcmHBycnoO94g/hf_20260929_143704_dfc70fd3-b5ee-4903-823a-8a93927442d0.png',
  'https://d8j0ntlcm91z4.cloudfront.net/user_3Jwq02tNuIOphFlcmHBycnoO94g/hf_20260929_143705_8c25cc03-99df-48af-a0e2-0e2a01c023b2.png',
  'https://d8j0ntlcm91z4.cloudfront.net/user_3Jwq02tNuIOphFlcmHBycnoO94g/hf_20260929_143704_28f5aa1a-98ef-46c9-9d0a-68417268de50.png',
  'https://d8j0ntlcm91z4.cloudfront.net/user_3Jwq02tNuIOphFlcmHBycnoO94g/hf_20260929_143704_f6efca92-b8c5-41e1-8efe-b24c1442aac5.png',
  'https://d8j0ntlcm91z4.cloudfront.net/user_3Jwq02tNuIOphFlcmHBycnoO94g/hf_20260929_143705_8f93b07d-31e2-43a8-9e7b-9a31d3fc8ef3.png',
  'https://d8j0ntlcm91z4.cloudfront.net/user_3Jwq02tNuIOphFlcmHBycnoO94g/hf_20260929_143704_e590f808-76ef-4ab9-b312-cd258d047a2c.png',
  'https://d8j0ntlcm91z4.cloudfront.net/user_3Jwq02tNuIOphFlcmHBycnoO94g/hf_20260929_143733_20c92962-2b56-4ef2-ac10-f9b06c3a0696.png',
  'https://d8j0ntlcm91z4.cloudfront.net/user_3Jwq02tNuIOphFlcmHBycnoO94g/hf_20260929_143733_90a70479-524b-407c-8be5-09d3590068e8.png',
  'https://d8j0ntlcm91z4.cloudfront.net/user_3Jwq02tNuIOphFlcmHBycnoO94g/hf_20260929_143733_b1f4b585-048c-48a2-8a89-8f273f7d905c.png'
];

const posts = [
  [['Meet Neba.'], 'Real help, right in your neighborhood.', 'Find help. Offer a skill.'],
  [['Your to-do list is', 'not a solo project.'], 'Everyday help can start nearby.', 'Ask a neighbor'],
  [['Post. Connect.', 'Get it done.'], 'Share the task. Review responses. Choose who fits.', 'Post a task'],
  [['Moving day needs', 'more hands.'], 'Describe the job, timing and neighborhood.', 'Post moving help'],
  [['Too busy for', 'that errand?'], 'Turn the loose end into a clear local task.', 'Ask nearby'],
  [['Your skill could help', 'someone today.'], 'Create an offer and show people what you do well.', 'Offer your skill'],
  [['Neighbors make', 'the city work.'], 'One useful task at a time.', 'Join the community'],
  [['What can you post', 'on Neba?'], 'Home help · Errands · Events · Skilled work', 'Describe your need'],
  [['Clear tasks build', 'better connections.'], 'Say what, where, when and the reward.', 'Add the details'],
  [['Start with your city.'], 'Then add the neighborhood that matters.', 'Browse nearby'],
  [['A strong profile starts', 'with the real you.'], 'Add an introduction, your skills and availability.', 'Build your profile'],
  [['Better task posts get', 'clearer responses.'], 'Name the job. Add timing. Set a fair reward.', 'Post with confidence'],
  [['Keep task conversations', 'in one place.'], 'Message privately after a booking is accepted.', 'Stay coordinated'],
  [['A small task can make', 'a big difference.'], 'Community looks like people showing up.', 'Ask for help'],
  [['Halfway there.'], 'Still plenty to get done.', 'Open Neba'],
  [['Good work starts', 'with good judgment.'], 'Meet thoughtfully. Keep details clear. Report concerns.', 'See safety tips'],
  [['Only take work when', 'it works for you.'], 'Set your availability and browse on your terms.', 'Set availability'],
  [['Found the right helper?'], 'Send a private task request with the details.', 'Invite a helper'],
  [['Plans change.'], 'Propose a new time and keep everyone in the loop.', 'Reschedule together'],
  [['Respect the work.'], 'Set a clear reward and agree directly.', 'Be clear. Be fair.'],
  [["Here’s to the people", 'who show up.'], 'Built for everyday doers.', 'Browse local work'],
  [['Need help', 'before Saturday?'], 'Post today so people can understand the task.', 'Post the task'],
  [['Free this weekend?'], 'Browse nearby tasks that fit your time and skills.', 'Find local work'],
  [['Turn what you do well', 'into an offer.'], 'Add the service, area, price and availability.', 'Publish your offer'],
  [['Search less.'], 'Filter by city, neighborhood, category and timing.', 'Find useful work'],
  [['Done well? Say so.'], 'Reviews unlock after confirmed completion.', 'Share feedback'],
  [['Local work.', 'Human connection.'], 'That’s the Neba idea.', 'Get started'],
  [['One post can change', 'your weekend.'], 'Move the task off your list and into motion.', 'Ask for help'],
  [['Bring your', 'neighborhood energy.'], 'Post a task. Offer a skill. Join in.', 'Join Neba'],
  [['30 days.', 'One stronger neighborhood.'], 'Keep the momentum going with Neba.', 'getneba.app']
];

const photoDays = new Set([1, 4, 5, 7, 14, 21, 22, 27, 28, 29, 30]);
const xml = (value) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('’', '&#8217;');

async function ensureSources() {
  await fs.mkdir(sourceDir, { recursive: true });
  for (let start = 0; start < urls.length; start += 8) {
    await Promise.all(urls.slice(start, start + 8).map(async (url, offset) => {
      const i = start + offset;
      const filename = path.join(sourceDir, `day-${String(i + 1).padStart(2, '0')}.png`);
      try {
        const stat = await fs.stat(filename);
        if (stat.size > 0) return;
      } catch {}
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Download failed for day ${i + 1}: ${response.status}`);
      await fs.writeFile(filename, Buffer.from(await response.arrayBuffer()));
    }));
  }
}

async function makeVisual(day) {
  const input = photoDays.has(day) ? photoPath : path.join(sourceDir, `day-${String(day).padStart(2, '0')}.png`);
  let image = sharp(input).resize(430, 590, { fit: 'cover', position: photoDays.has(day) ? 'attention' : 'entropy' });
  if (!photoDays.has(day)) image = image.blur(18).modulate({ saturation: 0.72, brightness: 0.78 });
  return (await image.png().toBuffer()).toString('base64');
}

function titleSvg(lines, x, y, color, size = 70, lineHeight = 79) {
  return lines.map((line, index) => `<text x="${x}" y="${y + index * lineHeight}" fill="${color}" font-family="Segoe UI, Arial, sans-serif" font-size="${size}" font-weight="750" letter-spacing="-2">${xml(line)}</text>`).join('');
}

async function renderPost(day) {
  const [lines, supporting, cta] = posts[day - 1];
  const visual = await makeVisual(day);
  const logo = (await fs.readFile(logoPath)).toString('base64');
  const variant = (day - 1) % 3;
  const dark = variant === 1;
  const background = dark ? '#063D2E' : variant === 2 ? '#DDF5EA' : '#F8FAF8';
  const text = dark ? '#FFFFFF' : '#111714';
  const muted = dark ? '#D8E8E1' : '#68736E';
  const card = dark ? '#0B513D' : '#FFFFFF';
  const titleY = lines.length === 1 ? 360 : 314;
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080">
    <defs>
      <clipPath id="visualClip"><rect x="676" y="118" width="340" height="630" rx="34"/></clipPath>
      <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="18" stdDeviation="24" flood-color="#063D2E" flood-opacity=".14"/></filter>
    </defs>
    <rect width="1080" height="1080" fill="${background}"/>
    <circle cx="1018" cy="65" r="210" fill="${dark ? '#087F5B' : '#F2C14E'}" opacity="${dark ? '.34' : '.18'}"/>
    <circle cx="40" cy="1040" r="180" fill="#087F5B" opacity=".10"/>
    <rect x="54" y="48" width="312" height="96" rx="24" fill="${dark ? '#FFFFFF' : '#FFFFFF'}" ${dark ? '' : 'stroke="#E5EAE7"'} />
    <image href="data:image/svg+xml;base64,${logo}" x="82" y="70" width="255" height="55" preserveAspectRatio="xMidYMid meet"/>
    <text x="1016" y="97" text-anchor="end" fill="${dark ? '#9ED8C4' : '#087F5B'}" font-family="Segoe UI, Arial, sans-serif" font-size="22" font-weight="700" letter-spacing="2">DAY ${String(day).padStart(2, '0')} / 30</text>
    <rect x="54" y="180" width="972" height="706" rx="42" fill="${card}" filter="url(#shadow)"/>
    <rect x="676" y="218" width="310" height="548" rx="34" fill="#07563F"/>
    <image href="data:image/png;base64,${visual}" x="676" y="218" width="310" height="548" preserveAspectRatio="xMidYMid slice" clip-path="url(#visualClip)"/>
    <rect x="676" y="218" width="310" height="548" rx="34" fill="#063D2E" opacity="${photoDays.has(day) ? '.08' : '.18'}"/>
    <rect x="106" y="246" width="88" height="8" rx="4" fill="#F2C14E"/>
    ${titleSvg(lines, 106, titleY, text)}
    <text x="106" y="${titleY + lines.length * 79 + 50}" fill="${muted}" font-family="Segoe UI, Arial, sans-serif" font-size="27" font-weight="450">
      ${supporting.length > 48 ? `<tspan x="106" dy="0">${xml(supporting.slice(0, supporting.lastIndexOf(' ', 48)))}</tspan><tspan x="106" dy="38">${xml(supporting.slice(supporting.lastIndexOf(' ', 48) + 1))}</tspan>` : xml(supporting)}
    </text>
    <rect x="106" y="742" width="${Math.min(430, 150 + cta.length * 13)}" height="70" rx="35" fill="#087F5B"/>
    <text x="136" y="786" fill="#FFFFFF" font-family="Segoe UI, Arial, sans-serif" font-size="25" font-weight="700">${xml(cta)}  →</text>
    <text x="54" y="956" fill="${dark ? '#9ED8C4' : '#68736E'}" font-family="Segoe UI, Arial, sans-serif" font-size="20" font-weight="600" letter-spacing="1.4">YOUR CITY. YOUR NEIGHBORHOOD.</text>
    <text x="1026" y="956" text-anchor="end" fill="${dark ? '#FFFFFF' : '#07563F'}" font-family="Segoe UI, Arial, sans-serif" font-size="23" font-weight="700">getneba.app</text>
    <line x1="54" y1="990" x2="1026" y2="990" stroke="${dark ? '#FFFFFF' : '#07563F'}" opacity=".20"/>
  </svg>`;
  await sharp(Buffer.from(svg)).png().toFile(path.join(outputDir, `day-${String(day).padStart(2, '0')}.png`));
}

await ensureSources();
await fs.mkdir(outputDir, { recursive: true });
for (let day = 1; day <= 30; day += 1) await renderPost(day);

const files = (await fs.readdir(outputDir)).filter((name) => /^day-\d{2}\.png$/.test(name)).sort();
if (files.length !== 30) throw new Error(`Expected 30 final designs, found ${files.length}`);
for (const file of files) {
  const meta = await sharp(path.join(outputDir, file)).metadata();
  if (meta.width !== 1080 || meta.height !== 1080) throw new Error(`${file} has invalid dimensions`);
}
console.log(JSON.stringify({ outputDir, count: files.length, dimensions: '1080x1080', first: files[0], last: files.at(-1) }, null, 2));
