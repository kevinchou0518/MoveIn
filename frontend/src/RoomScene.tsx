import { memo, useEffect, useRef, useState, type CSSProperties } from 'react'

// Isometric room built from CSS 3D faces (ported from the "Room Hero" design canvas).
// The stage is authored at 900×600 and scaled to the container width so it stays crisp.
const css = (s: string): CSSProperties => Object.fromEntries(s.split(';').map(d => d.trim()).filter(Boolean).map(d => { const i = d.indexOf(':'); return [d.slice(0, i).trim().replace(/-([a-z])/g, (_, c: string) => c.toUpperCase()), d.slice(i + 1).trim()] })) as CSSProperties
const A = 'position:absolute;', F = 'position:absolute;transform-origin:0 0;', B = 'position:absolute;transform-style:preserve-3d;'

function RoomScene() {
  const host = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  useEffect(() => {
    const el = host.current; if (!el) return
    const measure = () => { const s = el.clientWidth / 900; if (s > 0) setScale(s) }
    measure()
    if (typeof ResizeObserver === 'undefined') { window.addEventListener('resize', measure); return () => window.removeEventListener('resize', measure) }
    const ro = new ResizeObserver(measure); ro.observe(el); return () => ro.disconnect()
  }, [])
  return <div className="room-scene" ref={host} role="img" aria-label="Isometric illustration of a small apartment with a desk and chair, a TV on an oak stand, a floor lamp, and a potted plant">
    <div className="room-stage" style={{ transform: `scale(${scale})` }}>
      <div style={css(F + 'left:82px;top:405px;width:520px;height:520px;transform:rotateX(60deg) rotateZ(-45deg);transform-style:preserve-3d')}>
        <div style={css(A + 'inset:0;background:linear-gradient(135deg,#E8E4D6,#E1DCCB)')} />
        <div style={css(A + 'left:40px;top:40px;width:440px;height:440px;background:radial-gradient(closest-side,rgba(150,143,118,0.45),rgba(150,143,118,0));filter:blur(14px)')} />
        <div style={css(A + 'left:96px;top:104px;width:340px;height:330px;background-color:#DCD2BB;background-image:repeating-linear-gradient(0deg,rgba(255,255,255,0.5) 0 1px,transparent 1px 22px),repeating-linear-gradient(90deg,rgba(255,255,255,0.5) 0 1px,transparent 1px 22px)')} />
        {/* back wall with window */}
        <div style={css(F + 'left:0;top:0;width:520px;height:250px;background:linear-gradient(180deg,#DEDACB,#E6E2D5);transform:rotateX(90deg)')}>
          <div style={css(A + 'left:96px;top:60px;width:180px;height:140px;background:#D9E5D3;border:6px solid #EFEDE3;box-sizing:border-box')}>
            <div style={css(A + 'left:50%;top:0;bottom:0;width:6px;background:#EFEDE3;transform:translateX(-3px)')} />
            <div style={css(A + 'top:50%;left:0;right:0;height:6px;background:#EFEDE3;transform:translateY(-3px)')} />
          </div>
        </div>
        {/* side wall with picture frame */}
        <div style={css(F + 'left:520px;top:0;width:520px;height:250px;background:linear-gradient(180deg,#D6D2C3,#DFDBCD);transform:rotateZ(90deg) rotateX(90deg)')}>
          <div style={css(A + 'left:230px;top:116px;width:84px;height:96px;background:#EDEBE0;border:4px solid #C9B694;box-sizing:border-box;padding:8px')}>
            <div style={css(A + 'left:14px;bottom:12px;width:0;height:0;border-left:20px solid transparent;border-right:20px solid transparent;border-bottom:34px solid #7C9A63')} />
            <div style={css(A + 'right:14px;bottom:12px;width:14px;height:14px;border-radius:50%;background:#C8CE9B')} />
          </div>
        </div>
        {/* floor lamp */}
        <div style={css(B + 'left:300px;top:86px;width:8px;height:8px')}>
          <div style={css(F + 'left:0;top:0;width:8px;height:150px;background:#B7B3A1;transform:rotateZ(90deg) rotateX(90deg)')} />
          <div style={css(A + 'left:-22px;top:-22px;width:52px;height:52px;background:#B08F63;transform:translateZ(2px)')} />
        </div>
        <div style={css(B + 'left:272px;top:58px;width:64px;height:64px;transform:translateZ(122px)')}>
          <div style={css(A + 'inset:0;background:#EAD3A4;transform:translateZ(30px)')} />
          <div style={css(F + 'left:0;top:64px;width:64px;height:30px;background:#D8B87F;transform:rotateX(90deg)')} />
          <div style={css(F + 'left:0;top:0;width:64px;height:30px;background:#C9A76C;transform:rotateZ(90deg) rotateX(90deg)')} />
        </div>
        {/* desk */}
        {[[66, 60, '#A87C4A'], [246, 60, '#A87C4A'], [66, 136, '#96683A'], [246, 136, '#96683A']].map(([x, y, c]) => <div key={`${x}-${y}`} style={css(B + `left:${x}px;top:${y}px;width:8px;height:8px`)}>
          <div style={css(F + `left:0;top:0;width:8px;height:72px;background:${c};transform:rotateZ(90deg) rotateX(90deg)`)} />
        </div>)}
        <div style={css(B + 'left:60px;top:52px;width:200px;height:96px;transform:translateZ(72px)')}>
          <div style={css(A + 'inset:0;background:#D9B27C')} />
          <div style={css(F + 'left:0;top:96px;width:200px;height:7px;background:#C1975F;transform:rotateX(90deg)')} />
          <div style={css(F + 'left:0;top:0;width:96px;height:7px;background:#B3884F;transform:rotateZ(90deg) rotateX(90deg)')} />
          <div style={css(A + 'left:110px;top:30px;width:58px;height:42px;background:#F3F1E7;box-shadow:0 0 0 1px rgba(44,58,44,0.06)')} />
        </div>
        <div style={css(B + 'left:152px;top:66px;width:62px;height:44px;transform:translateZ(79px)')}>
          <div style={css(A + 'inset:0;background:#8DA974')} />
          <div style={css(F + 'left:0;top:0;width:62px;height:40px;background:#6F8C58;transform:rotateX(90deg)')} />
        </div>
        {/* office chair */}
        <div style={css(B + 'left:152px;top:218px;width:66px;height:9px')}>
          <div style={css(A + 'inset:0;background:#47593F;transform:translateZ(7px)')} />
          <div style={css(F + 'left:0;top:9px;width:66px;height:7px;background:#364629;transform:rotateX(90deg)')} />
          <div style={css(F + 'left:0;top:0;width:9px;height:7px;background:#3D4E36;transform:rotateZ(90deg) rotateX(90deg)')} />
        </div>
        <div style={css(B + 'left:180px;top:190px;width:9px;height:66px')}>
          <div style={css(A + 'inset:0;background:#47593F;transform:translateZ(7px)')} />
          <div style={css(F + 'left:0;top:66px;width:9px;height:7px;background:#364629;transform:rotateX(90deg)')} />
          <div style={css(F + 'left:0;top:0;width:66px;height:7px;background:#3D4E36;transform:rotateZ(90deg) rotateX(90deg)')} />
        </div>
        <div style={css(B + 'left:178px;top:216px;width:13px;height:13px;transform:translateZ(7px)')}>
          <div style={css(A + 'inset:0;background:#5A6E4E;transform:translateZ(44px)')} />
          <div style={css(F + 'left:0;top:13px;width:13px;height:44px;background:#45573C;transform:rotateX(90deg)')} />
          <div style={css(F + 'left:0;top:0;width:13px;height:44px;background:#4E6245;transform:rotateZ(90deg) rotateX(90deg)')} />
        </div>
        <div style={css(B + 'left:154px;top:194px;width:60px;height:58px;transform:translateZ(43px)')}>
          <div style={css(A + 'inset:0;background:#93B27A;border-radius:6px;transform:translateZ(10px)')} />
          <div style={css(F + 'left:0;top:58px;width:60px;height:10px;background:#78975F;transform:rotateX(90deg)')} />
          <div style={css(F + 'left:0;top:0;width:58px;height:10px;background:#6B8A54;transform:rotateZ(90deg) rotateX(90deg)')} />
        </div>
        <div style={css(B + 'left:156px;top:244px;width:56px;height:10px;transform:translateZ(53px)')}>
          <div style={css(A + 'inset:0;background:#A8C28F;transform:translateZ(52px)')} />
          <div style={css(F + 'left:0;top:10px;width:56px;height:52px;background:#8AA971;border-radius:0 0 8px 8px;transform:rotateX(90deg)')} />
          <div style={css(F + 'left:0;top:0;width:10px;height:52px;background:#6B8A54;transform:rotateZ(90deg) rotateX(90deg)')} />
        </div>
        {/* TV stand */}
        {[[418, 198, '#7A5334'], [418, 412, '#7A5334'], [484, 198, '#6B4829'], [484, 412, '#6B4829']].map(([x, y, c]) => <div key={`${x}-${y}`} style={css(B + `left:${x}px;top:${y}px;width:12px;height:12px`)}>
          <div style={css(F + `left:0;top:0;width:12px;height:18px;background:${c};transform:rotateZ(90deg) rotateX(90deg)`)} />
        </div>)}
        <div style={css(B + 'left:412px;top:190px;width:90px;height:240px;transform:translateZ(18px)')}>
          <div style={css(A + 'inset:0;background:#C08C55')} />
          <div style={css(F + 'left:0;top:240px;width:90px;height:66px;background:#A8743F;transform:rotateX(90deg)')} />
          <div style={css(F + 'left:0;top:0;width:240px;height:66px;background:#C99A63;transform:rotateZ(90deg) rotateX(90deg)')}>
            <div style={css(A + 'left:16px;top:10px;width:96px;height:46px;background:#B3834F;box-shadow:inset 0 0 0 1px rgba(63,42,20,0.18)')}>
              <div style={css(A + 'left:16px;bottom:8px;width:64px;height:7px;background:#EDE6D2')} />
              <div style={css(A + 'left:20px;bottom:17px;width:56px;height:7px;background:#DCD3B8')} />
              <div style={css(A + 'left:14px;bottom:26px;width:68px;height:7px;background:#EDE6D2')} />
            </div>
            <div style={css(A + 'left:128px;top:10px;width:96px;height:46px;background:#CFA470;box-shadow:inset 0 0 0 1px rgba(63,42,20,0.18)')}>
              <div style={css(A + 'left:10px;top:50%;width:3px;height:20px;background:#8A5F34;transform:translateY(-10px);border-radius:2px')} />
            </div>
          </div>
        </div>
        <div style={css(B + 'left:408px;top:186px;width:98px;height:248px;transform:translateZ(84px)')}>
          <div style={css(A + 'inset:0;background:#CE9C64')} />
          <div style={css(F + 'left:0;top:248px;width:98px;height:7px;background:#B0793F;transform:rotateX(90deg)')} />
          <div style={css(F + 'left:0;top:0;width:248px;height:7px;background:#C08C55;transform:rotateZ(90deg) rotateX(90deg)')} />
        </div>
        {/* TV */}
        <div style={css(B + 'left:440px;top:232px;width:26px;height:120px;transform:translateZ(91px)')}><div style={css(A + 'inset:0;background:#35443A')} /></div>
        <div style={css(B + 'left:448px;top:284px;width:10px;height:16px;transform:translateZ(91px)')}>
          <div style={css(F + 'left:0;top:0;width:10px;height:28px;background:#35443A;transform:rotateZ(90deg) rotateX(90deg)')} />
        </div>
        <div style={css(B + 'left:446px;top:222px;width:4px;height:140px;transform:translateZ(119px)')}>
          <div style={css(F + 'left:0;top:0;width:140px;height:86px;background:#35443A;border-radius:4px;transform:rotateZ(90deg) rotateX(90deg)')}>
            <div style={css(A + 'inset:6px;background:linear-gradient(180deg,#5E7A5A,#46604A);overflow:hidden')}>
              <div style={css(A + 'left:-6px;bottom:0;width:0;height:0;border-left:44px solid transparent;border-right:44px solid transparent;border-bottom:40px solid #7C9A6B')} />
              <div style={css(A + 'right:-10px;bottom:0;width:0;height:0;border-left:46px solid transparent;border-right:46px solid transparent;border-bottom:52px solid #9DBA87')} />
              <div style={css(A + 'right:14px;top:10px;width:18px;height:18px;border-radius:50%;background:#DCE5AE')} />
            </div>
          </div>
        </div>
        {/* potted plant */}
        <div style={css(B + 'left:432px;top:452px;width:44px;height:44px')}>
          <div style={css(A + 'inset:0;background:#C99A63;transform:translateZ(44px)')} />
          <div style={css(F + 'left:0;top:44px;width:44px;height:44px;background:#B5793F;transform:rotateX(90deg)')} />
          <div style={css(F + 'left:0;top:0;width:44px;height:44px;background:#C68C51;transform:rotateZ(90deg) rotateX(90deg)')} />
        </div>
        <div style={css(B + 'left:452px;top:430px;width:4px;height:88px;transform:translateZ(44px)')}>
          <div style={css(F + 'left:0;top:0;width:88px;height:104px;transform:rotateZ(90deg) rotateX(90deg)')}>
            <div style={css(A + 'left:42px;bottom:0;width:4px;height:84px;background:#6C8B55')} />
            <div style={css(A + 'left:-2px;bottom:18px;width:48px;height:28px;border-radius:50% 50% 50% 4px;background:#8FAE7E')} />
            <div style={css(A + 'left:42px;bottom:30px;width:50px;height:28px;border-radius:50% 50% 4px 50%;background:#7FA06C')} />
            <div style={css(A + 'left:6px;bottom:46px;width:42px;height:26px;border-radius:50% 50% 50% 4px;background:#9CBB88')} />
            <div style={css(A + 'left:42px;bottom:58px;width:40px;height:24px;border-radius:50% 50% 4px 50%;background:#8FAE7E')} />
            <div style={css(A + 'left:24px;bottom:70px;width:26px;height:20px;border-radius:50% 50% 50% 4px;background:#A8C592')} />
          </div>
        </div>
      </div>
      <span className="room-note" style={{ left: 54, top: 130 }}>A spot to focus<svg width="26" height="26" viewBox="0 0 26 26" fill="none" stroke="#7C9A63" strokeWidth="1.5"><path d="M7 7 L19 19" /><path d="M19 12 L19 19 L12 19" /></svg></span>
      <span className="room-note" style={{ right: 34, top: 448 }}><svg width="26" height="26" viewBox="0 0 26 26" fill="none" stroke="#7C9A63" strokeWidth="1.5"><path d="M19 19 L7 7" /><path d="M7 14 L7 7 L14 7" /></svg>A place to unwind</span>
      <span className="room-dim"><i />12′ × 14′<i /></span>
    </div>
  </div>
}

export default memo(RoomScene)
