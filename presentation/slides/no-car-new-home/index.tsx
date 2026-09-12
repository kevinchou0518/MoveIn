import type { CSSProperties, ReactNode } from 'react';
import cursorLogo from './assets/cursor.svg';
import grokLogo from './assets/grok.svg';
import atlasLogo from './assets/mongodb-atlas.svg';
import { useIsActivePage, useSlidePageNumber } from '@open-slide/core';
const demoLink = 'https://drive.google.com/file/d/1HU0wOV75faEtrV6h2MZS_6Tz4ZzQmnRP/view';
const demoVideo = demoLink.replace('/view', '/preview');
import type { DesignSystem, Page, SlideMeta, SlideTransition } from '@open-slide/core';

export const design: DesignSystem = {
  palette: { bg: '#F6F3EB', text: '#193C32', accent: '#28634C' },
  fonts: { display: 'Georgia, serif', body: 'Arial, Helvetica, sans-serif' },
  typeScale: { hero: 150, body: 38 },
  radius: 24,
};
const muted = '#6B786E';
const line = '#D5DACD';
const soft = '#E7EBDD';
const accent = 'var(--osd-accent)';
const text = 'var(--osd-text)';
const bg = 'var(--osd-bg)';

export const transition: SlideTransition = {
  duration: 220,
  exit: { duration: 150, easing: 'ease-in', keyframes: [{ opacity: 1 }, { opacity: 0 }] },
  enter: { duration: 220, delay: 50, easing: 'ease-out', keyframes: [{ opacity: 0 }, { opacity: 1 }] },
};

