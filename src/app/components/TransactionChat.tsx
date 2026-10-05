import { FormEvent, useEffect, useState } from "react";
import { Send } from "lucide-react";
import { toast } from "sonner";
import {
  addTransactionMessage,
  getTransactionMessages,
  subscribeTransactionMessages,
  TransactionMessage,
} from "../portalData";
import { ResidentAccount } from "../residentAuth";

interface TransactionChatProps {
  reference: string;
  resident: ResidentAccount;
}

export default function TransactionChat({ reference, resident }: TransactionChatProps) {
  const [messages, setMessages] = useState<TransactionMessage[]>([]);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const loaded = await getTransactionMessages(reference);
        if (active) setMessages(loaded);
      } catch (error) {
        console.error("Unable to load request conversation.", error);
        if (active) toast.error(error instanceof Error ? error.message : "Could not load messages.");
      }
    };
    void refresh();
    const unsubscribe = subscribeTransactionMessages(() => { void refresh(); });
    return () => { active = false; unsubscribe(); };
  }, [reference]);

  const sendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedBody = body.trim();
    if (!trimmedBody || sending) return;
    setSending(true);
    try {
      await addTransactionMessage(reference, {
        id: globalThis.crypto?.randomUUID?.() ?? `message-${Date.now()}`,
        authorId: resident.id,
        author: resident.name,
        role: resident.role === "staff" ? "Staff" : "Resident",
        body: trimmedBody,
        sentAt: new Date().toISOString(),
      });
      setBody("");
      setMessages(await getTransactionMessages(reference));
    } catch (error) {
      console.error("Unable to send request message.", error);
      toast.error(error instanceof Error ? error.message : "Could not send message.");
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="mt-5 border-t border-[#d9e2da] pt-4" aria-label={`Conversation for ${reference}`}>
      <h3 className="text-base font-bold text-[#122d1f]">Request conversation</h3>
      <p className="mt-1 text-sm text-[#53645b]">
        Messages are attached to request {reference}.
      </p>
      <div className="my-3 max-h-56 space-y-2 overflow-y-auto rounded border border-[#d9e2da] bg-[#f7faf7] p-3">
        {messages.length ? messages.map((message) => (
          <article key={message.id} className="rounded border border-[#e1e8e1] bg-white p-3">
            <div className="flex flex-wrap justify-between gap-2 text-xs text-[#53645b]">
              <span className="font-bold text-[#123323]">{message.author} · {message.role}</span>
              <time dateTime={message.sentAt}>{new Date(message.sentAt).toLocaleString()}</time>
            </div>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-[#24362a]">{message.body}</p>
          </article>
        )) : (
          <p className="py-5 text-center text-sm text-[#53645b]">No messages yet. Send a message to follow up.</p>
        )}
      </div>
      <form onSubmit={sendMessage} className="flex gap-2">
        <label className="sr-only" htmlFor={`message-${reference}`}>Write a message</label>
        <input
          id={`message-${reference}`}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          maxLength={1000}
          placeholder="Write a follow-up message..."
          className="min-h-11 min-w-0 flex-1 rounded border border-[#c9d1ca] px-3 text-sm"
        />
        <button
          type="submit"
          disabled={!body.trim() || sending}
          className="flex min-h-11 items-center gap-2 rounded bg-[#123323] px-4 text-sm font-bold text-white disabled:opacity-50"
        >
          <Send className="h-4 w-4" /> Send
        </button>
      </form>
      <p className="mt-2 text-xs text-[#6e6b65]">Messages are shared with authorized participants on this request.</p>
    </section>
  );
}
