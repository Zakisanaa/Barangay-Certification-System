import { useState, useRef, useEffect } from "react";
import { Send } from "lucide-react";
import { publicAsset } from "../publicAsset";

interface Message {
  id: number;
  text: string;
  sender: "user" | "bot";
  timestamp: Date;
}

const knowledgeBase: Record<string, string> = {
  "clearance requirements":
    "Barangay Clearance requirements:\n\n1. Valid government-issued ID (original + photocopy)\n2. Proof of residency (utility bill or lease contract)\n3. Two (2) pieces 2×2 ID photos\n4. Community Tax Certificate (Cedula)\n5. Processing fee: ₱50.00\n\nProcessing time: 1–2 business days.",
  "business permit":
    "Business Permit requirements include:\n\n1. DTI/SEC registration\n2. Lease contract or proof of business location\n3. Valid ID of owner\n4. Completed application form\n5. ₱200.00 fee\n\nProcessing takes 3–5 business days.",
  "certificate of residency":
    "Certificate of Residency requirements:\n\n1. Valid government-issued ID\n2. Proof of residence (utility bill)\n3. One (1) 2×2 ID photo\n4. Processing fee: ₱30.00\n\nProcessing time: 1 business day.",
  "certificate of indigency":
    "Certificate of Indigency requirements:\n\n1. Valid government-issued ID\n2. Proof of residency\n3. Barangay certification from area chairman\n4. No processing fee\n\nProcessing time: 1–2 business days.",
  "appointment reschedule":
    "To reschedule an appointment:\n\n1. Go to your Dashboard tab\n2. Locate your appointment and click VIEW\n3. Contact the barangay office at (02) 8XXX-XXXX\n4. Provide your reference number and preferred new date\n\nReschedules must be made at least 1 business day in advance.",
  "processing time":
    "Average Processing Times:\n\n✓ Certificate of Residency — 1 business day\n✓ Barangay Clearance — 1–2 business days\n✓ Certificate of Indigency — 1–2 business days\n✓ Business Permit Clearance — 3–5 business days\n✓ Good Moral Certificate — 1–2 business days",
  "office hours":
    "Barangay Office Schedule:\n\nMonday to Friday: 8:00 AM – 5:00 PM\nClosed on weekends and public holidays\nLunch break: 12:00 PM – 1:00 PM\n\nBest time to visit: 8:00–11:00 AM to avoid long queues.",
  "fees":
    "Fees and payment methods can change and have not been confirmed in this demo. Please verify the current amount with the Barangay Hall before making a payment.",
};

const quickTopics = [
  "Clearance Requirements",
  "Business Permit",
  "Certificate of Residency",
  "Certificate of Indigency",
  "Appointment Reschedule",
  "Processing Time",
  "Office Hours",
  "Fees & Charges",
];

function AssistantAvatar({ small = false }: { small?: boolean }) {
  return (
    <img
      src={publicAsset("banoy-chatbot.png")}
      alt="Banoy, the Barangay Lagasit chatbot mascot"
      className={`${small ? "h-7 w-7" : "h-9 w-9"} rounded-full object-cover`}
      style={{ objectPosition: "8% center" }}
    />
  );
}

