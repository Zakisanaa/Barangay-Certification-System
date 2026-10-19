import ListTools from './ListTools';
import ChoiceOrCustom from './ChoiceOrCustom';
import {useUnsavedChanges,confirmDiscardChanges} from '../useUnsavedChanges';
import LoadFeedback from './LoadFeedback';
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Archive, MessageSquareText, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import ListPager from './ListPager';
import ConcernConversation from './ConcernConversation';
import ResidentVerification from './ResidentVerification';
import { Dialog,DialogContent,DialogDescription,DialogTitle } from './ui/dialog';
import { requireSupabase } from '../supabase';
import {
  getConcernPage,getResidentPage,DirectoryResident,
  getResidentConcerns,
  getResidentDirectory,
  getWalkInShifts,
  ResidentConcern,
  updateResidentDirectoryEntry,
  updateResidentConcern,
  setResidentConcernArchived,
  saveWalkInShifts,
  subscribeResidentConcerns,
  subscribeResidentDirectory,
  subscribeWalkInShifts,
  WalkInShift,
} from "../portalData";

type ServiceTab = "concerns" | "residents" | "schedule";

const inputClass = "min-h-11 rounded border border-[#c9d1ca] bg-white px-3 text-sm text-[#24362a]";

export default function AdminServicesPage({ initialTab,focusReference }: { initialTab: ServiceTab;focusReference?:string }) {
  const [loading,setLoading]=useState(true);
  const [page,setPage]=useState(0),[total,setTotal]=useState(0),[revision,setRevision]=useState(0),[loadError,setLoadError]=useState(''),[savingShift,setSavingShift]=useState(false);
  const lock=useRef(false),shiftId=useRef(crypto.randomUUID()),residentRevision=useRef<number|undefined>(undefined);
  const [concerns, setConcerns] = useState<ResidentConcern[]>([]);
  const [selectedConcern,setSelectedConcern]=useState<ResidentConcern|null>(null);
  const [verifyingResident,setVerifyingResident]=useState<DirectoryResident|null>(null);
  const [showArchivedConcerns, setShowArchivedConcerns] = useState(false);
  const [residents, setResidents] = useState<DirectoryResident[]>([]);
  const [shifts, setShifts] = useState<WalkInShift[]>([]);
  const [residentQuery, setResidentQuery] = useState("");
  const [concernQuery,setConcernQuery]=useState(""),[sort,setSort]=useState("newest");
  const [editingResidentId, setEditingResidentId] = useState<string | null>(null);
  const [residentForm, setResidentForm] = useState({ firstName: "", lastName: "", contactNumber: "", address: "" });
  const residentBaseline=useRef('');
  useUnsavedChanges(!!editingResidentId&&JSON.stringify(residentForm)!==residentBaseline.current);
  const [savingResident, setSavingResident] = useState(false);
  const [shiftForm, setShiftForm] = useState({ staffName: "", role: "", days: "", hours: "" });
  useUnsavedChanges(Object.values(shiftForm).some(value=>value.trim()));
  const [notice, setNotice] = useState("");
  useEffect(()=>{if(!focusReference||initialTab!=='concerns')return;let active=true;void requireSupabase().from('resident_concerns').select('*').eq('reference',focusReference).single().then(({data,error})=>{if(!active)return;if(error){toast.error('Could not open that concern. Refresh the list.');return;}setSelectedConcern({reference:data.reference,ownerId:data.owner_id,name:data.name,contact:data.contact,category:data.category,message:data.message,status:data.status,archived:data.archived,submittedAt:data.submitted_at,version:data.version,resolutionNote:data.resolution_note});});return()=>{active=false;};},[focusReference,initialTab]);

  useEffect(() => {
    let active = true;
    let refreshGeneration=0;
    const refresh = async () => {
      const generation=++refreshGeneration;setLoading(true);
      try {
        if(initialTab==='concerns'){const loaded=await getConcernPage({page,query:concernQuery,sort,archived:showArchivedConcerns});if(active&&generation===refreshGeneration){setConcerns(loaded.rows);setTotal(loaded.total);setLoadError('');}}
        else if(initialTab==='residents'){const loaded=await getResidentPage({page,query:residentQuery,sort});if(active&&generation===refreshGeneration){setResidents(loaded.rows);setTotal(loaded.total);setLoadError('');}}
        else{const loaded=await getWalkInShifts();if(active&&generation===refreshGeneration){setShifts(loaded);setLoadError('');}}
      } catch (error) {
        console.error("Unable to load the staff service records.", error);
        if(active&&generation===refreshGeneration)setLoadError(error instanceof Error?error.message:"Could not load staff records.");
      }finally{if(active&&generation===refreshGeneration)setLoading(false);}
    };
    void refresh();
    const subscribe=initialTab==='concerns'?subscribeResidentConcerns:initialTab==='residents'?subscribeResidentDirectory:subscribeWalkInShifts;
    const unsubscribers=[subscribe(()=>void refresh())];
    return () => { active = false; unsubscribers.forEach((unsubscribe) => unsubscribe()); };
  }, [initialTab,page,showArchivedConcerns,residentQuery,concernQuery,sort,revision]);

  const filteredResidents=residents;
  useEffect(()=>{if(!focusReference||initialTab!=='residents')return;let active=true;void requireSupabase().from('resident_profiles').select('id,first_name,last_name,email,contact_number,address,created_at,revision').eq('id',focusReference).eq('role','resident').single().then(({data,error})=>{if(!active)return;if(error){toast.error('Could not open that resident verification. Search the resident masterlist or retry the notification.');return;}setVerifyingResident({id:data.id,firstName:data.first_name,lastName:data.last_name,name:`${data.first_name} ${data.last_name}`,email:data.email,contactNumber:data.contact_number,address:data.address,createdAt:data.created_at,revision:data.revision});});return()=>{active=false;};},[focusReference,initialTab]);

  const updateConcernStatus = async (reference: string, status: ResidentConcern["status"]) => {
    try {
      await updateResidentConcern(reference, status);
      toast.success("Concern status updated. Email notification queued.");
      setConcerns(await getResidentConcerns());
    } catch (error) {
      console.error("Unable to update resident concern status.", error);
      toast.error(error instanceof Error ? error.message : "Could not update concern.");
    }
  };

  const toggleConcernArchive = async (concern: ResidentConcern) => {
    try {
      await setResidentConcernArchived(concern.reference, !concern.archived);
      setConcerns(previous=>previous.filter(item=>item.reference!==concern.reference));setRevision(value=>value+1);
      toast.success(concern.archived ? "Concern restored." : "Concern moved to the archive.");
    } catch (error) {
      console.error("Unable to update concern archive status.", error);
      toast.error(error instanceof Error ? error.message : "Could not update concern archive.");
    }
  };

  const startEditingResident = (resident: DirectoryResident) => {
    if(!confirmDiscardChanges())return;
    residentBaseline.current=JSON.stringify({firstName:resident.firstName,lastName:resident.lastName,contactNumber:resident.contactNumber,address:resident.address});
    residentRevision.current=resident.revision;setEditingResidentId(resident.id);
    setResidentForm({
      firstName: resident.firstName,
      lastName: resident.lastName,
      contactNumber: resident.contactNumber,
      address: resident.address,
    });
  };

  const saveResident = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingResidentId||lock.current) return;
    if (!residentForm.firstName.trim() || !residentForm.lastName.trim() || !residentForm.contactNumber.trim() || !residentForm.address.trim()) {
      toast.error("Complete all resident details before saving.");
      return;
    }
    lock.current=true;setSavingResident(true);
    try {
      await updateResidentDirectoryEntry({ id: editingResidentId,revision:residentRevision.current, ...residentForm });
      setRevision(value=>value+1);
      setEditingResidentId(null);
      toast.success("Resident masterlist entry updated.");
    } catch (error) {
      console.error("Unable to save resident masterlist changes.", error);
      toast.error(error instanceof Error ? error.message : "Could not update resident.");
    } finally {
      lock.current=false;setSavingResident(false);
    }
  };

  const addShift = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if(lock.current)return;lock.current=true;setSavingShift(true);
    const shift: WalkInShift = {
      ...shiftForm,
      id: shiftId.current,
      active: true,
    };
    try {
      await saveWalkInShifts([shift]);
      setShifts(previous=>[...previous.filter(item=>item.id!==shift.id),shift]);shiftId.current=crypto.randomUUID();
      setShiftForm({ staffName: "", role: "", days: "", hours: "" });
      setNotice("Walk-in schedule saved to the shared database.");
    } catch (error) {
      console.error("Unable to save walk-in schedule.", error);
      toast.error(error instanceof Error ? error.message : "Could not save schedule.");
    }finally{lock.current=false;setSavingShift(false);}
  };

  const toggleShift = async (id: string) => {
    if(lock.current)return;const original=shifts.find(item=>item.id===id);if(!original)return;const updated={...original,active:!original.active};lock.current=true;setSavingShift(true);
    try {
      await saveWalkInShifts([updated]);
      setShifts(previous=>previous.map(item=>item.id===id?updated:item));
    } catch (error) {
      console.error("Unable to update walk-in schedule.", error);
      toast.error(error instanceof Error ? error.message : "Could not update schedule.");
    }finally{lock.current=false;setSavingShift(false);}
  };

  return (
    <section className="overflow-hidden rounded-lg border border-[#d9e2da] bg-white shadow-sm">
      <LoadFeedback loading={loading} error={loadError} onRetry={()=>setRevision(value=>value+1)} label="records"/>
      {verifyingResident&&<Dialog open onOpenChange={open=>{if(!open)setVerifyingResident(null);}}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl"><DialogTitle>Verify {verifyingResident.name}</DialogTitle><DialogDescription>Review identity and residency evidence and record the decision.</DialogDescription><ResidentVerification key={verifyingResident.id} residentId={verifyingResident.id} staff/></DialogContent></Dialog>}
      {selectedConcern&&<ConcernConversation concern={selectedConcern} staff onClose={()=>setSelectedConcern(null)} onUpdated={next=>{setSelectedConcern(next);setConcerns(previous=>previous.map(item=>item.reference===next.reference?next:item));}}/>}
      {initialTab === "concerns" && (
        <div>
          <div className="border-b border-[#e3e8e3] p-5">
            <h2 className="text-xl font-bold text-[#122d1f]">Resident concerns and feedback</h2>
            <p className="mt-1 text-sm text-[#53645b]">Review submissions, update status, and archive resolved or inactive records.</p>
          </div>
          <div className="flex flex-wrap gap-2 border-b border-[#e3e8e3] p-3">
            {([false, true] as const).map((archived) => (
              <button
                key={String(archived)}
                type="button"
                onClick={() => {setPage(0);setShowArchivedConcerns(archived);}}
                aria-pressed={showArchivedConcerns === archived}
                className={`flex min-h-10 items-center gap-2 rounded px-4 text-sm font-bold ${showArchivedConcerns === archived ? "bg-[#123323] text-white" : "border border-[#c9d1ca] bg-white text-[#53645b]"}`}
              >
                {archived ? <Archive className="h-4 w-4" /> : <MessageSquareText className="h-4 w-4" />}
                {archived ? "Archive" : "Active concerns"}
              </button>
            ))}
          </div>
          <div className="p-4"><ListTools label="concerns" query={concernQuery} onQuery={value=>{setPage(0);setConcernQuery(value);}} sort={sort} onSort={value=>{setPage(0);setSort(value);}}/></div>
          {concerns.filter(concern => concern.archived === showArchivedConcerns).length ? (
            <div className="divide-y divide-[#e3e8e3]">
          {concerns.filter(concern => concern.archived === showArchivedConcerns).map((concern) => (
                <article key={concern.reference} className="grid gap-4 p-5 lg:grid-cols-[1fr_auto]">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-[#122d1f]">{concern.category}</h3>
                      <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-900">{concern.status.replace("_", " ")}</span>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[#34483a]">{concern.message}</p>
                    <p className="mt-2 break-words text-xs text-[#53645b]">
                      {concern.reference} · {concern.name} · {concern.contact} · {new Date(concern.submittedAt).toLocaleString('en-PH',{timeZone:'Asia/Manila'})}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <button type="button" onClick={()=>setSelectedConcern(concern)} className="min-h-11 rounded border border-[#c9d1ca] px-4 text-sm font-semibold">Handle concern</button>
                    <button
                      type="button"
                      onClick={() => void toggleConcernArchive(concern)}
                      className="flex min-h-10 items-center gap-2 rounded border border-[#c9d1ca] px-3 text-sm font-semibold text-[#34483a]"
                    >
                      {concern.archived ? <RotateCcw className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                      {concern.archived ? "Restore" : "Archive"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : !loading&&!loadError?<p className="p-6 text-sm text-[#53645b]">{showArchivedConcerns ? "There are no archived concerns." : "There are no active concerns."}</p>:null}
        </div>
      )}

      {initialTab === "residents" && (
        <div>
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#e3e8e3] p-5">
            <div>
              <h2 className="text-xl font-bold text-[#122d1f]">Resident masterlist</h2>
              <p className="mt-1 text-sm text-[#53645b]">Resident accounts in the shared database: {total}.</p>
            </div>

          </div>
          <div className="p-4"><ListTools label="residents" query={residentQuery} onQuery={value=>{setPage(0);setResidentQuery(value);}} sort={sort} onSort={value=>{setPage(0);setSort(value);}}/></div>
          {filteredResidents.length ? (
            <div className="overflow-x-auto">
              <table className="responsive-table w-full text-left"><caption>Resident accounts and contact details</caption>
                <thead className="bg-[#f7faf7] text-xs uppercase text-[#53645b]"><tr>
                  {["Resident", "Email", "Contact", "Address", "Registered", "Actions"].map((heading) => <th key={heading} className="px-4 py-3">{heading}</th>)}
                </tr></thead>
                <tbody className="divide-y divide-[#e3e8e3]">
                  {filteredResidents.map((resident) => (
                    <tr key={resident.id}>
                      <td data-label="Resident" className="px-4 py-3 text-sm font-semibold">{resident.name}</td>
                      <td data-label="Email" className="px-4 py-3 text-sm">{resident.email || "Not provided"}</td>
                      <td data-label="Contact" className="px-4 py-3 text-sm">{resident.contactNumber}</td>
                      <td data-label="Address" className="px-4 py-3 text-sm">{resident.address}</td>
                      <td data-label="Registered" className="px-4 py-3 text-sm">{new Date(resident.createdAt).toLocaleDateString('en-PH',{timeZone:'Asia/Manila'})}</td>
                      <td data-label="Actions" className="px-4 py-3">
                        <button type="button" onClick={()=>setVerifyingResident(resident)} className="min-h-11 rounded border border-[#c9d1ca] px-3 text-sm font-semibold">Review verification</button>
                        <button
                          type="button"
                          onClick={() => startEditingResident(resident)}
                          className="min-h-10 rounded border border-[#c9d1ca] px-3 text-sm font-semibold text-[#123323] hover:bg-[#f0f5f1]"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : !loading&&!loadError?<p className="p-6 text-sm text-[#53645b]">{residentQuery ? "No residents match that search." : "No residents have registered yet."}</p>:null}
          {editingResidentId && (
            <form onSubmit={saveResident} className="grid gap-4 border-t border-[#e3e8e3] bg-[#f7faf7] p-5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <h3 className="text-base font-bold text-[#122d1f]">Edit resident details</h3>
              </div>
              <label className="grid gap-1 text-sm font-semibold text-[#34483a]">First name
                <input required maxLength={100} value={residentForm.firstName} onChange={event => setResidentForm(current => ({ ...current, firstName: event.target.value }))} className={inputClass} />
              </label>
              <label className="grid gap-1 text-sm font-semibold text-[#34483a]">Last name
                <input required maxLength={100} value={residentForm.lastName} onChange={event => setResidentForm(current => ({ ...current, lastName: event.target.value }))} className={inputClass} />
              </label>
              <label className="grid gap-1 text-sm font-semibold text-[#34483a]">Contact number
                <input required maxLength={40} type="tel" value={residentForm.contactNumber} onChange={event => setResidentForm(current => ({ ...current, contactNumber: event.target.value }))} className={inputClass} />
              </label>
              <label className="grid gap-1 text-sm font-semibold text-[#34483a] sm:col-span-2">Home address
                <textarea required maxLength={500} rows={2} value={residentForm.address} onChange={event => setResidentForm(current => ({ ...current, address: event.target.value }))} className={`${inputClass} py-2`} />
              </label>
              <div className="flex flex-wrap justify-end gap-2 sm:col-span-2">
                <button type="button" onClick={() => {if(confirmDiscardChanges())setEditingResidentId(null);}} disabled={savingResident} className="min-h-11 rounded border border-[#c9d1ca] bg-white px-4 text-sm font-semibold text-[#53645b]">Cancel</button>
                <button type="submit" disabled={savingResident} className="min-h-11 rounded bg-[#123323] px-4 text-sm font-bold text-white disabled:opacity-60">{savingResident ? "Saving…" : "Save changes"}</button>
              </div>
            </form>
          )}
          <p className="border-t border-[#e3e8e3] bg-amber-50 p-4 text-xs leading-relaxed text-amber-950">
            Resident records are private to authorized staff and stored in the configured Supabase database. Confirm residents' details according to Barangay policy.
          </p>
        </div>
      )}

      {initialTab === "schedule" && (
        <div>
          <div className="border-b border-[#e3e8e3] p-5">
            <h2 className="text-xl font-bold text-[#122d1f]">Walk-in staff schedule</h2>
            <p className="mt-1 text-sm text-[#53645b]">Add posted availability or hide a shift from the resident schedule.</p>
          </div>
          {notice && <p role="status" className="mx-5 mt-4 rounded border border-green-200 bg-green-50 p-3 text-sm text-green-900">{notice}</p>}
          <form onSubmit={addShift} onChange={()=>{shiftId.current=crypto.randomUUID();}} className="grid gap-3 border-b border-[#e3e8e3] p-5 sm:grid-cols-2 xl:grid-cols-5">
            <label className="grid gap-1 text-xs font-bold text-[#53645b]">STAFF / SERVICE DESK<input disabled={savingShift} required maxLength={80} value={shiftForm.staffName} onChange={(e) => setShiftForm({ ...shiftForm, staffName: e.target.value })} className={inputClass} /></label>
            <label className="grid gap-1 text-xs font-bold text-[#53645b]">ROLE / SERVICE<input disabled={savingShift} required maxLength={80} value={shiftForm.role} onChange={(e) => setShiftForm({ ...shiftForm, role: e.target.value })} className={inputClass} /></label>
            <label className="grid gap-1 text-xs font-bold text-[#53645b]">DAYS<input disabled={savingShift} required maxLength={80} placeholder="Mon–Fri" value={shiftForm.days} onChange={(e) => setShiftForm({ ...shiftForm, days: e.target.value })} className={inputClass} /></label>
            <label className="grid gap-1 text-xs font-bold text-[#53645b]">HOURS<input disabled={savingShift} required maxLength={80} placeholder="8:00 AM–5:00 PM" value={shiftForm.hours} onChange={(e) => setShiftForm({ ...shiftForm, hours: e.target.value })} className={inputClass} /></label>
            <button type="submit" className="min-h-11 self-end rounded bg-[#123323] px-4 text-sm font-bold text-white" disabled={savingShift}>{savingShift?"Saving…":"Add schedule"}</button>
          </form>
          {shifts.length ? <div className="divide-y divide-[#e3e8e3]">
            {shifts.map((shift) => <article key={shift.id} className="flex flex-wrap items-center justify-between gap-3 p-5">
              <div>
                <h3 className="font-bold text-[#122d1f]">{shift.staffName}</h3>
                <p className="text-sm text-[#53645b]">{shift.role} · {shift.days} · {shift.hours}</p>
              </div>
              <button type="button" disabled={savingShift} onClick={() => toggleShift(shift.id)} className={`min-h-10 rounded border px-4 text-sm font-bold ${shift.active ? "border-green-300 bg-green-50 text-green-900" : "border-[#c9d1ca] bg-white text-[#53645b]"}`}>
                {shift.active ? "Published — hide" : "Hidden — publish"}
              </button>
            </article>)}
          </div> : !loading&&!loadError?<p className="p-6 text-sm text-[#53645b]">No schedule entries have been added.</p>:null}
          <p className="border-t border-[#e3e8e3] bg-amber-50 p-4 text-xs leading-relaxed text-amber-950">
            Confirm every staff assignment and service hour with the Barangay before publishing. Active shifts are visible to all portal visitors.
          </p>
        </div>
      )}
      {initialTab!=="schedule"&&<ListPager page={page} total={total} onPage={setPage}/>}
    </section>
  );
}
