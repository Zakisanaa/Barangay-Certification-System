import { useState, useRef, useEffect } from "react";
import { Send } from "lucide-react";
import { publicAsset } from "../publicAsset";
import { getServiceConfiguration } from "../serviceData";
import { getServiceFaq } from "../serviceFaq";

interface Message {
  id: number;
  text: string;
  sender: "user" | "bot";
  timestamp: Date;
}

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

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      text: "Hello! I'm Banoy, Barangay Lagasit's FAQ assistant. I can help with common questions using the information available in this FAQ. How can I help you today?",
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

  const sendMessage = async (text: string) => {
    if (!text.trim() || isTyping) return;
    const userMsg: Message = { id: Date.now(), text: text.trim(), sender: "user", timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);
    try {
      const configuration = await getServiceConfiguration();
      setMessages((prev) => [
        ...prev,
        { id: Date.now() + 1, text: getServiceFaq(text, configuration), sender: "bot", timestamp: new Date() },
      ]);
    } catch {
      setMessages(previous => [...previous, { id: Date.now() + 1, text: "I could not load the current service information. Please try again or send a message to staff in your request conversation.", sender: "bot", timestamp: new Date() }]);
    } finally {
      setIsTyping(false);
    }
  };

  const fmt = (d: Date) => d.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#edf1ee] md:flex-row" style={{ fontFamily: "'Segoe UI', 'Arial', sans-serif" }}>

      {/* ── Quick Questions Panel ──────────────────────────── */}
      <div
        className="flex w-full shrink-0 flex-col bg-white md:w-[220px]"
        style={{ borderBottom: "1px solid #c9d1ca", borderRight: "1px solid #c9d1ca" }}
      >
        <div className="px-4 py-3 md:px-5 md:py-4" style={{ borderBottom: "1px solid #c4c0b9" }}>
          <div className="mb-1 text-[10px] font-bold tracking-[0.18em] text-[#51635d] uppercase md:mb-2">Quick Questions</div>
          <p className="hidden text-[10px] leading-relaxed text-[#53645b] md:block">
            Tap a topic for a quick answer from the Barangay FAQ.
          </p>
        </div>

        <div
          aria-label="Frequently asked questions"
          className="flex gap-2 overflow-x-auto px-4 py-2 md:flex-1 md:flex-col md:gap-0 md:overflow-x-hidden md:overflow-y-auto md:px-0 md:py-0"
        >
          {quickTopics.map((topic) => (
            <button
              key={topic}
              disabled={isTyping}
              onClick={() => void sendMessage(topic)}
              className="flex min-h-10 w-max shrink-0 items-center justify-between gap-2 whitespace-nowrap rounded-full border border-[#e8e5e0] bg-white px-3 text-left text-xs font-bold transition-colors md:min-h-11 md:w-full md:rounded-none md:border-0 md:border-b md:px-5 md:py-3 md:text-[11px] md:whitespace-normal"
              style={{ borderBottomColor: "#e8e5e0", color: "#0f0e0c" }}
              onMouseEnter={e => (e.currentTarget.style.background = "#faf9f7")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              <span>{topic}</span>
              <span className="text-xs ml-1" style={{ color: "#c4c0b9" }}>›</span>
            </button>
          ))}
        </div>

        <div className="hidden px-5 py-4 md:block" style={{ borderTop: "1px solid #c4c0b9", background: "#f5f3f0" }}>
          <div className="mb-1.5 text-[9px] font-bold tracking-[0.15em] text-[#51635d] uppercase">Banoy · FAQ assistant</div>
          <p className="text-[9px] leading-relaxed text-[#53645b]">
            Answers use service information maintained by barangay staff. Unconfirmed requirements and fees are identified in the response.
          </p>
        </div>
      </div>

      {/* ── Chat Panel ────────────────────────────────────── */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">

        {/* Header */}
        <div
          className="flex items-center justify-between gap-3 bg-white px-4 py-3 sm:px-6 sm:py-4"
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
              <div className="text-[11px] font-bold tracking-[0.12em] text-[#122d1f] uppercase">Banoy</div>
              <div className="mt-0.5 text-[10px] text-[#53645b]">
                Service information maintained by staff
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-black" />
            <span className="text-[9px] font-bold tracking-[0.14em]">ONLINE</span>
          </div>
        </div>

        {/* Messages */}
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4 sm:space-y-6 sm:px-8 sm:py-6">
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
              <div className={`flex max-w-[85%] flex-col sm:max-w-[68%] ${msg.sender === "user" ? "items-end" : "items-start"}`}>
                <div
                  className="whitespace-pre-line break-words px-3 py-3 text-sm leading-relaxed sm:px-5 sm:py-3.5 sm:text-xs"
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
                  {msg.sender === "bot" ? "BANOY" : "YOU"} · {fmt(msg.timestamp)}
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
          className="bg-white px-4 py-3 sm:px-8 sm:py-5"
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
              className="min-w-0 flex-1 px-3 py-3 text-base outline-none transition-colors sm:px-5 sm:text-xs"
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
              aria-label="Send message"
              className="flex items-center gap-2 px-5 py-3 text-[10px] font-bold tracking-[0.12em] text-white transition-opacity disabled:opacity-40"
              style={{ background: "#0f0e0c", fontFamily: "'Space Mono', monospace" }}
            >
              <Send className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">SEND</span>
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