function getBotResponse(query: string): string {
  const lower = query.toLowerCase();
  for (const [key, answer] of Object.entries(knowledgeBase)) {
    if (lower.includes(key)) return answer;
  }
  if (lower.includes("require") || lower.includes("document") || lower.includes("need"))
    return knowledgeBase["clearance requirements"];
  if (lower.includes("hour") || lower.includes("open") || lower.includes("schedule"))
    return knowledgeBase["office hours"];
  if (lower.includes("fee") || lower.includes("cost") || lower.includes("charge"))
    return knowledgeBase["fees"];
  if (lower.includes("process") || lower.includes("how long") || lower.includes("wait"))
    return knowledgeBase["processing time"];
  if (lower.includes("reschedul") || lower.includes("cancel"))
    return knowledgeBase["appointment reschedule"];
  return "I'm not sure about that. I can help with:\n\n• Certificate requirements\n• Office hours & schedules\n• Processing times & fees\n• Appointment rescheduling\n\nPlease rephrase your question or tap a topic from the quick questions panel.";
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      text: "Hello! I'm LagaBot, Barangay Lagasit's FAQ assistant. I can help with common questions using the information available in this FAQ. How can I help you today?",
      sender: "bot",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const sendMessage = (text: string) => {
    if (!text.trim()) return;
    const userMsg: Message = { id: Date.now(), text: text.trim(), sender: "user", timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        { id: Date.now() + 1, text: getBotResponse(text), sender: "bot", timestamp: new Date() },
      ]);
      setIsTyping(false);
    }, 750);
  };

  const fmt = (d: Date) => d.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="flex h-screen bg-[#edf1ee]" style={{ fontFamily: "'Segoe UI', 'Arial', sans-serif" }}>

      {/* ── Quick Questions Panel ──────────────────────────── */}
      <div
        className="flex flex-col flex-shrink-0 bg-white"
        style={{ width: 220, borderRight: "1px solid #c9d1ca" }}
      >
        <div className="px-5 py-4" style={{ borderBottom: "1px solid #c4c0b9" }}>
          <div className="mb-2 text-[10px] font-bold tracking-[0.18em] text-[#51635d] uppercase">Quick Questions</div>
          <p className="text-[10px] leading-relaxed text-[#53645b]">
            Tap a topic for a quick answer from the Barangay FAQ.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {quickTopics.map((topic) => (
            <button
              key={topic}
              onClick={() => sendMessage(topic)}
              className="w-full flex justify-between items-center px-5 py-3 text-left text-[11px] font-bold transition-colors"
              style={{ borderBottom: "1px solid #e8e5e0", color: "#0f0e0c" }}
              onMouseEnter={e => (e.currentTarget.style.background = "#faf9f7")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              <span>{topic}</span>
              <span className="text-xs ml-1" style={{ color: "#c4c0b9" }}>›</span>
            </button>
          ))}
        </div>

        <div className="px-5 py-4" style={{ borderTop: "1px solid #c4c0b9", background: "#f5f3f0" }}>
          <div className="mb-1.5 text-[9px] font-bold tracking-[0.15em] text-[#51635d] uppercase">LagaBot · FAQ assistant</div>
          <p className="text-[9px] leading-relaxed text-[#53645b]">
            This demo matches questions to a fixed FAQ; it is not connected to an AI service. Confirm requirements and fees with the Barangay Hall.
          </p>
        </div>
      </div>

      {/* ── Chat Panel ────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 bg-white"
          style={{ borderBottom: "1px solid #c4c0b9" }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 flex items-center justify-center text-sm flex-shrink-0"
              style={{ background: "#f5f3f0", border: "1px solid #c4c0b9" }}
            >
              <AssistantAvatar />
            </div>
            <div>
              <div className="text-[11px] font-bold tracking-[0.12em] text-[#122d1f] uppercase">LagaBot</div>
              <div className="mt-0.5 text-[10px] text-[#53645b]">
                FAQ answers — available in this browser
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-black" />
            <span className="text-[9px] font-bold tracking-[0.14em]">ONLINE</span>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.sender === "bot" && (
                <div
                  className="w-8 h-8 flex items-center justify-center text-sm flex-shrink-0 mt-0.5"
                  style={{ background: "#f5f3f0", border: "1px solid #c4c0b9" }}
                >
                  <AssistantAvatar small />
                </div>
              )}
              <div className={`flex flex-col max-w-[68%] ${msg.sender === "user" ? "items-end" : "items-start"}`}>
                <div
                  className="px-5 py-3.5 text-[11px] leading-relaxed whitespace-pre-line"
                  style={
                    msg.sender === "bot"
                      ? { background: "#fff", border: "1px solid #c4c0b9", color: "#0f0e0c" }
                      : { background: "#eae7e2", border: "1px solid #c4c0b9", color: "#0f0e0c" }
                  }
                >
                  {msg.text}
                </div>
                <div
                  className="text-[9px] font-bold tracking-[0.08em] mt-1.5"
                  style={{ color: "#9e9b96" }}
                >
                  {msg.sender === "bot" ? "LAGABOT" : "YOU"} · {fmt(msg.timestamp)}
                </div>
              </div>
              {msg.sender === "user" && (
                <div
                  className="w-8 h-8 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5"
                  style={{ background: "#0f0e0c", color: "#fff" }}
                >
                  U
                </div>
              )}
            </div>
          ))}

          {isTyping && (
            <div className="flex gap-3">
              <div
                className="w-8 h-8 flex items-center justify-center text-sm flex-shrink-0"
                style={{ background: "#f5f3f0", border: "1px solid #c4c0b9" }}
              >
                <AssistantAvatar small />
              </div>
              <div
                className="px-5 py-3.5"
                style={{ background: "#fff", border: "1px solid #c4c0b9" }}
              >
                <div className="flex gap-1.5 items-center h-4">
                  {[0, 120, 240].map((d) => (
                    <div
                      key={d}
                      className="w-1.5 h-1.5 rounded-full animate-bounce"
                      style={{ background: "#9e9b96", animationDelay: `${d}ms` }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div
          className="px-8 py-5 bg-white"
          style={{ borderTop: "1px solid #c4c0b9" }}
        >
          <form
            onSubmit={(e) => { e.preventDefault(); sendMessage(input); }}
            className="flex gap-0"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your question here..."
              className="flex-1 px-5 py-3 text-[11px] outline-none transition-colors"
              style={{
                fontFamily: "'Space Mono', monospace",
                border: "1.5px solid #c4c0b9",
                borderRight: "none",
                background: "#fff",
              }}
              onFocus={e => (e.currentTarget.style.borderColor = "#0f0e0c")}
              onBlur={e => (e.currentTarget.style.borderColor = "#c4c0b9")}
            />
            <button
              type="submit"
              disabled={!input.trim()}
              className="flex items-center gap-2 px-5 py-3 text-[10px] font-bold tracking-[0.12em] text-white transition-opacity disabled:opacity-40"
              style={{ background: "#0f0e0c", fontFamily: "'Space Mono', monospace" }}
            >
              <Send className="w-3.5 h-3.5" />
              SEND
            </button>
          </form>
          <p className="text-[9px] mt-2.5 tracking-[0.06em]" style={{ color: "#bf6318" }}>
            FAQ answers are informational and may be incomplete. Confirm official requirements and fees with the Barangay Hall.
          </p>
        </div>
      </div>
    </div>
  );
}
