import { useState, useRef, useEffect } from "react";
import { Send } from "lucide-react";
import { publicAsset } from "../publicAsset";
import { askBanoy, sendChatFeedback,getBanoyHistory } from "../chatbotData";
import {manilaTime} from '../manilaTime';
import LoadFeedback from './LoadFeedback';
import { toast } from "sonner";

interface Message {
  id: string;
  text: string;
  sender: "user" | "bot";
  timestamp: Date;
  source?: string | null;
  questionId?: string | null;
  helpful?: boolean;
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
      src={publicAsset("banoy-chatbot.webp")}
      alt="Banoy, the Barangay Lagasit chatbot mascot"
      className={`${small ? "h-7 w-7" : "h-9 w-9"} rounded-full object-cover`}
      style={{ objectPosition: "8% center" }}
    />
  );
}

export default function ChatPage({ownerId}:{ownerId:string}) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "greeting",
      text: "Hello! I'm Banoy, Barangay Lagasit's assistant. I answer using information approved by barangay staff. What would you like to know?",
      sender: "bot",
      timestamp: new Date(),
    },
  ]);
  const [historyLoading,setHistoryLoading]=useState(true),[historyError,setHistoryError]=useState(''),[historyPage,setHistoryPage]=useState(0),[hasEarlier,setHasEarlier]=useState(false),[historyRevision,setHistoryRevision]=useState(0);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [feedbackBusy, setFeedbackBusy] = useState<string | null>(null);
  const sending = useRef(false);
  const historyScroll=useRef<{height:number;top:number}|null>(null);
  const logRef=useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if(historyScroll.current&&logRef.current){logRef.current.scrollTop=historyScroll.current.top+logRef.current.scrollHeight-historyScroll.current.height;historyScroll.current=null;}else if(!historyLoading)bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  useEffect(()=>{let active=true;setHistoryLoading(true);void getBanoyHistory(ownerId,historyPage).then(rows=>{if(!active)return;const loaded:Message[]=rows.slice().reverse().flatMap(row=>[{id:row.id+':user',text:row.question,sender:'user' as const,timestamp:new Date(row.created_at)},{id:row.id+':bot',text:row.answer_text??'No saved reply is available for this earlier question. You can ask it again.',sender:'bot' as const,timestamp:new Date(row.answered_at??row.created_at),source:row.answer_source,questionId:row.answer_text?row.id:null,...(row.helpful==null?{}:{helpful:row.helpful})}]);setMessages(previous=>{const savedIds=new Set(loaded.map(item=>item.id));return[...loaded,...previous.filter(item=>!savedIds.has(item.id))].sort((a,b)=>a.id==='greeting'?-1:b.id==='greeting'?1:a.timestamp.getTime()-b.timestamp.getTime());});setHasEarlier(rows.length===25);setHistoryError('');}).catch(cause=>{if(active)setHistoryError(cause instanceof Error?cause.message:'Could not load history.');}).finally(()=>{if(active)setHistoryLoading(false);});return()=>{active=false;};},[ownerId,historyPage,historyRevision]);
  const sendMessage = async (text: string) => {
    if (!text.trim() || sending.current || historyLoading) return;
    sending.current = true;
    const userMsg: Message = { id: crypto.randomUUID(), text: text.trim(), sender: "user", timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);
    try {
      const reply = await askBanoy(text.trim());
      setMessages((prev) => [
        ...prev.map(item=>item.id===userMsg.id&&reply.questionId?{...item,id:reply.questionId+":user"}:item),
        { id: reply.questionId?reply.questionId+":bot":crypto.randomUUID(), text: reply.answer, source: reply.source, questionId: reply.questionId, sender: "bot", timestamp: new Date() },
      ]);
    } catch (cause) {
      setMessages(previous => [...previous, { id: crypto.randomUUID(), text: cause instanceof Error ? cause.message : "I could not load current information. Please try again or contact staff.", sender: "bot", timestamp: new Date() }]);
    } finally {
      setIsTyping(false);
      sending.current = false;
    }
  };

  const fmt = (d: Date) => manilaTime(d,{hour:"2-digit",minute:"2-digit"});

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#edf1ee] md:flex-row" style={{ fontFamily: "'Segoe UI', 'Arial', sans-serif" }}>

      {/* ── Quick Questions Panel ──────────────────────────── */}
      <div
        className="flex w-full shrink-0 flex-col bg-white md:w-[220px]"
        style={{ borderBottom: "1px solid #c9d1ca", borderRight: "1px solid #c9d1ca" }}
      >
        <div className="px-4 py-3 md:px-5 md:py-4" style={{ borderBottom: "1px solid #c4c0b9" }}>
          <div className="mb-1 text-xs font-bold tracking-[0.18em] text-[#51635d] uppercase md:mb-2">Quick Questions</div>
          <p className="hidden text-xs leading-relaxed text-[#53645b] md:block">
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
              disabled={isTyping||historyLoading}
              onClick={() => void sendMessage(topic)}
              className="flex min-h-10 w-max shrink-0 items-center justify-between gap-2 whitespace-nowrap rounded-full border border-[#e8e5e0] bg-white px-3 text-left text-xs font-bold transition-colors md:min-h-11 md:w-full md:rounded-none md:border-0 md:border-b md:px-5 md:py-3 md:text-xs md:whitespace-normal"
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
          <div className="mb-1.5 text-xs font-bold tracking-[0.15em] text-[#51635d] uppercase">Banoy · FAQ assistant</div>
          <p className="text-xs leading-relaxed text-[#53645b]">
            Answers use knowledge approved by barangay staff. Unanswered questions are sent to staff for review.
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
              <div className="text-xs font-bold tracking-[0.12em] text-[#122d1f] uppercase">Banoy</div>
              <div className="mt-0.5 text-xs text-[#53645b]">
                Service information maintained by staff
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold tracking-[0.14em]">APPROVED ANSWERS</span>
          </div>
        </div>

        {/* Messages */}
        <div ref={logRef} role="log" aria-label="Conversation with Banoy" aria-live="polite" className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4 sm:space-y-6 sm:px-8 sm:py-6">
          <LoadFeedback loading={historyLoading} error={historyError} onRetry={()=>setHistoryRevision(value=>value+1)} label="Banoy history"/>
          {hasEarlier&&<button type="button" disabled={historyLoading||!!historyError} onClick={()=>{if(logRef.current)historyScroll.current={height:logRef.current.scrollHeight,top:logRef.current.scrollTop};setHistoryPage(value=>value+1);}} className="min-h-11 rounded border bg-white px-3 text-sm font-semibold">Load earlier messages</button>}
          <p className="text-xs text-[#53645b]">Conversation history is private to your account. Times use Asia/Manila.</p>
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
                {msg.source && <p className="mt-2 text-xs text-[#53645b]">Source: {msg.source}</p>}
                {msg.questionId && <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[#53645b]">
                  <span>Was this helpful?</span>
                  {[true,false].map(helpful=><button key={String(helpful)} type="button" disabled={feedbackBusy===msg.questionId || msg.helpful===helpful} aria-pressed={msg.helpful===helpful} className="min-h-11 rounded border border-[#c9d1ca] bg-white px-3 font-semibold disabled:opacity-50" onClick={async()=>{
                    setFeedbackBusy(msg.questionId!);
                    try { await sendChatFeedback(msg.questionId!,helpful);setMessages(previous=>previous.map(message=>message.id===msg.id?{...message,helpful}:message)); }
                    catch(cause){toast.error(cause instanceof Error?cause.message:"Could not save feedback.");}
                    finally{setFeedbackBusy(null);}
                  }}>{helpful?"Yes":"No"}</button>)}
                </div>}
                <div
                  className="text-xs font-bold tracking-[0.08em] mt-1.5"
                  style={{ color: "#61645f" }}
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
                      style={{ background: "#61645f", animationDelay: `${d}ms` }}
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
              maxLength={1000}
              aria-label="Your question for Banoy"
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
              disabled={!input.trim() || isTyping || historyLoading}
              aria-label="Send message"
              className="flex items-center gap-2 px-5 py-3 text-xs font-bold tracking-[0.12em] text-white transition-opacity disabled:opacity-40"
              style={{ background: "#0f0e0c", fontFamily: "'Space Mono', monospace" }}
            >
              <Send className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">SEND</span>
            </button>
          </form>
          <p className="text-xs mt-2.5 tracking-[0.06em]" style={{ color: "#bf6318" }}>
            Questions and feedback may be reviewed by barangay staff to improve answers. Confirm official requirements and fees with the Barangay Hall.
          </p>
        </div>
      </div>
    </div>
  );
}
