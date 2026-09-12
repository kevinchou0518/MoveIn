import type { CSSProperties, ReactNode } from 'react';
import { Step, Steps, useSlidePageNumber } from '@open-slide/core';
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
      <span>SNACK OVERFLOW <span style={{ opacity: .45 }}> / </span> HACKCMU 2026</span>
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

const Arrival: Page = () => <Frame label="Furniture bundles for students without cars">
  <div style={{ position: 'absolute', left: 120, top: 195, width: 990 }}>
    <Label>A new student in Pittsburgh</Label>
    <h1 style={{ fontFamily: 'var(--osd-font-display)', fontSize: 'var(--osd-size-hero)', lineHeight: 1.03, fontWeight: 400, letterSpacing: -6, margin: '36px 0' }}>New city.<br/>Empty room.<br/><span style={{ color: accent }}>No car.</span></h1>
    <p style={{ fontSize: 36, lineHeight: 1.5, margin: 0, color: muted }}>Four furniture essentials. A $300 furniture budget.</p>
  </div>
  <div style={{ position: 'absolute', right: 120, top: 263 }}><Room/></div>
  <div style={{ position: 'absolute', right: 160, top: 831, fontSize: 24, color: muted }}>A place to start. A way to bring it home.</div>
</Frame>;

function Constraint({ number, title, detail }: { number: string; title: string; detail: string }) {
  return <div style={{ display: 'flex', gap: 25, padding: '26px 0', borderBottom: `1px solid ${line}` }}>
    <span style={{ fontSize: 25, color: muted, paddingTop: 8 }}>{number}</span>
    <div><div style={{ fontSize: 39 }}>{title}</div><div style={{ fontSize: 29, color: muted, marginTop: 12 }}>{detail}</div></div>
  </div>;
}
function Item({ kind, label, x, y }: { kind: 'desk' | 'chair' | 'tv' | 'stand'; label: string; x: number; y: number }) {
  return <div style={{ position: 'absolute', left: x, top: y, width: 218, height: 189, background: '#FFFDF8', border: `1px solid ${line}`, borderRadius: 'var(--osd-radius)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}><Furniture kind={kind} size={100}/><span style={{ fontSize: 27 }}>{label}</span></div>;
}
const Problem: Page = () => <Frame label="The challenge / affordability + transportation">
  <Heading>Finding furniture is<br/>only half the problem.</Heading>
  <div style={{ position: 'absolute', left: 120, top: 427, width: 845, height: 438 }}>
    <svg width="845" height="438" viewBox="0 0 845 438" fill="none" style={{ position: 'absolute' }} aria-hidden="true"><path d="M160 92L430 318 695 110M150 330L695 110M160 92L665 343" stroke="#B6C6B3" strokeWidth="3" strokeDasharray="10 10"/></svg>
    <Item kind="desk" label="Desk" x={0} y={0}/><Item kind="chair" label="Chair" x={289} y={238}/><Item kind="tv" label="TV" x={565} y={18}/><Item kind="stand" label="TV stand" x={0} y={238}/>
  </div>
  <div style={{ position: 'absolute', left: 1100, top: 421, width: 680 }}>
    <Constraint number="01" title="Does the whole set fit the budget?" detail="Prices add up across sellers."/>
    <Constraint number="02" title="Who can bring it home?" detail="A willing seller needs a vehicle."/>
    <Constraint number="03" title="Can everything fit?" detail="The full load must fit one vehicle."/>
  </div>
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

function RequestTile({ kind, title }: { kind: 'desk' | 'chair' | 'tv' | 'stand'; title: string }) {
  return <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, height: 205, background: soft, borderRadius: 'var(--osd-radius)' }}><Furniture kind={kind}/><span style={{ fontSize: 29 }}>{title}</span></div>;
}
function Beat({ number, title, detail }: { number: string; title: string; detail: string }) {
  return <div style={{ display: 'flex', gap: 25, alignItems: 'flex-start', marginBottom: 34 }}><span style={{ fontSize: 25, color: muted, paddingTop: 7 }}>{number}</span><div><strong style={{ fontSize: 36, fontWeight: 500 }}>{title}</strong><div style={{ fontSize: 29, lineHeight: 1.5, color: muted, marginTop: 10 }}>{detail}</div></div></div>;
}
const Demo: Page = () => <Frame label="Live demo / furniture budget excludes delivery">
  <Heading>Four items.<br/>One coordinated pickup plan.</Heading>
  <div style={{ position: 'absolute', left: 120, top: 422, width: 825 }}>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}><RequestTile kind="tv" title="TV"/><RequestTile kind="stand" title="TV stand"/><RequestTile kind="desk" title="Desk"/><RequestTile kind="chair" title="Chair"/></div>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 40, borderBottom: `1px solid ${line}`, paddingBottom: 29 }}><span style={{ fontSize: 35 }}>$300 <span style={{ color: muted }}>for furniture</span></span><span style={{ fontSize: 35 }}>No car</span></div>
    <div style={{ fontSize: 28, color: muted, marginTop: 25 }}>Pittsburgh · Seller-assisted delivery</div>
  </div>
  <div style={{ position: 'absolute', left: 1080, top: 422, width: 710, paddingLeft: 48, borderLeft: `1px solid ${line}`, boxSizing: 'border-box' }}>
    <Label style={{ marginBottom: 34 }}>Live product walkthrough</Label>
    <Beat number="01" title="Build the bundle" detail="Compare complete furniture options."/>
    <Beat number="02" title="See how it gets home" detail="Driver, capacity and pickup route."/>
    <Beat number="03" title="Understand the total" detail="Furniture + delivery, shown separately."/>
  </div>
