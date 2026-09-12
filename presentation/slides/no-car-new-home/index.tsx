import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Step, Steps, useIsActivePage, useSlidePageNumber } from '@open-slide/core';
import demoPoster from './assets/movein-demo-poster.png';
const demoVideo = new URL('./assets/movein-demo.mp4', import.meta.url).href;
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

function Frame({ children, label, dark = false }: { children: ReactNode; label: string; dark?: boolean }) {
  const { current, total } = useSlidePageNumber();
  return <section style={{ width: '100%', height: '100%', boxSizing: 'border-box', position: 'relative', background: dark ? text : bg, color: dark ? bg : text, fontFamily: 'var(--osd-font-body)', padding: 120 }}>
    <div style={{ position: 'absolute', top: 68, left: 120, right: 120, display: 'flex', justifyContent: 'space-between', fontSize: 23, letterSpacing: 2 }}>
      <span>MoveIn <span style={{ opacity: .45 }}> / </span> HACKCMU 2026</span>
      <span style={{ opacity: .65 }}>OPTIMIZATION</span>
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
  <div style={{ position: 'absolute', left: 120, right: 120, top: 800, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: `1px solid ${line}`, paddingTop: 36, fontSize: 38, color: accent }}>
    <span>Save time</span><span aria-hidden="true" style={{ color: muted }}>·</span><span>Save money</span><span aria-hidden="true" style={{ color: muted }}>·</span><span>Optimize bundles &amp; routes</span>
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
    <div style={{ fontSize: 32, lineHeight: 1.5, color: muted }}>{children}</div>
  </div>;
}
const Problem: Page = () => <Frame label="Less effort. More value. A feasible pickup plan.">
  <Heading>What we optimize</Heading>
  <div style={{ position: 'absolute', left: 120, right: 120, top: 345, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 28 }}>
    <ValueCard kind="time" title="Time"><div>Buyers: less searching.</div><div>Sellers: easier listing.</div><div>Coordinated pickups.</div></ValueCard>
    <ValueCard kind="money" title="Money"><div>Buy within budget.</div><div>Turn unused furniture<br/>into cash.</div></ValueCard>
    <ValueCard kind="route" title="Bundles & routes"><div>Categories, budget, capacity.</div><div>An eligible seller driver.</div><div>Planned pickup order.</div></ValueCard>
  </div>
  <div style={{ position: 'absolute', left: 120, top: 850, fontSize: 34, color: accent }}>Let’s see it in action. <span aria-hidden="true">→</span></div>
</Frame>;

