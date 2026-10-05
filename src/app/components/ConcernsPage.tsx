import { FormEvent, useEffect, useState } from "react";
import { Archive, MessageSquareText } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import {
  addResidentConcern,
  getResidentConcerns,
  ResidentConcern,
  subscribeResidentConcerns,
} from "../portalData";

export default function ConcernsPage({ residentName, residentId, contact }: { residentName: string; residentId: string; contact: string }) {
  const [concerns, setConcerns] = useState<ResidentConcern[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [form, setForm] = useState({ name: residentName, contact, category: "Service concern", message: "" });

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const loaded = await getResidentConcerns(residentId);
        if (active) setConcerns(loaded);
      } catch (error) {
        console.error("Unable to load resident concerns.", error);
        if (active) toast.error(error instanceof Error ? error.message : "Could not load feedback.");
      }
    };
    void refresh();
    const unsubscribe = subscribeResidentConcerns(() => { void refresh(); });
    return () => { active = false; unsubscribe(); };
  }, [residentId]);

  const submitConcern = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const reference = `CON-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
    const concern: ResidentConcern = {
      ...form,
      reference,
      ownerId: residentId,
      name: form.name.trim(),
      contact: form.contact.trim(),
      message: form.message.trim(),
      status: "RECEIVED",
      archived: false,
      submittedAt: new Date().toISOString(),
    };
    try {
      await addResidentConcern(concern);
      setConcerns(await getResidentConcerns(residentId));
      setForm((current) => ({ ...current, category: "Service concern", message: "" }));
      toast.success(`Feedback submitted. Reference: ${reference}`);
    } catch (error) {
      console.error("Unable to submit resident feedback.", error);
      toast.error(error instanceof Error ? error.message : "Could not submit feedback.");
    }
  };

  return (
    <div className="min-h-full bg-[#f4f7f4] p-4 md:p-7">
      <div className="mx-auto grid max-w-5xl gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="h-fit rounded-lg border border-[#d9e2da] bg-white p-5 md:p-6">
          <MessageSquareText className="h-6 w-6 text-[#123323]" />
          <h1 className="mt-3 text-2xl font-black text-[#122d1f]">Concerns and feedback</h1>
          <p className="mt-2 text-sm leading-relaxed text-[#53645b]">Tell the Barangay about a concern, service experience, or suggestion.</p>
          <form onSubmit={submitConcern} className="mt-5 space-y-4">
            <label className="grid gap-1.5 text-sm font-semibold text-[#34483a]">
              Full name
              <input required readOnly value={form.name} className="min-h-11 rounded border border-[#c9d1ca] bg-[#f4f7f4] px-3 text-base text-[#53645b]" />
            </label>
            <label className="grid gap-1.5 text-sm font-semibold text-[#34483a]">
              Contact number or email
              <input required value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} className="min-h-11 rounded border border-[#c9d1ca] px-3 text-base" />
            </label>
            <label className="grid gap-1.5 text-sm font-semibold text-[#34483a]">
              Category
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="min-h-11 rounded border border-[#c9d1ca] bg-white px-3 text-base">
                <option>Service concern</option><option>Feedback</option><option>Suggestion</option><option>Other</option>
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-semibold text-[#34483a]">
              Details
              <textarea required maxLength={2000} rows={5} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} className="rounded border border-[#c9d1ca] p-3 text-base" />
            </label>
            <button type="submit" className="min-h-11 rounded bg-[#123323] px-5 text-sm font-bold text-white">Submit concern</button>
          </form>
          <p className="mt-3 text-xs leading-relaxed text-[#6e6b65]">Submissions are stored in the shared database and visible to authorized staff. Do not use this form for emergencies.</p>
        </section>

        <section className="rounded-lg border border-[#d9e2da] bg-white">
          <div className="border-b border-[#d9e2da] bg-[#f7faf7] p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-[#122d1f]">Submitted concerns</h2>
                <p className="mt-1 text-sm text-[#53645b]">{concerns.filter(item => item.archived === showArchived).length} {showArchived ? "archived" : "active"} from your account</p>
              </div>
              <button
                type="button"
                onClick={() => setShowArchived(value => !value)}
                className="flex min-h-10 items-center gap-2 rounded border border-[#c9d1ca] bg-white px-3 text-sm font-semibold text-[#34483a]"
              >
                <Archive className="h-4 w-4" /> {showArchived ? "View active" : "View archive"}
              </button>
            </div>
          </div>
          {concerns.filter(item => item.archived === showArchived).length ? <div className="divide-y divide-[#e3e8e3]">
            {concerns.filter(item => item.archived === showArchived).map((concern) => (
              <article key={concern.reference} className="p-5">
                <div className="flex flex-wrap justify-between gap-2">
                  <h3 className="font-bold text-[#122d1f]">{concern.category}</h3>
                  <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-900">{concern.status}</span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[#34483a]">{concern.message}</p>
                <p className="mt-3 text-xs text-[#53645b]">{concern.reference} · {concern.name} · {format(parseISO(concern.submittedAt), "MMM d, yyyy")}</p>
              </article>
            ))}
          </div> : <p className="p-6 text-sm text-[#53645b]">{showArchived ? "No archived concerns or feedback." : "No active concerns or feedback have been submitted yet."}</p>}
        </section>
      </div>
    </div>
  );
}
