"use client";
// Holds the browser's speech recogniser for the text box. Not every browser has one (Firefox does not): `supported` is
// false there and the voice button is not shown. The hook never touches the network itself; the browser decides where the
// sound is recognised (Chrome sends it to its maker's service), which the screen says while it listens.
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { joinSpoken, problemOf, transcriptOf, type SpeechProblem } from "./speech";

interface Alternative {
  transcript: string;
}
interface RecognitionEvent {
  results: ArrayLike<ArrayLike<Alternative>>;
}
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognitionCtor = new () => Recognition;

function ctor(): RecognitionCtor | null {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const noSubscribe = () => () => {};

export function useSpeech() {
  // read on the client only, so the server render and the first client render agree (no button), then the button appears
  const supported = useSyncExternalStore(noSubscribe, () => ctor() !== null, () => false);
  const [listening, setListening] = useState(false);
  const [problem, setProblem] = useState<SpeechProblem | null>(null);
  const rec = useRef<Recognition | null>(null);

  const stop = useCallback(() => {
    rec.current?.stop();
  }, []);

  /** Starts listening in `lang`; every update calls `onText` with the box's old text plus what has been said so far. */
  const start = useCallback((lang: string, base: string, onText: (text: string) => void) => {
    const Ctor = ctor();
    if (!Ctor) return;
    rec.current?.abort();
    const r = new Ctor();
    r.lang = lang;
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (e) => onText(joinSpoken(base, transcriptOf(e.results)));
    r.onerror = (e) => setProblem(problemOf(e.error));
    r.onend = () => {
      if (rec.current === r) rec.current = null;
      setListening(false);
    };
    rec.current = r;
    setProblem(null);
    try {
      r.start();
      setListening(true);
    } catch {
      rec.current = null;
      setProblem("other");
    }
  }, []);

  // leaving the page, or a check starting, must not leave the microphone open
  useEffect(() => () => rec.current?.abort(), []);

  return { supported, listening, problem, start, stop };
}
