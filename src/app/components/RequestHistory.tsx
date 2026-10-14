import { useEffect, useState } from "react";
import { Download, History, Loader2 } from "lucide-react";
import { getCompletedCertificateUrl, getRequestHistory, subscribeServiceData } from "../serviceData";
import type { CertificateDeliveryRecord, RequestEvent } from "../serviceData";

const deliveryLabels: Record<CertificateDeliveryRecord["status"], string> = {
  pending: "Preparing email", sent: "Sent to email provider", delivered: "Delivered to mail server",
  delayed: "Delivery delayed", bounced: "Email bounced", failed: "Email failed",
};
const formatTime = (value: string) => new Date(value).toLocaleString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" });

export default function RequestHistory({ reference }: { reference: string }) {
  const [events, setEvents] = useState<RequestEvent[]>([]);
  const [deliveries, setDeliveries] = useState<CertificateDeliveryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const result = await getRequestHistory(reference);
        if (active) { setEvents(result.events); setDeliveries(result.deliveries); setError(""); }
      } catch (cause) { if (active) setError(cause instanceof Error ? cause.message : "Could not load request history."); }
      finally { if (active) setLoading(false); }
    };
    setLoading(true);
    void refresh();
    const unsubscribe = subscribeServiceData(["request_events", "certificate_deliveries"], () => { void refresh(); });
    return () => { active = false; unsubscribe(); };
  }, [reference, reload]);

  const download = async (delivery: CertificateDeliveryRecord) => {
    setDownloading(delivery.id);
    try {
      const url = await getCompletedCertificateUrl(delivery.storage_path);
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${reference}-certificate.pdf`; anchor.click();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not download the certificate."); }
    finally { setDownloading(null); }
  };

  return <section aria-label="Request history" className="space-y-4 border-t border-[#d9e2da] pt-4">
    <h3 className="flex items-center gap-2 text-base font-bold text-[#122d1f]"><History className="h-4 w-4" />Request history</h3>
    {loading && <p role="status" className="text-sm text-[#53645b]">Loading history…</p>}
    {error && <div role="alert" className="space-y-2 text-sm text-red-800"><p>{error}</p><button type="button" onClick={() => setReload(value => value + 1)} className="min-h-11 rounded border border-red-200 px-3">Retry loading history</button></div>}
    {!!deliveries.length && <div className="space-y-3">
      <h4 className="text-sm font-bold text-[#34483a]">Completed certificates</h4>
      {deliveries.map(delivery => <article key={delivery.id} className="space-y-2 rounded-md border border-[#d9e2da] bg-[#f7faf7] p-3">
        <div className="flex flex-wrap items-start justify-between gap-2"><p className="min-w-0 break-words text-sm font-semibold">{delivery.template_name.replace(/\.docx$/i, "")}</p><span className={`rounded-full px-2 py-1 text-xs font-semibold ${delivery.status === "delivered" ? "bg-green-100 text-green-800" : delivery.status === "failed" || delivery.status === "bounced" ? "bg-red-100 text-red-800" : "bg-slate-100 text-slate-700"}`}>{deliveryLabels[delivery.status]}</span></div>
        <p className="break-all text-xs text-[#53645b]">To: {delivery.recipient_email}</p>
        <p className="text-xs text-[#53645b]">{delivery.sender_name} · {formatTime(delivery.created_at)}</p>
        {delivery.error_message && <p className="text-sm text-red-800">{delivery.error_message}</p>}
        <button type="button" disabled={!!downloading} onClick={() => void download(delivery)} className="inline-flex min-h-11 items-center gap-2 rounded border border-[#c9d1ca] bg-white px-3 text-sm font-semibold text-[#123323] disabled:opacity-50">{downloading === delivery.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}Download completed PDF</button>
      </article>)}
      <p className="text-xs leading-relaxed text-[#53645b]">Delivery confirms acceptance by the recipient's mail server. It does not confirm that the resident opened the email.</p>
    </div>}
    <ol className="space-y-3 border-l-2 border-[#d9e2da] pl-4">
      {events.map(event => <li key={event.id} className="space-y-1"><p className="text-sm font-semibold text-[#122d1f]">{event.status}</p><p className="whitespace-pre-wrap break-words text-sm text-[#34483a]">{event.description}</p><p className="text-xs text-[#53645b]">{event.actor_name} · {formatTime(event.created_at)}</p></li>)}
    </ol>
    {!loading && !error && !events.length && !deliveries.length && <p className="text-sm text-[#53645b]">No history has been recorded yet.</p>}
  </section>;
}