function Stage({ tag, title, children }: { tag: string; title: string; children: ReactNode }) {
  return <div style={{ width: 752, height: 345, boxSizing: 'border-box', borderTop: `3px solid ${accent}`, padding: '30px 0' }}>
    <Label>{tag}</Label><h3 style={{ fontSize: 53, margin: '22px 0 24px', fontWeight: 500, letterSpacing: -1 }}>{title}</h3>
    <div style={{ fontSize: 33, lineHeight: 1.65, color: muted }}>{children}</div>
  </div>;
}
const Engine: Page = () => <Frame label="Two-stage optimization / OR-Tools CP-SAT + Routing">
  <Heading>Choose the furniture.<br/>Plan the pickup.</Heading>
  <div style={{ position: 'absolute', top: 425, left: 120, right: 120 }}>
    <Steps>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <Stage tag="01 / CP-SAT" title="Select feasible bundles">Requested categories · Available items<br/>Furniture budget · Driver + capacity</Stage>
        <div style={{ fontSize: 55, color: muted, paddingTop: 120 }}>→</div>
        <Stage tag="02 / ROUTING" title="Optimize each pickup plan">Compare eligible drivers<br/>Order seller stops → Student’s home</Stage>
      </div>
      <Step><div style={{ background: soft, borderRadius: 'var(--osd-radius)', padding: '28px 38px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}><span style={{ fontSize: 34 }}>Up to 10 candidate bundles</span><span style={{ fontSize: 36 }}>→</span><span style={{ fontSize: 34 }}>Re-rank by preference</span><span style={{ fontSize: 36 }}>→</span><strong style={{ fontSize: 36 }}>Up to 3 options</strong></div></Step>
    </Steps>
  </div>
</Frame>;

// A continuous recording of the real app, with an edited camera and cursor.
const Demo: Page = () => {
  const active = useIsActivePage();
  const video = useRef<HTMLVideoElement>(null);
  const [needsPlay, setNeedsPlay] = useState(false);
  useEffect(() => {
    const element = video.current;
    if (!element) return;
    if (active) {
      element.currentTime = 0;
      element.play().catch(() => setNeedsPlay(true));
    } else element.pause();
    return () => element.pause();
  }, [active]);
  return <div style={{ width: '100%', height: '100%', position: 'relative', background: '#FAF9F5' }}>
    {active ? <video ref={video} src={demoVideo} poster={demoPoster} muted playsInline controls preload="auto" onPlay={() => setNeedsPlay(false)} aria-label="MoveIn demo: buyer auto-fill, bundle reservation, seller delivery and AI photo listing" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}/>
      : <img src={demoPoster} alt="MoveIn product demo" style={{ width: '100%', height: '100%', objectFit: 'contain' }}/>}
    {active && needsPlay && <button onClick={() => video.current?.play()} style={{ position: 'absolute', left: 810, top: 485, width: 300, height: 100, background: '#193C32', color: '#F6F3EB', border: 0, borderRadius: 50, fontSize: 32, cursor: 'pointer' }}>Play demo ▶</button>}
  </div>;
};

const Closing: Page = () => <Frame dark label="Built by Snack Overflow">
  <div style={{ position: 'absolute', left: 120, top: 190, width: 1100 }}>
    <Label style={{ color: '#B9CABA' }}>MoveIn · For students without cars</Label>
    <h2 style={{ fontFamily: 'var(--osd-font-display)', fontSize: 112, fontWeight: 400, letterSpacing: -5, lineHeight: 1.08, margin: '42px 0' }}>From an empty room<br/>to a plan to<br/><span style={{ color: '#BDCEA6' }}>bring it home.</span></h2>
    <p style={{ fontSize: 35, lineHeight: 1.5, color: '#CFD9CD', marginTop: 44 }}>Furniture selection. Transport capacity. Pickup planning.</p>
  </div>
  <div style={{ position: 'absolute', right: 115, top: 334, transform: 'scale(.88)', transformOrigin: 'right center' }}><Room furnished/></div>
</Frame>;

export const notes: string[] = [
  `TARGET 20 SECONDS\nNew city. Empty room. No car. For a student arriving in Pittsburgh, finding secondhand furniture is only the beginning. MoveIn simplifies the next steps: saving time, making the budget go further, and choosing furniture bundles with a pickup plan. Built by Snack Overflow.\n\nThe room is a conceptual illustration. Value statements are not measured savings.`,
  `TARGET 25 SECONDS\nWe focus on three things. Time: less searching and matching for buyers, easier listing and clear pickup plans for sellers. Money: secondhand furniture within the buyer’s budget, and cash for sellers’ unused items. Finally, bundles and routes: matching categories, budget, driver eligibility, and capacity, then planning the pickup order. Let’s see it in action.\n\nFurniture budget excludes delivery fees. Do not claim measured savings, the lowest total price, or a globally optimal route. Algorithm details follow the demo.`,
  `CONTINUOUS VIDEO DEMO — ABOUT 61 SECONDS\nThe video starts automatically and plays both scenarios. Native controls support pause, replay and scrubbing. Wait for it to finish, then press Right to advance to the technology page.\nScenario 1: type a natural-language request; Auto-fill directly updates the buyer form. Build a bundle, review the route, choose it and confirm the reservation. Switch to Jordan and show that same order in Deliveries.\nScenario 2: upload a furniture photo, run Grok analysis, review and select suggested fields, then apply them to the listing form.\nRecorded from the real app on September 12, 2026, with independent local demo inventory and live AI/Mapbox responses. Cursor and camera motion are edited; idle waits are shortened. Buyer total in this run: $210 furniture + $12.75 delivery = $222.75. A demo reservation was created only in the isolated database. No payment or listing publication occurred. Photo price is an AI estimate, not researched pricing.`,
  `TARGET 35 SECONDS\nWe turn those decisions into a constrained optimization problem. First, OR-Tools CP-SAT selects furniture bundles that cover every requested category, stay within the furniture budget, and have an eligible seller driver with enough capacity. Then we optimize pickup routes for candidate bundles and rank the results using travel time, delivery cost, and the buyer’s preference.\n\nPress Right once to reveal candidate-to-result pipeline, then again to advance.\n\nQ&A: Selected seller must drive; capacity uses abstract size units. Candidate generation and routing are separate, bounded stages, not a guarantee of global optimality. AI supports input and listing suggestions; it does not choose the final bundles.`,
  `TARGET 25 SECONDS\nFor students without cars, getting furniture home is part of finding furniture. MoveIn brings item selection, transport capacity, and pickup planning into one flow—so an empty room becomes a practical plan. We’re Snack Overflow.\n\nThe room is a conceptual illustration, not a claim of completed delivery. No measured savings are claimed in this draft. Later, add a validated example or comparison only after the demo dataset is fixed.\n\nTotal planned duration: about 2:46, with about 14 seconds of buffer inside the competition’s 3-minute presentation-plus-demo limit.`,
];
export const meta: SlideMeta = { title: 'MoveIn — Built by Snack Overflow', createdAt: '2026-09-12T14:46:28.883Z' };
export default [Arrival, Problem, Demo, Engine, Closing] satisfies Page[];
