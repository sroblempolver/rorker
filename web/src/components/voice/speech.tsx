"use client";
// Free voice, built into the browser: speech to text with SpeechRecognition (Chrome, Edge, Safari;
// Firefox doesn't have it) and spoken replies with speechSynthesis (every modern browser). Nothing is
// sent to a paid voice service. A native app later removes the browser limits.
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
  "no-speech": "Didn't hear anything. Tap and talk again.",
  "audio-capture": "No microphone found.",
  network: "Voice needs an internet connection in this browser.",
};

/** Tap to talk: listens until you stop speaking, then hands over what you said. */
export function useDictation(onText: (text: string) => void, lang?: string) {
  const [supported, setSupported] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<Rec | null>(null);
  const got = useRef("");
  const cb = useRef(onText);
  cb.current = onText;
  useEffect(() => { setSupported(canListen()); setBlocked(!micAllowed()); }, []);
  useEffect(() => () => rec.current?.abort(), []);

  const start = useCallback(() => {
    const R = recognizer();
    if (!R) return;
    stopSpeaking(); // don't transcribe our own voice
    rec.current?.abort();
    const r = new R();
    r.lang = lang ?? (typeof navigator !== "undefined" ? navigator.language : "en-US");
    r.continuous = false;
    r.interimResults = true;
    r.maxAlternatives = 1;
    got.current = "";
    r.onresult = (e) => {
      let fin = "", mid = "";
      for (let i = 0; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) fin += res[0].transcript; else mid += res[0].transcript;
      }
      got.current = fin || got.current;
      setInterim((fin + " " + mid).trim());
    };
    r.onerror = (e) => {
      if (e.error === "aborted") return;
      if ((e.error === "not-allowed" || e.error === "service-not-allowed") && framed()) { setBlocked(true); setError(FRAMED); return; }
      setError(ERRORS[e.error] ?? "Voice stopped. Tap to try again.");
    };
    r.onend = () => {
      setListening(false);
      const text = got.current.trim();
      setInterim("");
      if (text) cb.current(text);
    };
    setError(null);
    setListening(true);
    rec.current = r;
    try { r.start(); } catch { setListening(false); }
  }, [lang]);

  const stop = useCallback(() => rec.current?.stop(), []);
  return { supported, blocked, listening, interim, error, start, stop };
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
  const { supported, blocked, listening, start, stop } = dictation;
  const lg = size === "lg";
  if (!supported || blocked) return null;
  return (
    <button type="button" onClick={() => (listening ? stop() : start())} aria-pressed={listening} aria-label={listening ? "Stop listening" : label}
      title={listening ? "Listening… tap to stop" : `${label}: tap and speak`}
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
  if (dictation.listening) return <p className="text-[12px] text-accent">Listening… {dictation.interim && <span className="text-text">“{dictation.interim}”</span>}</p>;
  return null;
}
