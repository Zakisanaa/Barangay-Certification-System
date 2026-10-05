import { FormEvent, useEffect, useMemo, useState } from "react";
import { Archive, MessageSquareText, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import {
  DirectoryResident,
  getResidentConcerns,
  getResidentDirectory,
  getWalkInShifts,
  ResidentConcern,
  sendResidentNotification,
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

export default function AdminServicesPage({ initialTab }: { initialTab: ServiceTab }) {
  const [concerns, setConcerns] = useState<ResidentConcern[]>([]);
  const [showArchivedConcerns, setShowArchivedConcerns] = useState(false);
  const [residents, setResidents] = useState<DirectoryResident[]>([]);
  const [shifts, setShifts] = useState<WalkInShift[]>([]);
  const [residentQuery, setResidentQuery] = useState("");
  const [editingResidentId, setEditingResidentId] = useState<string | null>(null);
  const [residentForm, setResidentForm] = useState({ firstName: "", lastName: "", contactNumber: "", address: "" });
  const [savingResident, setSavingResident] = useState(false);
  const [shiftForm, setShiftForm] = useState({ staffName: "", role: "", days: "", hours: "" });
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const [loadedConcerns, loadedResidents, loadedShifts] = await Promise.all([
          getResidentConcerns(), getResidentDirectory(), getWalkInShifts(),
        ]);
        if (active) {
          setConcerns(loadedConcerns);
          setResidents(loadedResidents);
          setShifts(loadedShifts);
        }
      } catch (error) {
        console.error("Unable to load the staff service records.", error);
        if (active) toast.error(error instanceof Error ? error.message : "Could not load staff records.");
      }
    };
    void refresh();
    const unsubscribers = [
      subscribeResidentConcerns(() => { void refresh(); }),
      subscribeResidentDirectory(() => { void refresh(); }),
      subscribeWalkInShifts(() => { void refresh(); }),
    ];
    return () => { active = false; unsubscribers.forEach((unsubscribe) => unsubscribe()); };
  }, []);

  const filteredResidents = useMemo(() => {
    const query = residentQuery.trim().toLowerCase();
    if (!query) return residents;
    return residents.filter((resident) =>
      [resident.name, resident.email, resident.contactNumber, resident.address]
        .some((value) => value.toLowerCase().includes(query))
    );
  }, [residentQuery, residents]);

  const updateConcernStatus = async (reference: string, status: ResidentConcern["status"]) => {
    try {
      await updateResidentConcern(reference, status);
      setConcerns(await getResidentConcerns());
      try {
        await sendResidentNotification({ type: "concern_status", reference, status });
        toast.success("Concern status updated; resident email notification sent.");
      } catch (notificationError) {
        console.error("Concern status updated, but its resident email could not be sent.", notificationError);
        toast.error(`Concern updated, but the resident email failed: ${notificationError instanceof Error ? notificationError.message : "Unknown email delivery error."}`);
      }
    } catch (error) {
      console.error("Unable to update resident concern status.", error);
      toast.error(error instanceof Error ? error.message : "Could not update concern.");
    }
  };

  const toggleConcernArchive = async (concern: ResidentConcern) => {
    try {
      await setResidentConcernArchived(concern.reference, !concern.archived);
      setConcerns(await getResidentConcerns());
      toast.success(concern.archived ? "Concern restored." : "Concern moved to the archive.");
    } catch (error) {
      console.error("Unable to update concern archive status.", error);
      toast.error(error instanceof Error ? error.message : "Could not update concern archive.");
    }
  };

  const startEditingResident = (resident: DirectoryResident) => {
    setEditingResidentId(resident.id);
    setResidentForm({
      firstName: resident.firstName,
      lastName: resident.lastName,
      contactNumber: resident.contactNumber,
      address: resident.address,
    });
  };

  const saveResident = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingResidentId) return;
    if (!residentForm.firstName.trim() || !residentForm.lastName.trim() || !residentForm.contactNumber.trim() || !residentForm.address.trim()) {
      toast.error("Complete all resident details before saving.");
      return;
    }
    setSavingResident(true);
    try {
      await updateResidentDirectoryEntry({ id: editingResidentId, ...residentForm });
      setResidents(await getResidentDirectory());
      setEditingResidentId(null);
      toast.success("Resident masterlist entry updated.");
    } catch (error) {
      console.error("Unable to save resident masterlist changes.", error);
      toast.error(error instanceof Error ? error.message : "Could not update resident.");
    } finally {
      setSavingResident(false);
    }
  };

  const addShift = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const shift: WalkInShift = {
      ...shiftForm,
      id: globalThis.crypto?.randomUUID?.() ?? `shift-${Date.now()}`,
      active: true,
    };
    try {
      await saveWalkInShifts([shift]);
      setShifts(await getWalkInShifts());
      setShiftForm({ staffName: "", role: "", days: "", hours: "" });
      setNotice("Walk-in schedule saved to the shared database.");
    } catch (error) {
      console.error("Unable to save walk-in schedule.", error);
      toast.error(error instanceof Error ? error.message : "Could not save schedule.");
    }
  };

  const toggleShift = async (id: string) => {
    const updated = shifts.map((shift) => shift.id === id ? { ...shift, active: !shift.active } : shift);
    try {
      await saveWalkInShifts(updated);
      setShifts(await getWalkInShifts());
    } catch (error) {
      console.error("Unable to update walk-in schedule.", error);
      toast.error(error instanceof Error ? error.message : "Could not update schedule.");
    }
  };

  return (
    <section className="overflow-hidden rounded-lg border border-[#d9e2da] bg-white shadow-sm">
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
                onClick={() => setShowArchivedConcerns(archived)}
                aria-pressed={showArchivedConcerns === archived}
                className={`flex min-h-10 items-center gap-2 rounded px-4 text-sm font-bold ${showArchivedConcerns === archived ? "bg-[#123323] text-white" : "border border-[#c9d1ca] bg-white text-[#53645b]"}`}
              >
                {archived ? <Archive className="h-4 w-4" /> : <MessageSquareText className="h-4 w-4" />}
                {archived ? "Archive" : "Active concerns"}
              </button>
            ))}
          </div>
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
                      {concern.reference} · {concern.name} · {concern.contact} · {new Date(concern.submittedAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    {!concern.archived && (
                      <label className="flex items-center gap-2 text-sm font-semibold text-[#34483a]">
                        Status
                        <select value={concern.status} onChange={(event) => updateConcernStatus(concern.reference, event.target.value as ResidentConcern["status"])} className={inputClass}>
                          <option value="RECEIVED">Received</option>
                          <option value="IN_REVIEW">In review</option>
                          <option value="RESOLVED">Resolved</option>
                        </select>
                      </label>
                    )}
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
          ) : <p className="p-6 text-sm text-[#53645b]">{showArchivedConcerns ? "There are no archived concerns." : "There are no active concerns."}</p>}
        </div>
      )}

      {initialTab === "residents" && (
        <div>
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#e3e8e3] p-5">
            <div>
              <h2 className="text-xl font-bold text-[#122d1f]">Resident masterlist</h2>
              <p className="mt-1 text-sm text-[#53645b]">Resident accounts in the shared database: {residents.length}.</p>
            </div>
            <label className="grid gap-1 text-sm font-semibold text-[#34483a]">
              Search residents
              <input value={residentQuery} onChange={(event) => setResidentQuery(event.target.value)} placeholder="Name, email, contact, address" className={`${inputClass} w-full sm:w-72`} />
            </label>
          </div>
          {filteredResidents.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-[#f7faf7] text-xs uppercase text-[#53645b]"><tr>
                  {["Resident", "Email", "Contact", "Address", "Registered", "Actions"].map((heading) => <th key={heading} className="px-4 py-3">{heading}</th>)}
                </tr></thead>
                <tbody className="divide-y divide-[#e3e8e3]">
                  {filteredResidents.map((resident) => (
                    <tr key={resident.id}>
                      <td className="px-4 py-3 text-sm font-semibold">{resident.name}</td>
                      <td className="px-4 py-3 text-sm">{resident.email || "Not provided"}</td>
                      <td className="px-4 py-3 text-sm">{resident.contactNumber}</td>
                      <td className="px-4 py-3 text-sm">{resident.address}</td>
                      <td className="px-4 py-3 text-sm">{new Date(resident.createdAt).toLocaleDateString()}</td>
                      <td className="px-4 py-3">
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
          ) : <p className="p-6 text-sm text-[#53645b]">{residents.length ? "No residents match that search." : "No residents have registered in this browser yet."}</p>}
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
                <button type="button" onClick={() => setEditingResidentId(null)} disabled={savingResident} className="min-h-11 rounded border border-[#c9d1ca] bg-white px-4 text-sm font-semibold text-[#53645b]">Cancel</button>
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
          <form onSubmit={addShift} className="grid gap-3 border-b border-[#e3e8e3] p-5 sm:grid-cols-2 xl:grid-cols-5">
            <label className="grid gap-1 text-xs font-bold text-[#53645b]">STAFF / SERVICE DESK<input required maxLength={80} value={shiftForm.staffName} onChange={(e) => setShiftForm({ ...shiftForm, staffName: e.target.value })} className={inputClass} /></label>
            <label className="grid gap-1 text-xs font-bold text-[#53645b]">ROLE / SERVICE<input required maxLength={80} value={shiftForm.role} onChange={(e) => setShiftForm({ ...shiftForm, role: e.target.value })} className={inputClass} /></label>
            <label className="grid gap-1 text-xs font-bold text-[#53645b]">DAYS<input required maxLength={80} placeholder="Mon–Fri" value={shiftForm.days} onChange={(e) => setShiftForm({ ...shiftForm, days: e.target.value })} className={inputClass} /></label>
            <label className="grid gap-1 text-xs font-bold text-[#53645b]">HOURS<input required maxLength={80} placeholder="8:00 AM–5:00 PM" value={shiftForm.hours} onChange={(e) => setShiftForm({ ...shiftForm, hours: e.target.value })} className={inputClass} /></label>
            <button type="submit" className="min-h-11 self-end rounded bg-[#123323] px-4 text-sm font-bold text-white">Add schedule</button>
          </form>
          {shifts.length ? <div className="divide-y divide-[#e3e8e3]">
            {shifts.map((shift) => <article key={shift.id} className="flex flex-wrap items-center justify-between gap-3 p-5">
              <div>
                <h3 className="font-bold text-[#122d1f]">{shift.staffName}</h3>
                <p className="text-sm text-[#53645b]">{shift.role} · {shift.days} · {shift.hours}</p>
              </div>
              <button type="button" onClick={() => toggleShift(shift.id)} className={`min-h-10 rounded border px-4 text-sm font-bold ${shift.active ? "border-green-300 bg-green-50 text-green-900" : "border-[#c9d1ca] bg-white text-[#53645b]"}`}>
                {shift.active ? "Published — hide" : "Hidden — publish"}
              </button>
            </article>)}
          </div> : <p className="p-6 text-sm text-[#53645b]">No schedule entries have been added.</p>}
          <p className="border-t border-[#e3e8e3] bg-amber-50 p-4 text-xs leading-relaxed text-amber-950">
            Confirm every staff assignment and service hour with the Barangay before publishing. Active shifts are visible to all portal visitors.
          </p>
        </div>
      )}
    </section>
  );
}
