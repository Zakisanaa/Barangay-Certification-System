import { requireSupabase, supabase } from "./supabase";

export interface DocumentService {
  request_type: string;
  requirements: string;
  fee_description: string;
  processing_time: string;
  active: boolean;
  softcopy_available: boolean;
  updated_at: string;
}
export interface OfficeSettings {
  id: number;
  contact_number: string;
  contact_email: string;
  office_hours: string;
  address: string;
  booking_days_ahead: number;
}
export interface AppointmentSlot { label: string; start_time: string; capacity: number; active: boolean }
export interface OfficeClosure { closed_date: string; reason: string }
export interface SlotAvailability extends AppointmentSlot { remaining: number; available: boolean; reason: string }
export interface ServiceConfiguration {
  services: DocumentService[];
  office: OfficeSettings;
  slots: AppointmentSlot[];
  closures: OfficeClosure[];
}
export interface RequestEvent {
  id: string; actor_name: string; status: string; description: string; created_at: string;
}
export interface CertificateDeliveryRecord {
  id: string; request_reference: string; sender_name: string; recipient_email: string;
  template_name: string; storage_path: string; status: "pending" | "sent" | "delivered" | "delayed" | "bounced" | "failed";
  error_message: string | null; created_at: string; updated_at: string;
}

export async function getServiceConfiguration(): Promise<ServiceConfiguration> {
  const client = requireSupabase();
  const [services, office, slots, closures] = await Promise.all([
    client.from("service_catalog").select("*").order("request_type"),
    client.from("office_settings").select("*").eq("id", 1).single(),
    client.from("appointment_slots").select("*").order("start_time"),
    client.from("office_closures").select("*").order("closed_date"),
  ]);
  for (const result of [services, office, slots, closures]) {
    if (result.error) throw new Error(`Could not load service settings: ${result.error.message}`);
  }
  return { services: services.data!, office: office.data!, slots: slots.data!, closures: closures.data! };
}

export async function getSlotAvailability(day: string): Promise<SlotAvailability[]> {
  const { data, error } = await requireSupabase().rpc("get_slot_availability", { day });
  if (error) throw new Error(error.message);
  return data;
}

export async function getOfficeSettings(): Promise<OfficeSettings> {
  const { data, error } = await requireSupabase().from("office_settings").select("*").eq("id", 1).single();
  if (error) throw new Error(error.message);
  return data;
}

export async function saveDocumentService(service: DocumentService): Promise<void> {
  const { error } = await requireSupabase().from("service_catalog").update({
    requirements: service.requirements.trim(), fee_description: service.fee_description.trim(),
    processing_time: service.processing_time.trim(), active: service.active,
    softcopy_available: service.softcopy_available, updated_at: new Date().toISOString(),
  }).eq("request_type", service.request_type);
  if (error) throw new Error(error.message);
}

export async function saveOfficeSettings(office: OfficeSettings): Promise<void> {
  const { error } = await requireSupabase().from("office_settings").update({
    contact_number: office.contact_number.trim(), contact_email: office.contact_email.trim(),
    office_hours: office.office_hours.trim(), address: office.address.trim(), booking_days_ahead: office.booking_days_ahead,
  }).eq("id", 1);
  if (error) throw new Error(error.message);
}

export async function saveAppointmentSlot(slot: AppointmentSlot): Promise<void> {
  const { error } = await requireSupabase().from("appointment_slots").update({ capacity: slot.capacity, active: slot.active }).eq("label", slot.label);
  if (error) throw new Error(error.message);
}

export async function saveOfficeClosure(closure: OfficeClosure): Promise<void> {
  const { error } = await requireSupabase().from("office_closures").upsert(closure);
  if (error) throw new Error(error.message);
}

export async function removeOfficeClosure(day: string): Promise<void> {
  const { error } = await requireSupabase().from("office_closures").delete().eq("closed_date", day);
  if (error) throw new Error(error.message);
}

export async function getRequestHistory(reference: string): Promise<{ events: RequestEvent[]; deliveries: CertificateDeliveryRecord[] }> {
  const client = requireSupabase();
  const [events, deliveries] = await Promise.all([
    client.from("request_events").select("*").eq("request_reference", reference).order("created_at"),
    client.from("certificate_deliveries").select("*").eq("request_reference", reference).order("created_at", { ascending: false }),
  ]);
  if (events.error || deliveries.error) throw new Error(events.error?.message ?? deliveries.error!.message);
  return { events: events.data!, deliveries: deliveries.data! };
}

export async function getCompletedCertificateUrl(path: string): Promise<string> {
  const { data, error } = await requireSupabase().storage.from("completed-certificates").createSignedUrl(path, 300, { download: true });
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

export function subscribeServiceData(tables: string[], onUpdate: () => void): () => void {
  if (!supabase) return () => {};
  const channel = supabase.channel(`services-${crypto.randomUUID()}`);
  for (const table of tables) channel.on("postgres_changes", { event: "*", schema: "public", table }, onUpdate);
  channel.subscribe();
  return () => { void supabase?.removeChannel(channel); };
}