function Frame({ children, label, dark = false, chapter = 'OPTIMIZATION' }: { children: ReactNode; label: string; dark?: boolean; chapter?: string }) {
  const { current, total } = useSlidePageNumber();
  return <section style={{ width: '100%', height: '100%', boxSizing: 'border-box', position: 'relative', background: dark ? text : bg, color: dark ? bg : text, fontFamily: 'var(--osd-font-body)', padding: 120 }}>
    <div style={{ position: 'absolute', top: 68, left: 120, right: 120, display: 'flex', justifyContent: 'space-between', fontSize: 23, letterSpacing: 2 }}>
      <span>MoveIn <span style={{ opacity: .45 }}> / </span> HACKCMU 2026</span>
      <span style={{ opacity: .65 }}>{chapter}</span>
    </div>
    {children}
    <div style={{ position: 'absolute', bottom: 58, left: 120, right: 120, display: 'flex', justifyContent: 'space-between', borderTop: `1px solid ${dark ? '#587266' : line}`, paddingTop: 20, fontSize: 23, color: dark ? '#B9CABA' : muted }}>
      <span>{label}</span><span>{String(current).padStart(2, '0')} / {String(total).padStart(2, '0')}</span>
    </div>
  </section>;
}
function Heading({ children }: { children: ReactNode }) {
  return <h2 style={{ fontFamily: 'var(--osd-font-display)', fontSize: 88, fontWeight: 400, lineHeight: 1.12, margin: '38px 0 0', letterSpacing: -3 }}>{children}</h2>;
}
function Label({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div style={{ fontSize: 24, letterSpacing: 2, textTransform: 'uppercase', color: muted, ...style }}>{children}</div>;
}
function Furniture({ kind, size = 110 }: { kind: 'desk' | 'chair' | 'tv' | 'stand'; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 120 120" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" aria-label={kind}>
    {kind === 'desk' && <><path d="M12 44h96v12H12zM22 56v49M98 56v49M72 58v21h25M78 67h12"/><path d="M35 43V25h29v18"/></>}
    {kind === 'chair' && <><rect x="32" y="13" width="56" height="47" rx="10"/><path d="M32 71h56v13H32zM60 61v10M60 85v19M38 107l22-7 22 7M20 58v20h12M100 58v20H88"/></>}
    {kind === 'tv' && <><rect x="10" y="21" width="100" height="65" rx="6"/><path d="M42 102l7-16M78 102l-7-16M20 76h80"/></>}
    {kind === 'stand' && <><rect x="10" y="40" width="100" height="45" rx="3"/><path d="M20 85v18M100 85v18M60 40v45M22 55h25M73 55h25"/></>}
  </svg>;
}
function Room({ furnished = false }: { furnished?: boolean }) {
  return <svg width="680" height="570" viewBox="0 0 680 570" fill="none" role="img" aria-label={furnished ? 'Illustration of a furnished student room' : 'Illustration of an empty student room'}>
    <path d="M50 175L345 65 630 175V390L335 515 50 390Z" fill={soft}/>
    <path d="M50 175L345 65 630 175 335 295Z" fill="#EEF0E6"/>
    <path d="M50 175V390L335 515V295ZM335 295L630 175V390L335 515" fill={furnished ? '#DCE6D4' : '#E7E7DA'} stroke="#A6B9A5" strokeWidth="3"/>
    <path d="M50 390L345 268 630 390M345 65V268" stroke="#A6B9A5" strokeWidth="3"/>
    <path d="M430 177l113-46v104l-113 47z" fill="#F6F3EB" stroke="#A6B9A5" strokeWidth="3"/>
    <path d="M485 155v105M430 228l113-46" stroke="#A6B9A5" strokeWidth="3"/>
    {furnished ? <g stroke="#28634C" strokeWidth="5" strokeLinejoin="round">
      <path d="M128 335l130-50 100 41-130 53z" fill="#B6CAB0"/><path d="M128 335v70M228 379v67M358 326v69"/>
      <path d="M169 318v-65l79-29v65z" fill="#28634C"/>
      <path d="M399 340l105-43 66 27-105 46zM399 340v44l66 27 105-46v-41M465 370v41" fill="#B6CAB0"/>
      <path d="M300 402v-48l55 23v48zM300 402l-30 14 54 25 31-16M270 416v35M324 441v30" fill="#B6CAB0"/>
    </g> : <path d="M191 386l125-50 147 56-125 55z" stroke="#A6B9A5" strokeDasharray="10 10" strokeWidth="3"/>}
  </svg>;
}

const Arrival: Page = () => <Frame label="Built by Snack Overflow">
  <div style={{ position: 'absolute', left: 120, top: 185, width: 1010 }}>
    <Label>New city. Empty room. No car.</Label>
    <h1 style={{ fontFamily: 'var(--osd-font-display)', fontSize: 'var(--osd-size-hero)', lineHeight: 1.03, fontWeight: 400, letterSpacing: -6, margin: '30px 0 24px' }}>MoveIn</h1>
    <p style={{ fontFamily: 'var(--osd-font-display)', fontSize: 76, lineHeight: 1.12, letterSpacing: -2, margin: 0 }}>Secondhand furniture,<br/>simplified.</p>
  </div>
  <div style={{ position: 'absolute', right: 120, top: 205 }}><Room/></div>

</Frame>;

function JourneyCard({ number, title, detail, children }: { number: string; title: string; detail: string; children: ReactNode }) {
  return <div style={{ width: 500, height: 400, boxSizing: 'border-box', padding: 36, background: soft, borderRadius: 'var(--osd-radius)' }}>
    <Label>{number}</Label>
    <div style={{ height: 124, display: 'flex', alignItems: 'center', gap: 20, color: accent }}>{children}</div>
    <h3 style={{ fontSize: 42, fontWeight: 500, letterSpacing: -1, margin: '18px 0 16px' }}>{title}</h3>
    <p style={{ fontSize: 32, lineHeight: 1.5, color: muted, margin: 0 }}>{detail}</p>
  </div>;
}

const Overview: Page = () => <Frame chapter="HOW MOVEIN WORKS" label="Furniture that fits your needs. A plan to bring it home.">
  <Heading>Your room. One complete plan.</Heading>
  <div style={{ position: 'absolute', top: 335, left: 120, right: 120, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
    <JourneyCard number="01 / DESCRIBE" title="Tell us what you need" detail="AI turns your words into preferences.">
      <svg width="108" height="108" viewBox="0 0 108 108" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 16h80v58H44L24 92V74H14zM30 34h48M30 48h36M30 62h23"/></svg>
    </JourneyCard>
    <span aria-hidden="true" style={{ fontSize: 48, color: accent }}>→</span>
    <JourneyCard number="02 / CHOOSE" title="Choose a bundle" detail="Furniture within your budget.">
      <Furniture kind="desk" size={106}/><Furniture kind="chair" size={106}/>
    </JourneyCard>
    <span aria-hidden="true" style={{ fontSize: 48, color: accent }}>→</span>
    <JourneyCard number="03 / DELIVER" title="Delivered to your door" detail="A matched driver and an optimized route.">
      <ValueIcon kind="route"/>
    </JourneyCard>
  </div>
</Frame>;

function ValueIcon({ kind }: { kind: 'time' | 'money' | 'route' }) {
  return <svg width="76" height="76" viewBox="0 0 80 80" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {kind === 'time' && <><circle cx="40" cy="40" r="28"/><path d="M40 22v20l14 9"/></>}
    {kind === 'money' && <><rect x="10" y="20" width="60" height="40" rx="8"/><circle cx="40" cy="40" r="11"/><path d="M19 40h2M59 40h2"/></>}
    {kind === 'route' && <><circle cx="17" cy="57" r="7"/><circle cx="63" cy="23" r="7"/><path d="M24 57h28a11 11 0 000-22H28a12 12 0 010-24h18M43 6l5 5-5 5"/></>}
  </svg>;
}
function ValueCard({ kind, title, children }: { kind: 'time' | 'money' | 'route'; title: string; children: ReactNode }) {
  return <div style={{ background: soft, borderRadius: 'var(--osd-radius)', padding: '40px 34px', boxSizing: 'border-box', height: 452 }}>
    <div style={{ color: accent }}><ValueIcon kind={kind}/></div>
    <h3 style={{ fontSize: 43, fontWeight: 500, letterSpacing: -1, margin: '28px 0 30px' }}>{title}</h3>
    <ul style={{ fontSize: 32, lineHeight: 1.5, color: muted, margin: 0, paddingLeft: 28, listStyleType: 'disc', listStylePosition: 'outside', display: 'grid', gap: 10 }}>{children}</ul>
  </div>;
}
const Problem: Page = () => <Frame label="Less effort. More value. A feasible pickup plan.">
  <Heading>What we optimize</Heading>
  <div style={{ position: 'absolute', left: 120, right: 120, top: 345, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 28 }}>
    <ValueCard kind="time" title="Time"><li>Less searching for buyers</li><li>Easier listing for sellers</li><li>Coordinated pickups</li></ValueCard>
    <ValueCard kind="money" title="Money"><li>Buy within budget</li><li>Sell unused furniture</li></ValueCard>
    <ValueCard kind="route" title="Bundles & routes"><li>Match furniture needs</li><li>Find a driver with space</li><li>Plan the pickup order</li></ValueCard>
  </div>
</Frame>;

function FlowNode({ tag, title, technology, icon, children }: { tag: string; title: string; technology: ReactNode; icon: 'request' | 'bundle' | 'route'; children: ReactNode }) {
  return <div style={{ position: 'relative', width: 500, height: 490, padding: 30, boxSizing: 'border-box', background: soft, borderRadius: 'var(--osd-radius)' }}>
    <Label>{tag}</Label>
    <svg width="84" height="64" viewBox="0 0 130 100" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', top: 24, right: 24, color: accent }} aria-hidden="true">
      {icon === 'request' && <><rect x="22" y="5" width="82" height="88" rx="8"/><path d="M38 29l5 5 9-11M64 28h23M38 53l5 5 9-11M64 52h23M38 77l5 5 9-11M64 76h23"/></>}
      {icon === 'bundle' && <><rect x="8" y="10" width="45" height="32" rx="5"/><rect x="65" y="10" width="45" height="32" rx="5"/><rect x="8" y="54" width="45" height="32" rx="5"/><rect x="65" y="54" width="45" height="32" rx="5"/><path d="M19 26h23M87 19v14M77 26h21M20 66h21v10H20zM76 68l7 7 16-14"/></>}
      {icon === 'route' && <><circle cx="15" cy="74" r="9"/><circle cx="58" cy="26" r="9"/><path d="M24 74h23a14 14 0 000-28H30a10 10 0 010-20h19M67 26h30v34M80 76l17-15 18 15v18H80zM93 94V80h9v14"/></>}
    </svg>
    <h3 style={{ fontSize: 43, lineHeight: 1.15, minHeight: 99, fontWeight: 600, letterSpacing: -1, margin: '36px 0 12px', color: accent }}>{technology}</h3>
    <div style={{ fontSize: 31, fontWeight: 600, marginBottom: 12 }}>{title}</div>
    <ul style={{ fontSize: 28, lineHeight: 1.5, color: muted, margin: '20px 0 0', paddingLeft: 26, listStyleType: 'disc', listStylePosition: 'outside', display: 'grid', gap: 12 }}>{children}</ul>
  </div>;
}
const Engine: Page = () => <Frame label="Two-stage optimization / OR-Tools CP-SAT + Routing">
  <Heading>The technology behind MoveIn.</Heading>
  <div style={{ position: 'absolute', top: 300, left: 120, right: 120 }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <FlowNode tag="01 / UNDERSTAND" technology={<>Grok<br/>by xAI</>} title="Structure user input" icon="request"><li>Text → request fields</li><li>Photo → listing suggestions</li><li>Review before applying</li></FlowNode>
      <span aria-hidden="true" style={{ fontSize: 48, color: accent }}>→</span>
      <FlowNode tag="02 / SELECT" technology={<>Google OR-Tools<br/>CP-SAT</>} title="Select furniture bundles" icon="bundle"><li>Use available inventory</li><li>Match categories + budget</li><li>Check driver + capacity</li></FlowNode>
      <span aria-hidden="true" style={{ fontSize: 48, color: accent }}>→</span>
      <FlowNode tag="03 / ROUTE" technology={<>OR-Tools Routing<br/>+ Mapbox</>} title="Plan the pickup order" icon="route"><li>Mapbox → travel times</li><li>Routing solver → stop order</li><li>Directions API → map route</li></FlowNode>
    </div>

  </div>
</Frame>;

// Export and thumbnail mounts are inactive; PDF keeps the ordinary anchor link.
const Demo: Page = () => {
  const active = useIsActivePage();
  if (active) return <div style={{ width: '100%', height: '100%', background: '#FAF9F5' }}>
    <iframe src={demoVideo} title="MoveIn product demo — Google Drive" allow="autoplay; fullscreen" allowFullScreen style={{ width: '100%', height: '100%', border: 0, display: 'block' }}/>
  </div>;
  return <Frame label="Product demo / Watch online">
    <div style={{ position: 'absolute', left: 120, top: 240, width: 970 }}>
      <Label>See MoveIn in action · 1 min 11 sec</Label>
      <h2 style={{ fontFamily: 'var(--osd-font-display)', fontSize: 112, lineHeight: 1.08, fontWeight: 400, letterSpacing: -4, margin: '36px 0' }}>Your next room.<br/>One simpler move.</h2>
      <p style={{ fontSize: 34, lineHeight: 1.5, color: muted, margin: '0 0 44px' }}>Watch the product walkthrough.</p>
      <a href={demoLink} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 24, padding: '24px 38px', borderRadius: 16, background: accent, color: '#F6F3EB', fontSize: 36, textDecoration: 'none' }}><span aria-hidden="true">▶</span> Watch demo</a>
      <p style={{ fontSize: 26, color: muted, marginTop: 24 }}>Opens in Google Drive · Internet required</p>
    </div>
    <div style={{ position: 'absolute', right: 120, top: 230 }}><Room furnished/></div>
  </Frame>;
};

const Closing: Page = () => <Frame dark label="Built by Snack Overflow">
  <div style={{ position: 'absolute', left: 120, top: 190, width: 1100 }}>
    <Label style={{ color: '#B9CABA' }}>MoveIn · For students without cars</Label>
    <h2 style={{ fontFamily: 'var(--osd-font-display)', fontSize: 112, fontWeight: 400, letterSpacing: -5, lineHeight: 1.08, margin: '42px 0' }}>From an empty room<br/>to a plan to<br/><span style={{ color: '#BDCEA6' }}>bring it home.</span></h2>
    <p style={{ fontSize: 35, lineHeight: 1.5, color: '#CFD9CD', marginTop: 44 }}>Furniture selection. Transport capacity. Pickup planning.</p>
  </div>
  <div style={{ position: 'absolute', right: 115, top: 334, transform: 'scale(.88)', transformOrigin: 'right center' }}><Room furnished/></div>
</Frame>;

function Supporter({ logo, name }: { logo: string; name: string }) {
  return <div style={{ width: 480, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 40 }}>
    <img src={logo} alt={`${name} logo`} style={{ width: 154, height: 154, objectFit: 'contain' }}/>
    <div style={{ fontSize: 46, fontWeight: 500, letterSpacing: -1 }}>{name}</div>
  </div>;
}

const Thanks: Page = () => <Frame chapter="THANK YOU" label="Built by Snack Overflow">
  <h2 style={{ position: 'absolute', top: 240, left: 120, right: 120, margin: 0, textAlign: 'center', fontFamily: 'var(--osd-font-display)', fontSize: 112, lineHeight: 1.12, fontWeight: 400, letterSpacing: -4 }}>Thanks for your support.</h2>
  <div style={{ position: 'absolute', top: 510, left: 200, right: 200, display: 'flex', justifyContent: 'space-between' }}>
    <Supporter logo={cursorLogo} name="Cursor"/>
    <Supporter logo={grokLogo} name="Grok"/>
    <Supporter logo={atlasLogo} name="MongoDB Atlas"/>
  </div>
</Frame>;

export const notes: string[] = [
  `Introduction
Imagine arriving in Pittsburgh for a new semester. You unlock your apartment, walk inside, and realize: there's nowhere to sit, nowhere to study, and no furniture to make it feel like home.
Buying everything new is expensive. Buying secondhand means searching separate listings and figuring out how to transport everything. Meanwhile, students moving out have furniture they need to sell. Both sides need a simpler way to connect.
That's why we built MoveIn, an app that matches secondhand furniture buyers and sellers through complete furniture bundles.`,
  `Here is the core experience. Describe the furniture you need and your budget; AI turns that into editable preferences. MoveIn combines listings from local sellers into complete bundles, so you can compare furniture and transportation together. For delivery, MoveIn matches an eligible seller driver whose vehicle fits the whole bundle and optimizes the pickup route ending at your home. Choose and reserve your bundle with the driver and delivery route already planned.
The key is a complete furniture bundle with a feasible way to bring it home. That is what we optimize next.`,
  `A buyer chooses what they need, their furniture budget, their location, and whether they want delivery or pickup. For example: a desk, chair, TV, and TV stand for under three hundred dollars.
MoveIn returns up to three bundles to compare, with item details, pickup routes, and any delivery fee shown separately. Buyers can swap individual items and reserve their chosen bundle. Sellers can publish furniture and, if eligible, earn a delivery fee by transporting the bundle.`,
  `AI Integration
We integrated xAI's Grok in 3 ways.
For sellers, photo analysis suggests a title, description, category, visible condition, and a rough price estimate. Sellers review and edit those suggestions before publishing.
For buyers, natural-language input turns a request like, "I need a desk and chair under two hundred dollars, delivered to Oakland," into editable search preferences.
Grok image model to generate a picture of the what the bundle might look like in a room. `,
  `First, we filter listings by category, availability, price, and distance. Then we use Google OR-Tools' CP-SAT constraint solver to select exactly one item per requested category while keeping furniture costs within budget. For delivery, the bundle must include an eligible seller whose vehicle can fit the entire bundle.
Our CP-SAT model uses binary selection variables and integer-cent budget constraints to maximize a weighted score for condition, price, distance, and seller count.

Second, OR-Tools' routing solver plans the pickup order to reduce travel time. It starts at the seller driver's location and ends at the buyer, or makes a round trip for self-pickup. We then rank feasible bundles by the buyer's preference: balanced, lowest total cost, best condition, or fastest trip.
Our routing model uses a travel-time matrix, PATH_CHEAPEST_ARC to build an initial route, and GREEDY_DESCENT to improve it within a one-second search limit.
`,
  `MoveIn brings furniture discovery, bundle selection, and transportation planning into one experience.
Our goal is to help buyers furnish an empty apartment affordably, help sellers find buyers, and keep useful furniture in circulation.
With MoveIn, an empty apartment is the beginning of a home. Thank you.`,
  `And a special thanks to Cursor, Grok, and MongoDB Atlas for supporting our build.`,
];
export const meta: SlideMeta = { title: 'MoveIn — Built by Snack Overflow', createdAt: '2026-09-12T14:46:28.883Z' };
export default [Arrival, Overview, Problem, Demo, Engine, Closing, Thanks] satisfies Page[];
