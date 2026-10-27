"use client";
// Free voice, built into the browser: speech to text with SpeechRecognition (Chrome, Edge, Safari;
// Firefox doesn't have it) and spoken replies with speechSynthesis (every modern browser). Nothing is
// sent to a paid voice service. A native app later removes the browser limits.
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";

type Rec = {
  lang: string; continuous: boolean; interimResults: boolean; maxAlternatives: number;
  start(): void; stop(): void; abort(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

function recognizer(): (new () => Rec) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export const canListen = () => !!recognizer();
/** False when the page sits inside a frame that isn't given the microphone (an embedded preview):
 *  the browser blocks it there whatever the site permission says. */
export function micAllowed(): boolean {
  if (typeof document === "undefined") return true;
  const d = document as unknown as { permissionsPolicy?: { allowsFeature(f: string): boolean }; featurePolicy?: { allowsFeature(f: string): boolean } };
  const pol = d.permissionsPolicy ?? d.featurePolicy;
  try { return pol?.allowsFeature ? pol.allowsFeature("microphone") : true; } catch { return true; }
}
const framed = () => typeof window !== "undefined" && window.self !== window.top;
const FRAMED = "This preview window isn't allowed to use the microphone, whatever the browser setting says. Voice works in the full app; type for now.";

export const canSpeak = () => typeof window !== "undefined" && "speechSynthesis" in window;

const ERRORS: Record<string, string> = {
  "not-allowed": "Microphone is blocked. Allow it in the browser's address bar, then try again.",
  "service-not-allowed": "Microphone is blocked. Allow it in the browser's address bar, then try again.",
  "no-speech": "Didn't hear anything. Hold the mic while you talk.",
  "audio-capture": "No microphone found.",
  network: "Voice needs an internet connection in this browser.",
};

/** Push to talk: listens while the button is held down and hands over everything said when it's let go,
 *  so a pause mid-sentence doesn't cut you off. */
export function useDictation(onText: (text: string) => void, lang?: string) {
  const [supported, setSupported] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<Rec | null>(null);
  const held = useRef(false);
  const said = useRef(""); // finished phrases from earlier rounds while the button stayed down
  const fin = useRef(""); // this round's finished phrases
  const mid = useRef(""); // this round's unfinished words
  const cb = useRef(onText);
  cb.current = onText;
  useEffect(() => { setSupported(canListen()); setBlocked(!micAllowed()); }, []);
  useEffect(() => () => { held.current = false; rec.current?.abort(); }, []);

  const listen = useCallback(() => {
    const R = recognizer();
    if (!R) return;
    const r = new R();
    r.lang = lang ?? (typeof navigator !== "undefined" ? navigator.language : "en-US");
    r.continuous = true;
    r.interimResults = true;
    r.maxAlternatives = 1;
    fin.current = "";
    mid.current = "";
    r.onresult = (e) => {
      let f = "", m = "";
      for (let i = 0; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) f += res[0].transcript; else m += res[0].transcript;
      }
      fin.current = f;
      mid.current = m;
      setInterim(`${said.current} ${f} ${m}`.replace(/\s+/g, " ").trim());
    };
    r.onerror = (e) => {
      if (e.error === "aborted" || e.error === "no-speech") return;
      held.current = false;
      if ((e.error === "not-allowed" || e.error === "service-not-allowed") && framed()) { setBlocked(true); setError(FRAMED); return; }
      setError(ERRORS[e.error] ?? "Voice stopped. Hold the mic and try again.");
    };
    r.onend = () => {
      // the browser ends a round by itself after a pause: start another while the button is still down
      if (rec.current !== r) return; // replaced by a newer round
      said.current = `${said.current} ${fin.current} ${held.current ? "" : mid.current}`.replace(/\s+/g, " ").trim();
      if (held.current) { listen(); return; }
      rec.current = null;
      setListening(false);
      setInterim("");
      const text = said.current;
      said.current = "";
      if (text) cb.current(text);
    };
    rec.current = r;
    try { r.start(); } catch { held.current = false; rec.current = null; setListening(false); }
  }, [lang]);

  const start = useCallback(() => {
    if (!recognizer() || held.current) return;
    stopSpeaking(); // don't transcribe our own voice
    const old = rec.current;
    rec.current = null;
    old?.abort();
    held.current = true;
    said.current = "";
    setError(null);
    setInterim("");
    setListening(true);
    listen();
  }, [listen]);

  const stop = useCallback(() => {
    held.current = false;
    if (rec.current) rec.current.stop(); else setListening(false);
  }, []);

  /** Spread on a mic button: hold to talk (mouse, finger, or Space/Enter), let go to send. */
  const hold = useCallback((before?: () => boolean | void) => ({
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
      if (e.button !== 0) return;
      e.preventDefault();
      if (before?.() === false) return;
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* old browsers */ }
      start();
    },
    onPointerUp: stop,
    onPointerCancel: stop,
    onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => {
      if ((e.key === " " || e.key === "Enter") && !e.repeat) { e.preventDefault(); if (before?.() !== false) start(); }
    },
    onKeyUp: (e: React.KeyboardEvent<HTMLElement>) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); stop(); } },
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
    style: { touchAction: "none", userSelect: "none", WebkitUserSelect: "none", WebkitTouchCallout: "none" } as React.CSSProperties,
  }), [start, stop]);

  return { supported, blocked, listening, interim, error, start, stop, hold };
}

