import { useEffect, useState } from "react";
import { CalendarClock } from "lucide-react";
import { toast } from "sonner";
import { getWalkInShifts, subscribeWalkInShifts, WalkInShift } from "../portalData";

export default function WalkInSchedulePage() {
  const [shifts, setShifts] = useState<WalkInShift[]>([]);
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const loaded = await getWalkInShifts();
        if (active) setShifts(loaded);
      } catch (error) {
        console.error("Unable to load walk-in schedule.", error);
        if (active) toast.error(error instanceof Error ? error.message : "Could not load schedule.");
      }
    };
    void refresh();
    const unsubscribe = subscribeWalkInShifts(() => { void refresh(); });
    return () => { active = false; unsubscribe(); };
  }, []);

  return (
    <div className="min-h-full bg-[#f4f7f4] p-4 md:p-7">
      <div className="mx-auto max-w-4xl">
        <header className="mb-5">
          <p className="text-sm font-bold uppercase tracking-wide text-[#53645b]">Plan your visit</p>
          <h1 className="mt-1 text-3xl font-black text-[#122d1f]">Walk-in staff schedule</h1>
          <p className="mt-2 text-base text-[#53645b]">Check the posted service hours before visiting the Barangay Hall.</p>
        </header>
        <div className="overflow-hidden rounded-lg border border-[#d9e2da] bg-white">
          <div className="flex items-center gap-3 border-b border-[#d9e2da] bg-[#f7faf7] p-4">
            <CalendarClock className="h-5 w-5 text-[#123323]" />
            <div>
              <h2 className="text-base font-bold text-[#122d1f]">Service desk availability</h2>
              <p className="text-sm text-[#53645b]">Hours may change on holidays or during official events.</p>
            </div>
          </div>
          {shifts.filter((shift) => shift.active).length ? (
            <div className="divide-y divide-[#e3e8e3]">
              {shifts.filter((shift) => shift.active).map((shift) => (
                <article key={shift.id} className="grid gap-2 p-5 sm:grid-cols-[1fr_auto] sm:items-center">
                  <div>
                    <h3 className="text-lg font-bold text-[#122d1f]">{shift.staffName}</h3>
                    <p className="text-sm text-[#53645b]">{shift.role}</p>
                  </div>
                  <div className="text-sm font-semibold text-[#34483a] sm:text-right">
                    <p>{shift.days}</p>
                    <p className="mt-1">{shift.hours}</p>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="p-6 text-base text-[#53645b]">No walk-in schedule has been posted. Please contact the Barangay Hall.</p>
          )}
        </div>
        <p className="mt-4 rounded border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-950">
          Published schedules are shared from the Barangay database. Confirm staff assignments and service hours with the Barangay before relying on a posted entry.
        </p>
      </div>
    </div>
  );
}
