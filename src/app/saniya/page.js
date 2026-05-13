"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Mic, MicOff, Send, Sparkles, Volume2, VolumeX, Trash2, Bot, Radio } from "lucide-react";

const WAKE_PHRASES = ["hi saniya", "hii saniya", "hey saniya", "hello saniya"];
const fmtTime = (d) => new Date(d).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

// ─── TTS: called after user gesture so voices are guaranteed loaded ───
function speak(text, enabled) {
  if (!enabled || typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text.replace(/[*_#•\[\]]/g, "").slice(0, 450));
  // en-IN works more reliably than hi-IN on most devices
  u.lang  = "en-IN";
  u.rate  = 1.0;
  u.pitch = 1.1;
  const voices = window.speechSynthesis.getVoices();
  u.voice = voices.find((v) => v.lang === "en-IN")
         || voices.find((v) => v.lang === "hi-IN")
         || voices.find((v) => v.lang.startsWith("en"))
         || voices[0];
  window.speechSynthesis.speak(u);
}

export default function SaniyaPage() {
  const [messages, setMessages]   = useState([]);
  const [input, setInput]         = useState("");
  const [loading, setLoading]     = useState(false);
  const [ttsOn, setTtsOn]         = useState(true);
  const [phase, setPhase]         = useState("idle"); // idle | wake | listening
  const [liveText, setLiveText]   = useState("");
  const [status, setStatus]       = useState("Type below or tap the mic");

  // ── Refs (never stale inside callbacks) ──────────────────────────
  const chatRef      = useRef(null);
  const historyRef   = useRef([]);
  const phaseRef     = useRef("idle");
  const ttsRef       = useRef(true);
  const loadingRef   = useRef(false);
  const recogRef     = useRef(null);   // current SR instance
  // sendMessage needs to be a ref so wake-word onresult never closes over stale state
  const sendRef      = useRef(null);

  const setPhaseSync = (v) => { phaseRef.current = v; setPhase(v); };

  useEffect(() => { ttsRef.current = ttsOn; }, [ttsOn]);
  useEffect(() => { loadingRef.current = loading; }, [loading]);
  useEffect(() => {
    historyRef.current = messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .slice(-6)
      .map((m) => ({ role: m.role, content: m.content }));
  }, [messages]);
  useEffect(() => { chatRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, liveText]);

  // ── Greeting ──────────────────────────────────────────────────────
  useEffect(() => {
    setMessages([{
      id: 1, role: "assistant", time: new Date(),
      content: "Hii! Main Saniya hoon — Ryan Clinic ki AI assistant 👋\n\nAap mujhse puchh sakte ho:\n• Patients, revenue, transactions\n• Agent / counsellor performance\n• Leads, stock, team info\n\nType karo ya mic tap karo!",
    }]);
  }, []);

  // ── Kill any running recognition ──────────────────────────────────
  const killRecog = useCallback(() => {
    if (recogRef.current) {
      try { recogRef.current.abort(); } catch {}
      recogRef.current = null;
    }
    setPhaseSync("idle");
    setLiveText("");
    setStatus("Type below or tap the mic");
  }, []);

  // ── Send to API ───────────────────────────────────────────────────
  const sendMessage = useCallback(async (text) => {
    const q = (typeof text === "string" ? text : input).trim();
    if (!q || loadingRef.current) return;

    setInput("");
    setLiveText("");
    setLoading(true);
    loadingRef.current = true;
    setStatus("Saniya soch rahi hai...");

    setMessages((p) => [...p, { id: Date.now(), role: "user", content: q, time: new Date() }]);

    try {
      const res  = await fetch("/api/saniya", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, history: historyRef.current }),
      });
      const { answer = "Dobara puchho." } = await res.json();
      setMessages((p) => [...p, { id: Date.now() + 1, role: "assistant", content: answer, time: new Date() }]);
      speak(answer, ttsRef.current);
    } catch {
      setMessages((p) => [...p, { id: Date.now() + 1, role: "assistant", content: "Network error. Please try again.", time: new Date() }]);
    } finally {
      setLoading(false);
      loadingRef.current = false;
      setStatus("Type below or tap the mic");
    }
  }, [input]); // input needed only for text box path

  // Keep sendRef always pointing to latest sendMessage
  useEffect(() => { sendRef.current = sendMessage; }, [sendMessage]);

  // ── Build a SpeechRecognition instance ────────────────────────────
  const makeSR = useCallback((opts = {}) => {
    const SR = typeof window !== "undefined"
      && (window.SpeechRecognition || window.webkitSpeechRecognition);
    if (!SR) return null;
    const r = new SR();
    // en-IN catches Hinglish far better than hi-IN in Chrome
    r.lang            = "en-IN";
    r.continuous      = opts.continuous || false;
    r.interimResults  = true;
    r.maxAlternatives = 1;
    return r;
  }, []);

  // ── ACTIVE listening (single-shot, auto-sends on silence) ─────────
  const startListening = useCallback(() => {
    killRecog();
    const r = makeSR();
    if (!r) { alert("Voice not supported. Use Chrome or Edge."); return; }

    let final = "";
    recogRef.current = r;

    r.onstart = () => { setPhaseSync("listening"); setStatus("Sun rahi hoon... bolo 🎤"); };

    r.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript + " ";
        else interim += e.results[i][0].transcript;
      }
      setLiveText((final + interim).trim());
    };

    r.onend = () => {
      recogRef.current = null;
      setPhaseSync("idle");
      setLiveText("");
      setStatus("Type below or tap the mic");
      const captured = final.trim();
      if (captured) sendRef.current(captured);
    };

    r.onerror = (e) => {
      recogRef.current = null;
      setPhaseSync("idle");
      setLiveText("");
      if (e.error === "no-speech")    setStatus("Awaaz nahi aayi. Dobara try karo.");
      else if (e.error === "not-allowed") setStatus("⚠️ Mic permission denied. Browser settings check karo.");
      else setStatus(`Voice error: ${e.error}`);
      setTimeout(() => setStatus("Type below or tap the mic"), 3500);
    };

    try { r.start(); } catch { killRecog(); }
  }, [killRecog, makeSR]);

  // ── WAKE WORD mode (continuous, restarts itself) ──────────────────
  const startWakeMode = useCallback(() => {
    killRecog();

    const build = () => {
      const r = makeSR({ continuous: true });
      if (!r) return;
      recogRef.current = r;

      r.onstart = () => {
        // Only update status if we're still in wake phase
        if (phaseRef.current === "wake") setStatus('🟠 Boliye "Hii Saniya"...');
      };

      r.onresult = (e) => {
        const text = Array.from(e.results)
          .map((res) => res[0].transcript).join(" ").toLowerCase();
        const hit = WAKE_PHRASES.some((p) => text.includes(p));
        if (hit) {
          try { r.abort(); } catch {}
          recogRef.current = null;
          setStatus("Wake word mila! Ab bolo...");
          setTimeout(() => { if (phaseRef.current === "wake") startListening(); }, 700);
        }
      };

      // Chrome kills continuous after ~60s silence — rebuild silently
      r.onend = () => {
        if (phaseRef.current !== "wake") return; // manually stopped
        recogRef.current = null;
        setTimeout(() => { if (phaseRef.current === "wake") build(); }, 300);
      };

      r.onerror = (e) => {
        if (e.error === "no-speech") return; // expected — ignore
        if (e.error === "not-allowed") {
          setStatus("⚠️ Mic permission denied."); killRecog(); return;
        }
        // Restart on other errors too
        recogRef.current = null;
        setTimeout(() => { if (phaseRef.current === "wake") build(); }, 500);
      };

      try { r.start(); } catch { killRecog(); }
    };

    setPhaseSync("wake");
    build();
  }, [killRecog, makeSR, startListening]);

  // ── Mic button click handler ──────────────────────────────────────
  const onMicClick = useCallback(() => {
    if (phaseRef.current === "listening") {
      // Stop → triggers onend → sends captured text
      if (recogRef.current) { try { recogRef.current.stop(); } catch {} }
    } else if (phaseRef.current === "wake") {
      killRecog();
    } else {
      startListening();
    }
  }, [killRecog, startListening]);

  // Cleanup
  useEffect(() => () => {
    killRecog();
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
  }, [killRecog]);

  const isListening = phase === "listening";
  const isWake      = phase === "wake";

  const quickPrompts = [
    "Aaj kitne patients?",
    "Kal sabse zyada sale kis agent ki?",
    "Is month revenue?",
    "Recent leads",
    "Stock alert?",
    "Branch wise patients",
  ];

  return (
    <div className="flex flex-col h-screen bg-[#fff5ec] overflow-hidden">

      {/* Header */}
      <div className="bg-[#D32F2F] text-white px-5 py-3 flex items-center justify-between shadow-lg shrink-0">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center ring-2 ring-white/30">
              <Bot className="w-5 h-5" />
            </div>
            {(isListening || isWake) && (
              <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#D32F2F] animate-pulse"
                style={{ background: isListening ? "#22c55e" : "#f59e0b" }} />
            )}
          </div>
          <div>
            <h1 className="text-lg font-bold leading-none">Saniya</h1>
            <p className="text-[11px] text-red-200 mt-0.5">Ryan Clinic · AI Assistant</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setTtsOn(!ttsOn); window.speechSynthesis?.cancel(); }}
            className="p-2 rounded-full bg-white/10 hover:bg-white/25 transition">
            {ttsOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
          <button onClick={() => { setMessages([]); historyRef.current = []; }}
            className="p-2 rounded-full bg-white/10 hover:bg-white/25 transition">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Status bar */}
      <div className={`py-1.5 text-xs font-medium text-center flex items-center justify-center gap-1.5 shrink-0 transition-colors ${
        isListening ? "bg-green-50 text-green-700" :
        isWake      ? "bg-amber-50 text-amber-600" :
        loading     ? "bg-blue-50 text-blue-600"   :
                      "bg-white/60 text-gray-400"
      }`}>
        {(isListening || isWake || loading) && (
          <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${
            isListening ? "bg-green-500" : isWake ? "bg-amber-500" : "bg-blue-500"
          }`} />
        )}
        {status}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="max-w-2xl mx-auto space-y-4">

          {messages.map((m) => (
            <div key={m.id} className={`flex gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              {m.role === "assistant" && (
                <div className="w-8 h-8 rounded-full bg-[#D32F2F] flex items-center justify-center shrink-0 mt-1 shadow">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
              )}
              <div className={`flex flex-col max-w-[82%] ${m.role === "user" ? "items-end" : "items-start"}`}>
                <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap shadow-sm ${
                  m.role === "user"
                    ? "bg-[#D32F2F] text-white rounded-tr-sm"
                    : "bg-white text-gray-800 rounded-tl-sm border border-red-100"
                }`}>
                  {m.content}
                </div>
                <span className="text-[10px] text-gray-400 mt-1 px-1">{fmtTime(m.time)}</span>
              </div>
            </div>
          ))}

          {/* Live transcript bubble */}
          {liveText && (
            <div className="flex justify-end">
              <div className="bg-green-100 text-green-800 px-4 py-2 rounded-2xl rounded-tr-sm text-sm italic max-w-[82%] flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse shrink-0" />
                {liveText}
              </div>
            </div>
          )}

          {/* Loading dots */}
          {loading && (
            <div className="flex gap-2">
              <div className="w-8 h-8 rounded-full bg-[#D32F2F] flex items-center justify-center shrink-0 shadow">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div className="bg-white px-4 py-3 rounded-2xl rounded-tl-sm border border-red-100 shadow-sm flex gap-1 items-center">
                {[0,150,300].map((d) => (
                  <span key={d} className="w-2 h-2 rounded-full bg-[#D32F2F] animate-bounce" style={{ animationDelay:`${d}ms` }} />
                ))}
              </div>
            </div>
          )}

          <div ref={chatRef} />
        </div>
      </div>

      {/* Quick prompts */}
      <div className="px-4 pb-2 shrink-0">
        <div className="max-w-2xl mx-auto flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {quickPrompts.map((p) => (
            <button key={p} onClick={() => sendMessage(p)} disabled={loading}
              className="shrink-0 text-xs px-3 py-1.5 rounded-full bg-white border border-red-200 text-[#D32F2F] hover:bg-red-50 transition disabled:opacity-40 whitespace-nowrap">
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Input bar */}
      <div className="bg-white border-t border-red-100 px-4 pt-3 pb-5 shrink-0 shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
        <div className="max-w-2xl mx-auto space-y-2.5">

          {/* Wake word toggle */}
          <div className="flex justify-center">
            <button onClick={isWake ? killRecog : startWakeMode}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium border transition-all ${
                isWake
                  ? "bg-amber-100 text-amber-700 border-amber-300"
                  : "bg-red-50 text-[#D32F2F] border-red-200 hover:bg-red-100"
              }`}>
              <Radio className={`w-3.5 h-3.5 ${isWake ? "animate-pulse" : ""}`} />
              {isWake ? 'Listening for "Hii Saniya" — tap to stop' : 'Enable Wake Word'}
            </button>
          </div>

          {/* Text + Mic + Send */}
          <div className="flex gap-2 items-end">
            <textarea rows={1} value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }}}
              placeholder="Kuch bhi puchho... (Enter to send)"
              className="flex-1 resize-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm focus:outline-none focus:border-[#D32F2F] transition"
            />

            {/* Mic — click to start, click again to stop & send */}
            <button onClick={onMicClick} disabled={loading}
              title={isListening ? "Tap to stop & send" : "Tap to speak"}
              className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-all ${
                isListening
                  ? "bg-green-500 text-white shadow-lg shadow-green-200 scale-110"
                  : isWake
                  ? "bg-amber-400 text-white"
                  : "bg-red-50 text-[#D32F2F] border border-red-200 hover:bg-[#D32F2F] hover:text-white"
              } disabled:opacity-40`}>
              {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>

            <button onClick={() => sendMessage()} disabled={!input.trim() || loading}
              className="w-11 h-11 rounded-xl bg-[#D32F2F] text-white flex items-center justify-center hover:bg-red-700 disabled:opacity-40 transition shrink-0">
              <Send className="w-5 h-5" />
            </button>
          </div>

          <p className="text-center text-[10px] text-gray-400">
            🎤 Tap mic → speak → tap again to send &nbsp;|&nbsp; Or enable wake word above
          </p>
        </div>
      </div>
    </div>
  );
}