let voice: SpeechSynthesisVoice | null = null;
function pickVoice() {
  if (!canSpeak()) return null;
  if (voice) return voice;
  const all = window.speechSynthesis.getVoices();
  const lang = (navigator.language || "en-US").slice(0, 2);
  voice = all.find((v) => v.lang.startsWith(lang) && /Google|Samantha|Daniel|Microsoft (Guy|Aria|Jenny)/.test(v.name))
    ?? all.find((v) => v.lang.startsWith(lang)) ?? all[0] ?? null;
  return voice;
}

/** Read a reply out loud in the browser's own voice. Markdown and links are skipped. */
export function speak(text: string, onEnd?: () => void) {
  if (!canSpeak()) return;
  const clean = text.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/[*_`#>]/g, "").replace(/https?:\/\/\S+/g, "").slice(0, 1200);
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(clean);
  const v = pickVoice();
  if (v) u.voice = v;
  u.rate = 1.05;
  u.onend = () => onEnd?.();
  window.speechSynthesis.speak(u);
}

export function stopSpeaking() {
  if (canSpeak()) window.speechSynthesis.cancel();
}

/** The round talk button. `size` "lg" for the assistant, "sm" inside a form. */
export function MicButton({ dictation, size = "sm", label = "Talk" }: { dictation: ReturnType<typeof useDictation>; size?: "sm" | "lg"; label?: string }) {
  const { supported, blocked, listening, hold } = dictation;
  const lg = size === "lg";
  if (!supported || blocked) return null;
  return (
    <button type="button" {...hold()} aria-pressed={listening} aria-label={`${label}: hold to talk`}
      title={listening ? "Listening… let go when you're done" : `${label}: hold and speak, let go to send`}
      className={`shrink-0 rounded-full grid place-items-center border transition-colors ${lg ? "w-12 h-12" : "w-10 h-10"} ${listening ? "bg-red border-red text-white animate-pulse" : "bg-panel-2 border-line text-text hover:border-accent hover:text-accent"}`}>
      <svg width={lg ? 20 : 16} height={lg ? 20 : 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><rect x="9" y="3" width="6" height="11" rx="3" fill={listening ? "currentColor" : "none"} /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
    </button>
  );
}

/** One line under a voice box saying what's happening, or why voice isn't here. */
export function VoiceNote({ dictation }: { dictation: ReturnType<typeof useDictation> }) {
  const [shown, setShown] = useState(false);
  useEffect(() => setShown(true), []);
  if (!shown) return null;
  if (!dictation.supported) return <p className="text-[12px] text-muted">Voice works in Chrome, Edge and Safari. In this browser, type instead.</p>;
  if (dictation.blocked) return <p className="text-[12px] text-muted">{FRAMED}</p>;
  if (dictation.error) return <p className="text-[12px] text-amber">{dictation.error}</p>;
  if (dictation.listening) return <p className="text-[12px] text-accent">Listening, let go when done… {dictation.interim && <span className="text-text">“{dictation.interim}”</span>}</p>;
  return null;
}
