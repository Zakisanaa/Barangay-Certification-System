import ListTools from './ListTools';
import LoadFeedback from './LoadFeedback';
import {manilaTime} from '../manilaTime';
import { FormEvent, useEffect, useRef, useState } from "react";
import { Archive, MessageSquareText } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import ListPager from './ListPager';
import ConcernConversation from './ConcernConversation';
import {
  getConcernPage,addResidentConcern,
  getResidentConcerns,
  ResidentConcern,
  subscribeResidentConcerns,
} from "../portalData";

export default function ConcernsPage({ residentName, residentId, contact,focusReference,focusToken }: { residentName: string; residentId: string; contact: string;focusReference?:string;focusToken?:string }) {
  const [loading,setLoading]=useState(true);
  const [query,setQuery]=useState(""),[sort,setSort]=useState("newest");
  const [page,setPage]=useState(0),[total,setTotal]=useState(0),[loadError,setLoadError]=useState(''),[revision,setRevision]=useState(0),[saving,setSaving]=useState(false);
  const lock=useRef(false),submission=useRef(crypto.randomUUID());
  const [concerns, setConcerns] = useState<ResidentConcern[]>([]);
  const [selectedConcern,setSelectedConcern]=useState<ResidentConcern|null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [form, setForm] = useState({ name: residentName, contact, category: "Service concern", message: "" });
  useEffect(()=>{if(!focusReference)return;let active=true;void getConcernPage({owner:residentId,query:focusReference,sort:'newest',archived:null}).then(result=>{if(!active)return;const item=result.rows.find(row=>row.reference===focusReference&&row.ownerId===residentId);if(item)setSelectedConcern(item);else toast.error('This concern could not be opened. Refresh your concerns and try again.');}).catch(()=>{if(active)toast.error('Could not load the selected concern. Try again.');});return()=>{active=false;};},[focusReference,focusToken,residentId]);

  useEffect(() => {
    let active = true;
    let refreshGeneration=0;
    const refresh = async () => {
      const generation=++refreshGeneration;setLoading(true);
      try {
        const loaded=await getConcernPage({owner:residentId,page,query,sort,archived:showArchived});
        if(active&&generation===refreshGeneration){setConcerns(loaded.rows);setTotal(loaded.total);setLoadError('');}
      } catch (error) {
        console.error("Unable to load resident concerns.", error);
        if(active&&generation===refreshGeneration)setLoadError(error instanceof Error?error.message:"Could not load feedback.");
      }finally{if(active&&generation===refreshGeneration)setLoading(false);}
    };
    void refresh();
    const unsubscribe = subscribeResidentConcerns(() => { void refresh(); });
    return () => { active = false; unsubscribe(); };
  }, [residentId,page,query,sort,showArchived,revision]);

  const submitConcern = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if(lock.current)return;lock.current=true;setSaving(true);
    const reference=`CON-${submission.current}`;
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
      const saved=await addResidentConcern(concern);
      setConcerns(previous=>[saved,...previous.filter(item=>item.reference!==saved.reference)].slice(0,25));setPage(0);setShowArchived(false);setRevision(value=>value+1);submission.current=crypto.randomUUID();
      setForm((current) => ({ ...current, category: "Service concern", message: "" }));
      toast.success(`Feedback submitted. Reference: ${reference}`);
    } catch (error) {
      console.error("Unable to submit resident feedback.", error);
      toast.error(error instanceof Error ? error.message : "Could not submit feedback.");
    }finally{lock.current=false;setSaving(false);}
  };

  return (
    <div className="min-h-full bg-[#f4f7f4] p-4 md:p-7">
      {selectedConcern&&<ConcernConversation concern={selectedConcern} staff={false} onClose={()=>setSelectedConcern(null)} onUpdated={next=>setConcerns(previous=>previous.map(item=>item.reference===next.reference?next:item))}/>}
      <div className="mx-auto grid max-w-5xl gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="h-fit rounded-lg border border-[#d9e2da] bg-white p-5 md:p-6">
          <MessageSquareText className="h-6 w-6 text-[#123323]" />
          <h1 className="mt-3 text-2xl font-black text-[#122d1f]">Concerns and feedback</h1>
          <p className="mt-2 text-sm leading-relaxed text-[#53645b]">Tell the Barangay about a concern, service experience, or suggestion.</p>
          <form onSubmit={submitConcern} className="mt-5 space-y-4"><fieldset disabled={saving} className="space-y-4" onChange={()=>{submission.current=crypto.randomUUID();}}>
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
            <button type="submit" className="min-h-11 rounded bg-[#123323] px-5 text-sm font-bold text-white" disabled={saving}>{saving?"Submitting…":"Submit concern"}</button>
          </fieldset></form>
          <p className="mt-3 text-xs leading-relaxed text-[#6e6b65]">Submissions are stored in the shared database and visible to authorized staff. Do not use this form for emergencies.</p>
        </section>

        <section className="rounded-lg border border-[#d9e2da] bg-white">
          <div className="border-b border-[#d9e2da] bg-[#f7faf7] p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-[#122d1f]">Submitted concerns</h2>
                <p className="mt-1 text-sm text-[#53645b]">{total} {showArchived ? "archived" : "active"} from your account</p>
              </div>
              <button
                type="button"
                onClick={() => {setPage(0);setShowArchived(value => !value);}}
                className="flex min-h-10 items-center gap-2 rounded border border-[#c9d1ca] bg-white px-3 text-sm font-semibold text-[#34483a]"
              >
                <Archive className="h-4 w-4" /> {showArchived ? "View active" : "View archive"}
              </button>
            </div>
          </div>
          <div className="p-4"><ListTools label="your concerns" query={query} onQuery={value=>{setPage(0);setQuery(value);}} sort={sort} onSort={value=>{setPage(0);setSort(value);}} options={[["newest","Newest first"],["oldest","Oldest first"]]}/></div>
          <LoadFeedback loading={loading} error={loadError} onRetry={()=>setRevision(value=>value+1)} label="concerns"/>
          {concerns.filter(item => item.archived === showArchived).length ? <div className="divide-y divide-[#e3e8e3]">
            {concerns.filter(item => item.archived === showArchived).map((concern) => (
              <article key={concern.reference} className="p-5">
                <div className="flex flex-wrap justify-between gap-2">
                  <h3 className="font-bold text-[#122d1f]">{concern.category}</h3>
                  <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-900">{concern.status}</span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[#34483a]">{concern.message}</p>
                <p className="mt-3 text-xs text-[#53645b]">{concern.reference} · {concern.name} · {manilaTime(concern.submittedAt,{dateStyle:"medium"})}</p>
                <button type="button" onClick={()=>setSelectedConcern(concern)} className="mt-3 min-h-11 rounded border border-[#c9d1ca] px-4 text-sm font-semibold">Open concern conversation</button>
              </article>
            ))}
          </div> : !loading&&!loadError?<p className="p-6 text-sm text-[#53645b]">{showArchived ? "No archived concerns or feedback." : "No active concerns or feedback have been submitted yet."}</p>:null}
          <ListPager page={page} total={total} onPage={setPage}/>
        </section>
      </div>
    </div>
  );
}
