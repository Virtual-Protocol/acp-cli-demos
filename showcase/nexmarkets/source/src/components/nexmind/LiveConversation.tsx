"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { Icon } from "@/components/product/Icon";
import type { NexMindSession, ProposalField } from "./types";

const INPUT_RATE = 16_000;

type LiveState = "listening" | "understanding" | "speaking" | "paused" | "reviewing";
type Speaker = "user" | "nexmind" | "reviewing" | "waiting";
type BridgeMessage =
  | { type: "connecting"; model?: string; voiceName?: string; responseModalities?: string[] }
  | { type: "ready"; model?: string; voiceName?: string; responseModalities?: string[] }
  | { type: "audio"; mimeType?: string; data: string }
  | { type: "text" | "inputTranscript" | "outputTranscript"; text: string }
  | { type: "interrupted" | "turnComplete" }
  | { type: "closed"; code?: number; reason?: string }
  | { type: "error"; error?: string };

function clock(seconds: number) {
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function liveBridgeUrl() {
  const explicit = process.env.NEXT_PUBLIC_NEXMIND_LIVE_BRIDGE_URL?.trim();
  if (explicit) return explicit;
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const port = process.env.NEXT_PUBLIC_NEXMIND_LIVE_BRIDGE_PORT?.trim() || "8787";
  return `${protocol}//${window.location.hostname}:${port}/nexmind/gemini-live`;
}

function appendText(current: string, next: string) {
  const trimmed = next.trim();
  if (!trimmed) return current;
  if (!current) return trimmed;
  if (current.endsWith(trimmed)) return current;
  return `${current} ${trimmed}`.replace(/\s+/g, " ").trim();
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return btoa(binary);
}

function base64ToBytes(base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function encodePcm16(samples: Float32Array) {
  const bytes = new Uint8Array(samples.length * 2);
  const view = new DataView(bytes.buffer);
  for (let index = 0; index < samples.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, samples[index] || 0));
    view.setInt16(index * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }
  return bytes;
}

function downsample(input: Float32Array, inputRate: number, outputRate: number) {
  if (inputRate === outputRate) return input;
  const ratio = inputRate / outputRate;
  const length = Math.floor(input.length / ratio);
  const output = new Float32Array(length);
  for (let index = 0; index < length; index += 1) {
    const start = Math.floor(index * ratio);
    const end = Math.min(input.length, Math.floor((index + 1) * ratio));
    let total = 0;
    for (let cursor = start; cursor < end; cursor += 1) total += input[cursor] || 0;
    output[index] = total / Math.max(1, end - start);
  }
  return output;
}

function pcmRate(mimeType?: string) {
  const match = /rate=(\d+)/i.exec(mimeType || "");
  return match ? Number(match[1]) : 24_000;
}

function pcmAudioBuffer(context: AudioContext, base64: string, mimeType?: string) {
  const bytes = base64ToBytes(base64);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const sampleCount = Math.floor(bytes.byteLength / 2);
  const buffer = context.createBuffer(1, sampleCount, pcmRate(mimeType));
  const channel = buffer.getChannelData(0);
  for (let index = 0; index < sampleCount; index += 1) channel[index] = view.getInt16(index * 2, true) / 0x8000;
  return buffer;
}

function contextSummary(session: NexMindSession, fields: ProposalField[]) {
  return JSON.stringify({
    sessionId: session.id,
    purpose: session.purpose,
    productionId: session.productionId,
    state: session.state,
    context: session.context,
    confirmedFields: fields,
    lastMessages: session.messages.slice(-12).map((message) => ({ speaker: message.speaker, text: message.text })),
  });
}

export function LiveConversation({ session, fields, onClose, onComplete, onPersist, onNativeTurn }: {
  session: NexMindSession;
  fields: ProposalField[];
  onClose: () => void;
  onComplete: () => Promise<void>;
  onPersist: (partial: string | null, liveState: LiveState) => Promise<void>;
  onNativeTurn: (userText: string | null, assistantText: string | null) => Promise<void>;
}) {
  const [speaker, setSpeaker] = useState<Speaker>("reviewing");
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [captured, setCaptured] = useState("");
  const [assistantText, setAssistantText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [nativeStatus, setNativeStatus] = useState("Connecting to native Gemini Live");
  const [levels, setLevels] = useState({ low: 0.02, mid: 0.02, high: 0.02, pressure: 0.02 });
  const socket = useRef<WebSocket | null>(null);
  const media = useRef<MediaStream | null>(null);
  const audio = useRef<AudioContext | null>(null);
  const inputNode = useRef<ScriptProcessorNode | null>(null);
  const playbackCursor = useRef(0);
  const userTurn = useRef("");
  const assistantTurn = useRef("");
  const pausedRef = useRef(false);
  const mutedRef = useRef(false);
  const partialRef = useRef("");
  const questions = session.messages.filter((message) => message.speaker === "NEXMIND" && message.text.includes("?")).length;
  const latestAssistant = assistantText || [...session.messages].reverse().find((message) => message.speaker !== "USER")?.text;
  const liveText = captured || latestAssistant || "Native Gemini Live is listening.";
  const reputation = session.purpose === "REPUTATION_ENHANCEMENT";

  const sendBridge = useCallback((payload: Record<string, unknown>) => {
    if (socket.current?.readyState === WebSocket.OPEN) socket.current.send(JSON.stringify(payload));
  }, []);

  const saveTurn = useCallback(async () => {
    const userText = userTurn.current.trim();
    const replyText = assistantTurn.current.trim();
    if (!userText && !replyText) return;
    userTurn.current = "";
    assistantTurn.current = "";
    setCaptured("");
    if (replyText) setAssistantText(replyText);
    await onNativeTurn(userText || null, replyText || null).catch((reason) => {
      setError(reason instanceof Error ? reason.message : "Gemini Live transcript was not saved.");
    });
  }, [onNativeTurn]);

  const playAudio = useCallback((data: string, mimeType?: string) => {
    const context = audio.current;
    if (!context) return;
    const buffer = pcmAudioBuffer(context, data, mimeType);
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    const startAt = Math.max(context.currentTime + 0.02, playbackCursor.current || context.currentTime);
    source.start(startAt);
    playbackCursor.current = startAt + buffer.duration;
    source.onended = () => {
      if (!pausedRef.current && !mutedRef.current && context.currentTime >= playbackCursor.current - 0.05) setSpeaker("user");
    };
  }, []);

  const handleBridge = useCallback((event: MessageEvent<string>) => {
    let message: BridgeMessage;
    try { message = JSON.parse(event.data) as BridgeMessage; }
    catch { setError("Gemini Live bridge sent an invalid message."); return; }

    if (message.type === "connecting") setNativeStatus(`Connecting ${message.model || "Gemini Live"}`);
    if (message.type === "ready") { setNativeStatus(`Gemini Live native · ${message.model || "connected"}`); setSpeaker("user"); }
    if (message.type === "error") setError(message.error || "Gemini Live failed.");
    if (message.type === "closed") setError(message.reason || `Gemini Live bridge closed${message.code ? ` (${message.code})` : ""}.`);
    if (message.type === "interrupted") { playbackCursor.current = audio.current?.currentTime || 0; setSpeaker("user"); }
    if (message.type === "audio") { setSpeaker("nexmind"); playAudio(message.data, message.mimeType); }
    if (message.type === "inputTranscript") {
      userTurn.current = appendText(userTurn.current, message.text);
      setCaptured(userTurn.current);
      partialRef.current = userTurn.current;
    }
    if (message.type === "outputTranscript" || message.type === "text") {
      assistantTurn.current = appendText(assistantTurn.current, message.text);
      setAssistantText(assistantTurn.current);
      setSpeaker("nexmind");
    }
    if (message.type === "turnComplete") {
      void saveTurn();
      if (!pausedRef.current && !mutedRef.current) setSpeaker("user");
    }
  }, [playAudio, saveTurn]);

  useEffect(() => { const timer = window.setInterval(() => setElapsed((value) => value + 1), 1_000); return () => window.clearInterval(timer); }, []);

  useEffect(() => {
    let disposed = false;
    const AudioContextCtor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) { setError("This browser cannot open the audio engine required for Gemini Live."); return; }
    const context = new AudioContextCtor();
    audio.current = context;
    playbackCursor.current = context.currentTime;
    const liveSocket = new WebSocket(liveBridgeUrl());
    socket.current = liveSocket;
    liveSocket.onopen = () => liveSocket.send(JSON.stringify({ type: "setup", context: contextSummary(session, fields) }));
    liveSocket.onmessage = handleBridge;
    liveSocket.onerror = () => setError("Could not connect to the native Gemini Live bridge. Start the dev server with npm run dev and check the Gemini Live key.");
    liveSocket.onclose = (event) => { if (!disposed && event.code !== 1000) setError(event.reason || `Gemini Live bridge closed (${event.code}).`); };

    void navigator.mediaDevices?.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } }).then((stream) => {
      if (disposed) { stream.getTracks().forEach((track) => track.stop()); return; }
      media.current = stream;
      const source = context.createMediaStreamSource(stream);
      const processor = context.createScriptProcessor(4096, 1, 1);
      const silent = context.createGain();
      silent.gain.value = 0;
      processor.onaudioprocess = (event) => {
        const channel = event.inputBuffer.getChannelData(0);
        let total = 0;
        let peak = 0;
        for (let index = 0; index < channel.length; index += 1) {
          const value = Math.abs(channel[index] || 0);
          total += value;
          peak = Math.max(peak, value);
        }
        const average = total / Math.max(1, channel.length);
        setLevels({ low: average * 1.4, mid: average, high: peak * 0.7, pressure: Math.min(1, average * 2.5 + peak * 0.25) });
        if (pausedRef.current || mutedRef.current || liveSocket.readyState !== WebSocket.OPEN) return;
        const pcm = encodePcm16(downsample(channel, context.sampleRate, INPUT_RATE));
        liveSocket.send(JSON.stringify({ type: "audio", mimeType: `audio/pcm;rate=${INPUT_RATE}`, data: bytesToBase64(pcm) }));
      };
      source.connect(processor);
      processor.connect(silent);
      silent.connect(context.destination);
      inputNode.current = processor;
      setSpeaker("user");
    }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Microphone permission was not granted."));

    return () => {
      disposed = true;
      void saveTurn();
      liveSocket.close(1000, "Live layer closed");
      media.current?.getTracks().forEach((track) => track.stop());
      inputNode.current?.disconnect();
      void context.close();
    };
  }, [fields, handleBridge, saveTurn, session]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const partial = partialRef.current || captured;
      void onPersist(partial || null, paused ? "paused" : speaker === "user" ? "listening" : speaker === "nexmind" ? "speaking" : "reviewing");
    }, 5_000);
    return () => window.clearInterval(timer);
  }, [captured, onPersist, paused, speaker]);

  const togglePause = () => {
    const next = !paused;
    setPaused(next);
    pausedRef.current = next;
    media.current?.getAudioTracks().forEach((track) => { track.enabled = !next && !muted; });
    setSpeaker(next ? "waiting" : "user");
    void onPersist(partialRef.current || null, next ? "paused" : "listening");
    if (next) sendBridge({ type: "commit" });
  };

  const toggleMic = () => {
    const next = !muted;
    setMuted(next);
    mutedRef.current = next;
    media.current?.getAudioTracks().forEach((track) => { track.enabled = !next && !paused; });
    setSpeaker(next ? "waiting" : "user");
    if (next) sendBridge({ type: "commit" });
  };

  const submitText = async () => {
    const text = typed.trim();
    if (!text) { await saveTurn(); await onComplete(); return; }
    userTurn.current = appendText(userTurn.current, text);
    setCaptured(userTurn.current);
    partialRef.current = userTurn.current;
    setTyped("");
    setSpeaker("reviewing");
    await onPersist(text, "understanding");
    sendBridge({ type: "text", text });
  };

  const style = {
    "--audio-low": levels.low,
    "--audio-mid": levels.mid,
    "--audio-high": levels.high,
    "--speech-envelope": levels.pressure,
    "--orb-pressure": levels.pressure,
    "--orb-detail": levels.mid,
    "--orb-onset": levels.high,
    "--orb-flow": levels.low,
  } as CSSProperties;
  const stateLabel = paused ? "Paused" : speaker === "user" ? "Listening" : speaker === "nexmind" ? "NexMind speaking" : "Understanding";

  return <section className={`live-layer open ${reputation ? "reputation-live" : "creation-live"} nexmind-live`} data-speaker={speaker} aria-label={`Native Gemini Live ${reputation ? "Reputation enhancement" : "creative direction"}`} style={style}>
    <div className="live-ambient" />
    <div className="live-stage">
      <header className="live-header"><div className="live-brand"><img src="/nexmarkets-mark.png" alt="" /><div><b>NexMind</b><span>{nativeStatus}</span></div></div><div className="live-state"><i /><span>{stateLabel}</span><time>{clock(elapsed)}</time></div><button className="live-context-trigger" onClick={() => setContextOpen(!contextOpen)} aria-label="Open captured context" aria-expanded={contextOpen}><Icon name={reputation ? "eye" : "file"} size="sm" /></button><button className="close-button" onClick={onClose} aria-label="Leave and save this live session"><Icon name="close" size="sm" /></button></header>
      <main className="live-centre orb-live-centre"><div className="nex-presence" aria-hidden="true"><div className="presence-field"><div className="presence-shadow" /><div className="nex-orb"><i className="orb-surface" /><i className="orb-depth" /><i className="orb-current one" /><i className="orb-current two" /><i className="orb-pulse one" /><i className="orb-pulse two" /><i className="orb-core" /></div></div><div className="voice-legend"><span className="voice-you"><i />You</span><span className="voice-nexmind"><i />Gemini Live</span></div></div><div className="live-copy"><div className="live-progress"><b>{String(Math.min(questions + 1, 5)).padStart(2, "0")}</b><span>/ 05</span><em>{reputation ? "Reputation" : "Direction"}</em></div><span className={`speaker-key ${speaker}`}>{stateLabel}</span><p className="live-transcript">{liveText}</p><small>{error || "Native Gemini Live is streaming microphone audio directly through the server-side bridge. Speak naturally; NexMind will respond with Gemini audio."}</small></div></main>
      <footer className="live-controls"><button className="live-control" onClick={togglePause} aria-label={paused ? "Resume session" : "Pause session"}><Icon name={paused ? "play" : "pause"} /></button><button className="live-control" onClick={toggleMic} aria-label={muted ? "Resume microphone" : "Mute microphone"}><Icon name="mic" /></button><button className="live-control source" onClick={() => setContextOpen(!contextOpen)}><Icon name={reputation ? "eye" : "file"} /><span>{reputation ? "Sources" : "Brief"}</span></button><label className="live-text"><input value={typed} onChange={(event) => setTyped(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void submitText(); }} placeholder="Type to Gemini Live" /><button onClick={() => void submitText()} aria-label="Send typed response"><Icon name="send" size="sm" /></button></label><button className="live-control next" onClick={() => void submitText()}><span>{questions >= 4 ? "Review" : "Continue"}</span><Icon name="arrow" size="sm" /></button></footer>
    </div>
    <aside className={`live-context ${contextOpen ? "open" : ""}`}><header className="structure-head"><h2>Confirmed context</h2><button className="close-button" onClick={() => setContextOpen(false)}><Icon name="close" size="sm" /></button></header><div className="structure-stack">{fields.length ? fields.map((field, index) => <article className={`structure-card ${field.status}`} key={`${field.label}:${index}`}><header><span>{field.label}</span><span>{field.status}</span></header><p>{field.value}</p></article>) : <article className="structure-card open"><header><span>Transcript</span><span>Native live</span></header><p>Gemini Live transcript turns will appear here after NexMind structures the conversation.</p></article>}</div></aside>
  </section>;
}
