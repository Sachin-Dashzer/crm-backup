"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Mic, MicOff, Send, Sparkles, Volume2, VolumeX, Trash2, Bot } from "lucide-react";

function formatTime(date) {
  return new Date(date).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

const WAKE_PHRASES = ["hi saniya", "hii saniya", "hey saniya", "hello saniya", "saniya"];

export default function SaniyaPage() {
  const [messages, setMessages]     = useState([]);
  const [input, setInput]           = useState("");
  const [loading, setLoading]       = useState(false);
  const [listening, setListening]   = useState(false);
  const [wakeMode, setWakeMode]     = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [transcript, setTranscript] = useState("");
  const [statusMsg, setStatusMsg]   = useState('Say "Hii Saniya" or type below');

  const chatEndRef  = useRef(null);
  const recognRef   = useRef(null);
  const wakeRef     = useRef(null);
  const historyRef  = useRef([]);

  // Keep Claude history in sync
  useEffect(() => {
    historyRef.current = messages
      .filter((m) => m.role !== "system")
      .slice(-6)
      .map((m) => ({ role: m.role, content: m.content }));
  }, [messages]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, transcript]);

  // ── Greeting ─────────────────────────────────────────────────
  useEffect(() => {
    const g = {
      id: Date.now(),
      role: "assistant",
      content: "Hii! Main Saniya hoon — Ryan Clinic ki AI assistant. 👋\n\nAap mujhse kuch bhi puchh sakte ho:\n• Patients, revenue, transactions\n• Leads (Google/Meta/Form)\n• Stock aur team info\n• Branch-wise performance\n\nBolo, kya jaanna hai?",
      time: new Date(),
    };
    setMessages([g]);
    if (typeof window !== "undefined" && window.speechSynthesis) speak(g.content);
  }, []); // eslint-disable-line

  // ── TTS ───────────────────────────────────────────────────────
  const speak = useCallback((text) => {
    if (typeof window === "undefined" || !window.speechSynthesis || !ttsEnabled) return;
    window.speechSynthesis.cancel();
    const clean = text.replace(/[•\*\_\#]/g, "").slice(0, 400); // trim long responses
    const utter = new SpeechSynthesisUtterance(clean);
    utter.lang  = "hi-IN";
    utter.rate  = 1.05;
    utter.pitch = 1.1;
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(
      (v) => (v.lang.startsWith("hi") || v.lang.startsWith("en-IN")) && v.name.toLowerCase().includes("female")
    ) || voices.find((v) => v.lang.startsWith("hi"));
    if (preferred) utter.voice = preferred;
    window.speechSynthesis.speak(utter);
  }, [ttsEnabled]);

  // ── Send to API ───────────────────────────────────────────────
  const sendMessage = useCallback(async (text) => {
    const question = (text ?? input).trim();
    if (!question || loading) return;
    setInput("");
    setTranscript("");
    setLoading(true);
    setStatusMsg("Saniya soch rahi hai...");

    const userMsg = { id: Date.now(), role: "user", content: question, time: new Date() };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const res  = await fetch("/api/saniya", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, history: historyRef.current }),
      });
      const data = await res.json();
      const answer = data.answer || "Kuch samajh nahi aaya, dobara puchho.";
      const aiMsg  = { id: Date.now() + 1, role: "assistant", content: answer, time: new Date() };
      setMessages((prev) => [...prev, aiMsg]);
      if (ttsEnabled) speak(answer);
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: Date.now() + 1, role: "assistant", content: "Network error. Please try again.", time: new Date() },
      ]);
    } finally {
      setLoading(false);
      setStatusMsg('Say "Hii Saniya" or type below');
    }
  }, [input, loading, ttsEnabled, speak]);

  // ── Active Voice Capture ──────────────────────────────────────
  const startListening = useCallback(() => {
    if (typeof window === "undefined") return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert("Voice not supported. Use Chrome."); return; }

    const recog = new SR();
    recog.lang           = "hi-IN";
    recog.continuous     = false;
    recog.interimResults = true;

    let finalText = "";

    recog.onstart  = () => { setListening(true); setStatusMsg("Sun rahi hoon... bolo"); };
    recog.onresult = (e) => {
      const t = Array.from(e.results).map((r) => r[0].transcript).join("");
      setTranscript(t);
      if (e.results[e.results.length - 1].isFinal) finalText = t;
    };
    recog.onend = () => {
      setListening(false);
      setStatusMsg('Say "Hii Saniya" or type below');
      if (finalText.trim()) sendMessage(finalText.trim());
    };
    recog.onerror = () => { setListening(false); setStatusMsg("Voice error. Try again."); };

    recognRef.current = recog;
    recog.start();
  }, [sendMessage]);

  const stopListening = useCallback(() => {
    recognRef.current?.stop();
    setListening(false);
  }, []);

  // ── Wake Word Listener ────────────────────────────────────────
  const startWakeMode = useCallback(() => {
    if (typeof window === "undefined") return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;

    const wake = new SR();
    wake.lang           = "hi-IN";
    wake.continuous     = true;
    wake.interimResults = true;

    wake.onresult = (e) => {
      const t = Array.from(e.results).map((r) => r[0].transcript).join("").toLowerCase();
      if (WAKE_PHRASES.some((p) => t.includes(p))) {
        wake.stop();
        wakeRef._active = false;
        setWakeMode(false);
        setStatusMsg("Wake word detected! Bolo...");
        setTimeout(() => startListening(), 500);
      }
    };
    wake.onend = () => {
      if (wakeRef._active) { try { wake.start(); } catch {} }
    };

    wakeRef._active = true;
    wakeRef.current = wake;
    try { wake.start(); setWakeMode(true); setStatusMsg('Listening for "Hii Saniya"...'); }
    catch (e) { console.error(e); }
  }, [startListening]);

  const stopWakeMode = useCallback(() => {
    wakeRef._active = false;
    wakeRef.current?.stop();
    setWakeMode(false);
    setStatusMsg('Say "Hii Saniya" or type below');
  }, []);

  useEffect(() => {
    return () => {
      wakeRef._active = false;
      wakeRef.current?.stop();
      recognRef.current?.stop();
      if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    };
  }, []);

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen bg-[#fff5ec] overflow-hidden">

      {/* Header */}
      <div className="bg-[#D32F2F] text-white px-5 py-3.5 flex items-center justify-between shadow-lg flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center ring-2 ring-white/30">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-wide leading-none">Saniya</h1>
            <p className="text-xs text-red-200 mt-0.5">Ryan Clinic · AI Assistant · Superadmin</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setTtsEnabled(!ttsEnabled); if (typeof window !== "undefined") window.speechSynthesis?.cancel(); }}
            className="p-2 rounded-full bg-white/10 hover:bg-white/25 transition"
            title={ttsEnabled ? "Mute voice" : "Enable voice"}
          >
            {ttsEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
          <button
            onClick={() => { setMessages([]); historyRef.current = []; }}
            className="p-2 rounded-full bg-white/10 hover:bg-white/25 transition"
            title="Clear chat"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Status Bar */}
      <div className={`text-center py-1.5 text-xs font-medium flex-shrink-0 transition-colors ${
        listening ? "bg-green-100 text-green-700" :
        wakeMode  ? "bg-amber-50 text-amber-600" :
        loading   ? "bg-blue-50 text-blue-600" :
                    "bg-white/70 text-gray-400"
      }`}>
        {(listening || wakeMode || loading) && (
          <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 animate-pulse ${
            listening ? "bg-green-500" : wakeMode ? "bg-amber-400" : "bg-blue-500"
          }`} />
        )}
        {statusMsg}
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <div className="max-w-2xl mx-auto space-y-4">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} gap-2`}>
              {msg.role === "assistant" && (
                <div className="w-8 h-8 rounded-full bg-[#D32F2F] flex items-center justify-center flex-shrink-0 mt-1 shadow">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
              )}
              <div className={`flex flex-col max-w-[80%] ${msg.role === "user" ? "items-end" : "items-start"}`}>
                <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap shadow-sm ${
                  msg.role === "user"
                    ? "bg-[#D32F2F] text-white rounded-tr-sm"
                    : "bg-white text-gray-800 rounded-tl-sm border border-red-100"
                }`}>
                  {msg.content}
                </div>
                <span className="text-[10px] text-gray-400 mt-1 px-1">{formatTime(msg.time)}</span>
              </div>
            </div>
          ))}

          {/* Interim transcript */}
          {transcript && (
            <div className="flex justify-end">
              <div className="bg-red-100 text-red-600 px-4 py-2 rounded-2xl rounded-tr-sm text-sm italic max-w-[80%]">
                🎤 {transcript}
              </div>
            </div>
          )}

          {/* Loading dots */}
          {loading && (
            <div className="flex justify-start gap-2">
              <div className="w-8 h-8 rounded-full bg-[#D32F2F] flex items-center justify-center flex-shrink-0 shadow">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div className="bg-white px-4 py-3 rounded-2xl rounded-tl-sm shadow-sm border border-red-100">
                <div className="flex gap-1 items-center">
                  {[0, 150, 300].map((delay) => (
                    <span
                      key={delay}
                      className="w-2 h-2 bg-[#D32F2F] rounded-full animate-bounce"
                      style={{ animationDelay: `${delay}ms` }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>
      </div>

      {/* Quick prompts */}
      <div className="px-4 pb-2 flex-shrink-0">
        <div className="max-w-2xl mx-auto flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {[
            "Aaj kitne patients aaye?",
            "Is month revenue kya hai?",
            "Recent leads dikhao",
            "Stock alert?",
            "Branch wise patients",
          ].map((prompt) => (
            <button
              key={prompt}
              onClick={() => sendMessage(prompt)}
              disabled={loading}
              className="flex-shrink-0 text-xs px-3 py-1.5 rounded-full bg-white border border-red-200 text-[#D32F2F] hover:bg-red-50 transition disabled:opacity-40"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      {/* Input Bar */}
      <div className="bg-white border-t border-red-100 px-4 pt-3 pb-4 flex-shrink-0 shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
        <div className="max-w-2xl mx-auto">
          {/* Wake word toggle */}
          <div className="flex justify-center mb-2.5">
            <button
              onClick={wakeMode ? stopWakeMode : startWakeMode}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
                wakeMode
                  ? "bg-amber-100 text-amber-700 border border-amber-300"
                  : "bg-red-50 text-[#D32F2F] border border-red-200 hover:bg-red-100"
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${wakeMode ? "bg-amber-500 animate-pulse" : "bg-red-300"}`} />
              {wakeMode ? 'Active — listening for "Hii Saniya"' : 'Enable Wake Word ("Hii Saniya")'}
            </button>
          </div>

          {/* Text + voice input */}
          <div className="flex gap-2 items-end">
            <textarea
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder="Kuch bhi puchho... (e.g. Delhi branch ka revenue?)"
              className="flex-1 resize-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm focus:outline-none focus:border-[#D32F2F] transition"
            />
            <button
              onPointerDown={startListening}
              onPointerUp={stopListening}
              onPointerLeave={stopListening}
              disabled={loading}
              className={`p-2.5 rounded-xl transition-all flex-shrink-0 ${
                listening
                  ? "bg-green-500 text-white scale-110 shadow-lg"
                  : "bg-red-50 text-[#D32F2F] border border-red-200 hover:bg-[#D32F2F] hover:text-white"
              }`}
              title="Hold to speak"
            >
              {listening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || loading}
              className="p-2.5 rounded-xl bg-[#D32F2F] text-white hover:bg-red-700 disabled:opacity-40 transition flex-shrink-0"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
          <p className="text-center text-[10px] text-gray-400 mt-2">
            Hold mic to speak • Enter to send • "Hii Saniya" to activate voice
          </p>
        </div>
      </div>
    </div>
  );
}