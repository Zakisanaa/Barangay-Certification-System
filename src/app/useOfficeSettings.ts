import { useEffect, useState } from "react";
import { getOfficeSettings, subscribeServiceData } from "./serviceData";
import type { OfficeSettings } from "./serviceData";
import { isSupabaseConfigured } from "./supabase";

export function useOfficeSettings() {
  const [office, setOffice] = useState<OfficeSettings | null>(null);
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let active = true;
    const refresh = () => { void getOfficeSettings().then(data => { if (active) setOffice(data); }, () => { if (active) setOffice(null); }); };
    refresh();
    const unsubscribe = subscribeServiceData(["office_settings"], refresh);
    return () => { active = false; unsubscribe(); };
  }, []);
  return office;
}
