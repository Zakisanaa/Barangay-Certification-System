import {readAll,reliableSubscription,checkRevision} from './reliableData';
import { requireSupabase, supabase } from "./supabase";
import { setCertificateTemplateManifest } from './certificateTemplates';
import type { SupportingRequirement,TemplateVersion } from './adminData';

export interface DocumentService {
  revision?:number;
  request_type: string;
  requirements: string;
  fee_description: string;
  fee_amount?: number|null;
  processing_time: string;
  active: boolean;
  softcopy_available: boolean;
  updated_at: string;
}
export interface OfficeSettings {
  revision?:number;
  id: number;
  contact_number: string;
  contact_email: string;
  office_hours: string;
  address: string;
  booking_days_ahead: number;
  fee_tracking_enabled?: boolean;
}
export interface AppointmentSlot {revision?:number; label: string; start_time: string; end_time?:string; capacity: number; active: boolean }
export interface OfficeClosure { revision?:number; closed_date: string; reason: string }
export interface SlotAvailability extends AppointmentSlot { remaining: number; available: boolean; reason: string }
export interface ServiceConfiguration {
  services: DocumentService[];
  office: OfficeSettings;
  slots: AppointmentSlot[];
  closures: OfficeClosure[];
  requirements?: SupportingRequirement[];
  templates?: TemplateVersion[];
  weekdays?: {iso_day:number;open:boolean}[];
}
export interface RequestEvent {
  id: string; actor_name: string; status: string; description: string; created_at: string;
}
export interface CertificateDeliveryRecord {
  file_available?:boolean;provider_id?:string|null;pdf_hash?:string;
  id: string; request_reference: string; sender_name: string; recipient_email: string;
  template_name: string; storage_path: string; status: "pending" | "sent" | "delivered" | "delayed" | "bounced" | "failed";
  error_message: string | null; created_at: string; updated_at: string;
}
export interface EmailNotificationRecord {
  id: string; kind: string; subject: string; recipient_email: string;
  status: "pending" | "sending" | "retry" | "sent" | "failed" | "needs_review";
  attempts: number; last_error: string | null; created_at: string; updated_at: string;
}

export async function getServiceConfiguration(): Promise<ServiceConfiguration> {
  const client = requireSupabase();
  const [services, office, slots, closures,requirements,templates,weekdays] = await Promise.all([
    client.from("service_catalog").select("*").order("request_type"),
    client.from("office_settings").select("*").eq("id", 1).single(),
    client.from("appointment_slots").select("*").order("start_time"),
    client.from("office_closures").select("*").order("closed_date"),
    client.from('service_requirements').select('*').order('title'),
    client.from('certificate_templates').select('*').order('version',{ascending:false}),
    client.from('office_weekdays').select('*').order('iso_day'),
  ]);
  for (const result of [services, office, slots, closures,requirements,templates,weekdays]) {
    if (result.error) throw new Error(`Could not load service settings: ${result.error.message}`);
  }
  setCertificateTemplateManifest(templates.data!);
  return { services: services.data!, office: office.data!, slots: slots.data!, closures: closures.data!,requirements:requirements.data!,templates:templates.data!,weekdays:weekdays.data! };
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
  const { data,error } = await requireSupabase().from("service_catalog").update({
    requirements: service.requirements.trim(), fee_description: service.fee_description.trim(), fee_amount:service.fee_amount??null,
    processing_time: service.processing_time.trim(), active: service.active,
    softcopy_available: service.softcopy_available, updated_at: new Date().toISOString(),
  }).eq("request_type", service.request_type).eq("revision",service.revision??1).select("revision").single();
  checkRevision(error,data);service.revision=data!.revision;
}

export async function saveOfficeSettings(office: OfficeSettings): Promise<void> {
  const { data,error } = await requireSupabase().from("office_settings").update({
    contact_number: office.contact_number.trim(), contact_email: office.contact_email.trim(),
    office_hours: office.office_hours.trim(), address: office.address.trim(), booking_days_ahead: office.booking_days_ahead,
    fee_tracking_enabled:office.fee_tracking_enabled??false,
  }).eq("id", 1).eq("revision",office.revision??1).select("revision").single();
  checkRevision(error,data);office.revision=data!.revision;
}

export async function saveAppointmentSlot(slot: AppointmentSlot): Promise<void> {
  const {data,error}=await requireSupabase().from("appointment_slots").update({capacity:slot.capacity,active:slot.active}).eq("label",slot.label).eq("revision",slot.revision??1).select("revision").single();checkRevision(error,data);slot.revision=data!.revision;
}

export async function saveOfficeClosure(closure:OfficeClosure,reviewed=false):Promise<OfficeClosure>{const{data,error}=await requireSupabase().rpc('save_reviewed_closure',{p_date:closure.closed_date,p_reason:closure.reason.trim(),p_reviewed:reviewed,p_revision:closure.revision??null});if(error)throw new Error(error.message);return data;}
export async function removeOfficeClosure(day:string,revision:number=1){const{data,error}=await requireSupabase().from('office_closures').delete().eq('closed_date',day).eq('revision',revision).select('closed_date').single();checkRevision(error,data);}

export async function getRequestHistory(reference: string): Promise<{ events: RequestEvent[]; deliveries: CertificateDeliveryRecord[]; notifications: EmailNotificationRecord[] }> {
  const client = requireSupabase();
  const [events,deliveries,notifications]=await Promise.all([
    readAll<RequestEvent>((from,to)=>client.from('request_events').select('*').eq('request_reference',reference).order('created_at').order('id').range(from,to)),
    readAll<CertificateDeliveryRecord>((from,to)=>client.from('certificate_deliveries').select('id,request_reference,sender_name,recipient_email,template_name,storage_path,status,error_message,created_at,updated_at,file_available,provider_id,pdf_hash').eq('request_reference',reference).order('created_at',{ascending:false}).order('id').range(from,to)),
    readAll<EmailNotificationRecord>((from,to)=>client.from('notification_outbox').select('id,kind,subject,recipient_email,status,attempts,last_error,created_at,updated_at').eq('reference',reference).order('created_at',{ascending:false}).order('id').range(from,to))
  ]);return{events,deliveries,notifications};
}

export async function retryEmailNotification(id: string): Promise<void> {
  const { error } = await requireSupabase().rpc("retry_notification", { p_id: id });
  if (error) throw new Error(error.message);
}

export async function getCompletedCertificateUrl(path: string): Promise<string> {
  const { data, error } = await requireSupabase().storage.from("completed-certificates").createSignedUrl(path, 300, { download: true });
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

export function subscribeServiceData(tables:string[],onUpdate:()=>void){return reliableSubscription(tables,onUpdate);}
export async function retryCertificateDelivery(reference:string,id:string){const{error}=await requireSupabase().functions.invoke('notify-resident',{body:{type:'appointment_pdf_retry',reference,deliveryId:id}});if(error){const details=error.context instanceof Response?await error.context.clone().json().catch(()=>null):null;throw new Error(details?.error??error.message);} }
