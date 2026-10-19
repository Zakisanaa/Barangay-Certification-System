import {reliableSubscription} from './reliableData';
import { requireSupabase, supabase } from './supabase';
import { validateAnnouncementImage } from './announcementImages';
import type {ChatAttachment} from './chatAttachments';

export const STAFF_PERMISSIONS = ['requests','certificates','residents','concerns','schedules','content','settings','knowledge','reports','payments','audit'] as const;
export type StaffPermission = typeof STAFF_PERMISSIONS[number];
export interface StaffAccess { user_id: string; name: string; email: string | null; active: boolean; superadmin: boolean; permissions: StaffPermission[]; version: number; email_confirmed?: boolean }
export interface ConcernMessage { id: string; reference: string; author_name: string; staff: boolean; internal: boolean; body: string; created_at: string;attachments?:ChatAttachment[] }
export interface ConcernEvent { id: string; reference: string; actor_name: string; description: string; status: string; created_at: string }
export interface Verification { id: string; resident_id: string; kind: 'identity'|'residency'; status: 'unverified'|'in_review'|'verified'|'needs_correction'|'rejected'; review_method: string|null; note: string; reviewed_at: string|null; reviewed_by: string|null; version: number }
export interface Evidence { id: string; resident_id: string; kind: 'identity'|'residency'; label: string; storage_path: string; created_at: string }
export interface SupportingRequirement { id: string; request_type: string; title: string; instructions: string; required: boolean; active: boolean; version: number }
export interface RequestAttachment { id: string; request_reference: string; requirement_id: string; requirement_title: string; owner_id: string; storage_path: string; status: 'SUBMITTED'|'ACCEPTED'|'REPLACEMENT_REQUESTED'|'REPLACED'; review_note: string|null; version: number; created_at: string }
export interface TemplateVersion { id: string; request_type: string; label: string; storage_path: string; version: number; active: boolean }
export interface WalkInTransaction { id: string; reference: string; full_name: string; contact: string; request_type: string; purpose: string; status: 'WAITING'|'IN_PROGRESS'|'COMPLETED'|'CANCELLED'; assigned_to: string|null; reason: string|null; created_at: string; completed_at: string|null; version: number }
export interface CertificateRegister { id: string; display_reference?:string; register_number: string; official_number: string|null; request_reference: string|null; walk_in_id: string|null; signatory: string; status: 'ISSUED'|'SUPERSEDED'|'REVOKED'; issued_at: string; replaces: string|null; replacement_reason: string|null; revocation_reason: string|null; version: number }
export interface FeeRecord { id: string; display_reference?:string; corrected?:boolean; correction_status?:string|null; payment_method?:string; payer_reference?:string|null; request_reference: string|null; walk_in_id: string|null; amount: number; currency: string; status: 'PAID'|'EXEMPT'|'WAIVED'|'REFUNDED'|'VOIDED'; receipt_reference: string|null; note: string; recorded_at: string; previous_record: string|null }
export interface StaffNotification { outbox_id?:string|null; id: string; permission: StaffPermission; kind: string; reference: string|null; title: string; body: string; created_at: string }
export interface Official { name: string; role: string; image: string }
export interface LeadershipImage { image:string;alt:string }
export interface PublicStatement extends LeadershipImage { text:string }
export interface SiteContent { key: 'mission'|'vision'|'about'|'officials'|'leadership'; value: string|Official[]|LeadershipImage|PublicStatement; version: number; updated_at: string }
export interface AffectedAppointment { reference: string; full_name: string; appointment_date: string; time_slot: string; status: string }
export interface AuditRecord { id: string; actor_name: string; entity: string; record_id: string; action: string; before_data: Record<string,unknown>|null; after_data: Record<string,unknown>|null; created_at: string }
export const timeInManila = (value: string) => new Date(value).toLocaleString('en-PH',{timeZone:'Asia/Manila',dateStyle:'medium',timeStyle:'short'});
export const todayInManila = () => new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());

export async function adminRpc<T>(name: string, parameters: Record<string,unknown> = {}): Promise<T> {
 const {data,error}=await requireSupabase().rpc(name,parameters);if(error)throw new Error(error.message);return data as T;
}
export async function readAdminPage<T>(table: string, options: {page?:number;order?:string;ascending?:boolean;filters?:Record<string,string|boolean>;from?:{field:string;value:string};to?:{field:string;value:string}} = {}) {
 let query=requireSupabase().from(table).select('*',{count:'exact'}).order(options.order??'created_at',{ascending:options.ascending??false});
 for(const [field,value] of Object.entries(options.filters??{}))query=query.eq(field,value);
 if(options.from)query=query.gte(options.from.field,options.from.value);if(options.to)query=query.lte(options.to.field,options.to.value);
 const start=(options.page??0)*25;const {data,error,count}=await query.range(start,start+24);if(error)throw new Error(error.message);return{rows:data as T[],total:count??0};
}
export function subscribeAdminTables(tables:string[],refresh:()=>void){return reliableSubscription(tables,refresh);}
export const getStaffDirectory = () => adminRpc<StaffAccess[]>('staff_directory');
export async function privateFileUrl(bucket:string,path:string) {const {data,error}=await requireSupabase().storage.from(bucket).createSignedUrl(path,300);if(error)throw new Error(error.message);return data.signedUrl;}
export async function validatePrivateFile(file:File) {
 if(!file.size||file.size>5*1024*1024)throw new Error('Choose a nonempty PDF, JPG, PNG, or WebP no larger than 5 MB.');
 let extension:string;
 if(file.type==='application/pdf'){if(new TextDecoder().decode(await file.slice(0,5).arrayBuffer())!=='%PDF-')throw new Error('Choose a valid PDF.');extension='pdf';}
 else{const checked=await validateAnnouncementImage(file);extension=checked.format;}
 return extension;
}
export async function uploadPrivateFile(bucket:'resident-evidence'|'request-attachments',folder:string,file:File) {
 const extension=await validatePrivateFile(file);
 const path=`${folder}/${crypto.randomUUID()}.${extension}`;const {error}=await requireSupabase().storage.from(bucket).upload(path,file,{contentType:file.type,upsert:false});if(error)throw new Error(error.message);return path;
}
export async function removeUnusedPrivateFile(bucket:string,path:string) {const {error}=await requireSupabase().storage.from(bucket).remove([path]);if(error)console.error('Could not remove an unused private upload.');}
export function downloadCsv(name:string,rows:Record<string,unknown>[]) {
 const columns=[...new Set(rows.flatMap(row=>Object.keys(row)))];
 const quote=(value:unknown)=>{let text=value==null?'':String(value);if(/^[\s]*[=+\-@]/.test(text))text="'"+text;return'"'+text.replaceAll('"','""')+'"';};
 const csv='\uFEFF'+[columns.map(quote).join(','),...rows.map(row=>columns.map(key=>quote(row[key])).join(','))].join('\r\n');
 const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const anchor=document.createElement('a');anchor.href=url;anchor.download=name;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