</Frame>;

const Closing: Page = () => <Frame dark label="Built by Snack Overflow">
  <div style={{ position: 'absolute', left: 120, top: 190, width: 1100 }}>
    <Label style={{ color: '#B9CABA' }}>For students without cars</Label>
    <h2 style={{ fontFamily: 'var(--osd-font-display)', fontSize: 112, fontWeight: 400, letterSpacing: -5, lineHeight: 1.08, margin: '42px 0' }}>From an empty room<br/>to a plan to<br/><span style={{ color: '#BDCEA6' }}>bring it home.</span></h2>
    <p style={{ fontSize: 35, lineHeight: 1.5, color: '#CFD9CD', marginTop: 44 }}>Furniture selection. Transport capacity. Pickup planning.</p>
  </div>
  <div style={{ position: 'absolute', right: 115, top: 334, transform: 'scale(.88)', transformOrigin: 'right center' }}><Room furnished/></div>
</Frame>;

export const notes: string[] = [
  `TARGET 20 SECONDS\nImagine arriving in Pittsburgh as a new student. Your room is empty. You need a desk, a chair, a TV, and a TV stand. You have three hundred dollars for furniture—but you don’t have a car.\n\nTeam: Snack Overflow. Product name is not yet decided.`,
  `TARGET 25 SECONDS\nEach item might be affordable on its own. But they’re scattered across different sellers. Which combination fits your budget? Who can transport it? Will everything fit in their vehicle? Those decisions affect each other.\n\nThe scattered-item graphic is conceptual, not a geographic map or a measured example.`,
  `TARGET 35 SECONDS\nWe turn those decisions into a constrained optimization problem. First, OR-Tools CP-SAT selects furniture bundles that cover every requested category, stay within the furniture budget, and have an eligible seller driver with enough capacity. Then we optimize pickup routes for candidate bundles and rank the results using travel time, delivery cost, and the buyer’s preference.\n\nPress Right once to reveal candidate-to-result pipeline, then again to advance.\n\nQ&A: Selected seller must drive; capacity uses abstract size units. Candidate generation and routing are separate, bounded stages, not a guarantee of global optimality. AI supports input and listing suggestions; it does not choose the final bundles.`,
  `TARGET 60 SECONDS — SWITCH TO THE RUNNING PRODUCT\n0–10s: Show prefilled TV + TV stand + desk + chair, $300 furniture budget, confirmed Pittsburgh location, seller delivery. Say: Here’s our student’s request: four items, a three-hundred-dollar furniture budget, and seller delivery.\n10–25s: Build my bundle. Say: The system gives us complete options, with furniture and delivery costs shown separately.\n25–45s: Open one result; point to driver, capacity and route. Say: This seller can carry the full bundle. The pickup plan starts at their location, visits the other sellers, and ends at the student’s home.\n45–60s: Show constraint explanation if time permits, then return to slides. Say: Each option covers the requested items and passes the budget, driver, and capacity checks.\n\nREHEARSAL: Verify available inventory and current results before presenting. Use screenshots from that exact run as fallback. Do not promise a fixed price or time. Do not reserve inventory during repeated rehearsals. This slide is a walkthrough cue, not an application screenshot.`,
  `TARGET 25 SECONDS\nFor students without cars, getting furniture home is part of finding furniture. We bring item selection, transport capacity, and pickup planning into one flow—so an empty room becomes a practical plan. We’re Snack Overflow.\n\nThe room is a conceptual illustration, not a claim of completed delivery. No measured savings are claimed in this draft. Later, add a validated example or comparison only after the demo dataset is fixed.\n\nTotal planned duration: 2:45, with 15 seconds of buffer inside the competition’s 3-minute presentation-plus-demo limit.`,
];
export const meta: SlideMeta = { title: 'No car. New home. — Snack Overflow', createdAt: '2026-09-12T14:46:28.883Z' };
export default [Arrival, Problem, Engine, Demo, Closing] satisfies Page[];
