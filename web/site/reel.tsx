// A 15-second vertical reel (9:16) on how the voice assistant works, drawn in code on the app's real 3D
// house. Everything on screen is worked out from the time since the start, so a recorder that steps the
// clock frame by frame (site/reel-render.mjs) gets the same video every time. Open reel.html to watch it live.
import { StrictMode, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { clearMarks, showMarks } from "@/lib/plan/marks";
import { hatColor, initials } from "@/components/team/Avatar";
import symbolSvg from "../public/brand/symbol-orange.svg";
import logoSvg from "../public/brand/rorker-horizontal-orange.svg";
import { BASE_SCENE, GROUND, House, director, makePin, roomByType, roomPlanPoint, roomPoint, type Scene } from "./stage";

export const LENGTH = 15000;

const KITCHEN = roomByType(GROUND, "kitchen");
const LAV = GROUND.rooms.find((r) => r.type === "wc") ?? roomByType(GROUND, "laundry");
const PINS = [
  makePin({ id: "r1", number: 1, kind: "task", title: "Rough-in counter outlets", element_id: KITCHEN.id, floor_id: GROUND.id }),
  makePin({ id: "r2", number: 2, kind: "issue", title: "Leak under the vanity", element_id: LAV.id, floor_id: GROUND.id }),
];

const ASK = "Where's the leak at Hadley?";
const ANSWER = "In the lavatory, under the vanity. Tom has it, due today.";
const TELL = "Move it to tomorrow and text Tom.";

// ------------------------------------------------------------------------------------------ timing helpers

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const ease = (k: number) => 1 - Math.pow(1 - clamp01(k), 3);
/** 0 → 1 over [a, a+ms], then back to 0 over [b, b+ms] */
const inOut = (t: number, a: number, b = Infinity, ms = 300) => Math.min(ease((t - a) / ms), 1 - ease((t - b) / ms));
const typed = (t: number, text: string, start: number, cps: number) => text.slice(0, Math.max(0, Math.floor(((t - start) / 1000) * cps)));
const slide = (k: number, px = 24): CSSProperties => ({ opacity: k, transform: `translateY(${(1 - k) * px}px)` });

function Face({ name, size }: { name: string; size: number }) {
  return <span className="face" style={{ width: size, height: size, fontSize: size * 0.4, background: hatColor(name) }}>{initials(name)}</span>;
}

// ------------------------------------------------------------------------------------------ the reel

function Reel() {
  const [t, setT] = useState(0);
  useEffect(() => {
    const t0 = performance.now();
    let raf = 0;
    const tick = () => { setT(Math.min(LENGTH, performance.now() - t0)); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // what the house shows: the whole house, then the ground floor while it talks, then the house again
  const phase = t < 4900 ? 0 : t < 12600 ? 1 : 2;
  const scene = useMemo<Scene>(() => (phase === 1 ? { ...BASE_SCENE, mode: "floor", floorId: GROUND.id, pins: PINS, selectedPin: "r2" } : { ...BASE_SCENE, pins: PINS }), [phase]);
  useEffect(() => {
    const [lx, ly] = roomPlanPoint(LAV.id);
    if (phase === 0) { director.pose({ az: 0.55, pol: 0.95, dist: 3.2, spin: 0.16 }); director.snap(); }
    if (phase === 1) director.pose({ az: 0.35, pol: 0.55, dist: 1.5, at: [lx / 1000, 0, ly / 1000] });
    if (phase === 2) { director.pose({ az: 0.9, pol: 0.9, dist: 3.4, spin: 0.12 }); clearMarks(); }
  }, [phase]);
  const pointed = t >= 5500;
  useEffect(() => {
    if (!pointed) return;
    const [x, y] = roomPlanPoint(LAV.id);
    showMarks([{ floor_id: GROUND.id, x, y, z: 900, label: "Leak", color: "#ff4fa3", id: LAV.id }]);
  }, [pointed]);

  // the parts on screen
  const hook = inOut(t, 150, 2100, 450);
  const sheet = inOut(t, 1900, 12400, 400);
  const tap1 = t >= 2500 && t < 3100 ? (t - 2500) / 600 : -1;
  const tap2 = t >= 8100 && t < 8700 ? (t - 8100) / 600 : -1;
  const listening = (t >= 2600 && t < 4700) || (t >= 8200 && t < 10000);
  const thinking = (t >= 4700 && t < 5500) || (t >= 10000 && t < 10300);
  const ask = typed(t, ASK, 2900, 16);
  const tell = typed(t, TELL, 8400, 22);
  const answer = typed(t, ANSWER, 5700, 34);
  const step = t < 8000 ? 1 : 2;
  const stepK = t < 8000 ? inOut(t, 2200, 7800) : inOut(t, 8000, 12300);
  const done = (n: number) => ease((t - (10300 + n * 450)) / 300);
  const end = ease((t - 12600) / 600);
  const leakAt = director.toScreen(roomPoint(LAV.id, 1.9));
  const tomOn = t >= 11200 ? ease((t - 11200) / 300) : 0;

  return (
    <div className="reel">
      <div className="world"><House scene={scene} /></div>
      <div className="shade" />

      <div className="top" style={{ opacity: 1 - end }}>
        <span className="brand" dangerouslySetInnerHTML={{ __html: logoSvg }} />
        <span className="live"><i style={{ opacity: 0.4 + 0.6 * Math.abs(Math.sin(t / 380)) }} />Voice</span>
      </div>

      <div className="hook" style={slide(hook, 40)}>
        <div className="kicker">Rorker</div>
        <h1>Talk to<br />your jobs.</h1>
        <p>One tap. Ask anything. Tell it what to change.</p>
      </div>

      <div className="step" style={slide(stepK, -16)}>
        <span className="num">{step}</span>{step === 1 ? "Ask out loud" : "Tell it what to do"}
      </div>

      {phase === 1 && leakAt.on && (
        <div className="tom" style={{ transform: `translate(${leakAt.x - 18}px, ${leakAt.y - 70}px)`, opacity: tomOn }}>
          <Face name="Tom Reilly" size={36} />
          <span>Texted</span>
        </div>
      )}

      <div className="sheet" style={slide(sheet, 120)}>
        {(t < 8100 ? ask : tell) && (
          <Bubble who="you" k={1}>{t < 8100 ? ask : tell}{listening && <i className="caret" style={{ opacity: Math.round(t / 400) % 2 }} />}</Bubble>
        )}
        {t >= 5600 && t < 8100 && <Bubble who="rorker" k={ease((t - 5600) / 250)}>{answer}</Bubble>}
        {t >= 10300 && (
          <div className="done" style={slide(done(0), 16)}>
            <div className="done-head"><Check /> Done</div>
            <div className="row" style={slide(done(1), 10)}><span>Leak under the vanity</span><b>#2</b></div>
            <div className="row" style={slide(done(2), 10)}><span>Due</span><b><s>Today</s> → Tomorrow</b></div>
            <div className="row" style={slide(done(3), 10)}><span>Texted Tom Reilly</span><Face name="Tom Reilly" size={26} /></div>
          </div>
        )}
        {thinking && <div className="thinking">{[0, 1, 2].map((i) => <i key={i} style={{ opacity: 0.3 + 0.7 * Math.abs(Math.sin(t / 160 - i * 0.8)) }} />)}</div>}
        <div className="micbar">
          <div className={`mic ${listening ? "on" : ""}`}>
            <MicIcon />
            {tap1 >= 0 && <span className="tap" style={{ transform: `scale(${0.6 + tap1 * 1.4})`, opacity: 1 - tap1 }} />}
            {tap2 >= 0 && <span className="tap" style={{ transform: `scale(${0.6 + tap2 * 1.4})`, opacity: 1 - tap2 }} />}
          </div>
          <div className="wave">
            {Array.from({ length: 22 }, (_, i) => {
              const h = listening ? 6 + 30 * Math.abs(Math.sin(t / 110 + i * 0.9) * Math.sin(t / 270 + i * 0.37)) : 4;
              return <i key={i} style={{ height: h }} />;
            })}
          </div>
          <span className="hint">{listening ? "Listening" : thinking ? "Thinking" : "Tap and talk"}</span>
        </div>
      </div>

      {(tap1 >= 0 || tap2 >= 0) && <div className="finger" style={{ opacity: Math.min(tap1 >= 0 ? 1 - tap1 : 1, tap2 >= 0 ? 1 - tap2 : 1) }} />}

      <div className="end" style={{ opacity: end, pointerEvents: "none" }}>
        <span className="mark" dangerouslySetInnerHTML={{ __html: symbolSvg }} style={{ transform: `scale(${0.8 + 0.2 * end})` }} />
        <h2>One tap.<br />Just talk.</h2>
        <p>It knows every job, points at the spot,<br />and makes the change.</p>
        <div className="url">rorker.com</div>
      </div>
    </div>
  );
}

function Bubble({ who, k, children }: { who: "you" | "rorker"; k: number; children: ReactNode }) {
  return <div className={`bubble ${who}`} style={slide(k, 12)}><span className="who">{who === "you" ? "You" : "Rorker"}</span>{children}</div>;
}

const MicIcon = () => <svg width="30" height="34" viewBox="0 0 12 14"><rect x="3.5" y="1" width="5" height="8" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M1 7a5 5 0 0 0 10 0M6 12v1.5" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>;
const Check = () => <svg width="18" height="18" viewBox="0 0 18 18"><path d="M3 9.5l4 4 8-9" fill="none" stroke="currentColor" strokeWidth="2.6" /></svg>;

createRoot(document.getElementById("root")!).render(<StrictMode><Reel /></StrictMode>);
