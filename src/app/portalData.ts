import {validateAnnouncementImage} from './announcementImages';
import {allPortalRows,portalList,reliableSubscription,checkRevision} from './reliableData';
import type {ListOptions} from './reliableData';
import { requireSupabase, supabase } from "./supabase";
import { validateProfileFields } from "./profileValidation";
import {readChatAttachments,sendChatMessage} from './chatAttachments';
import type {ChatAttachment} from './chatAttachments';

export type PostType = "NOTICE" | "ADVISORY" | "UPDATE";

export interface PublicPost {
  revision?:number;
  updatedAt?:string|null;
  id: string;
  title: string;
  content: string;
  type: PostType;
  publishedAt: string;
  archived: boolean;
  imagePath?: string | null;
  imageAlt?: string;
}

export const REQUEST_STATUSES = ["PENDING", "APPROVED", "COMPLETED", "REJECTED", "CANCELLED", "NO_SHOW", "EXPIRED"] as const;
export type RequestStatus = typeof REQUEST_STATUSES[number];
export type DeliveryFormat = "Softcopy" | "Hardcopy" | "Both";

export interface AppointmentRequest {
  reference: string;
  ownerId: string;
  fullName: string;
  address: string;
  voterId: string;
  idType?:string;idNumber?:string;idReviewAcknowledged?:boolean;idAcknowledgedAt?:string;idAcknowledgmentVersion?:string;
  schoolIdImagePath: string | null;
  requestType: string;
  purpose: string;
  date: string;
  timeSlot: string;
  deliveryFormat: DeliveryFormat;
  status: RequestStatus;
  archived: boolean;
  submittedAt: string;
  rejectionReason?: string | null;
  version: number;
  statusReason: string | null;
  rescheduleReason: string | null;
  hardcopyCollectedAt: string | null;
  hardcopyCollectedBy: string | null;
  hardcopyCollectedName: string | null;
}

export interface TransactionMessage {
  id: string;
  authorId: string;
  author: string;
  role: "Resident" | "Staff";
  body: string;
  sentAt: string;
  attachments?: ChatAttachment[];
}

export interface ResidentConcern {
  reference: string;
  ownerId: string;
  name: string;
  contact: string;
  category: string;
  message: string;
  status: "RECEIVED" | "IN_REVIEW" | "RESOLVED";
  archived: boolean;
  submittedAt: string;
  version?: number;
  resolutionNote?: string | null;
}

export interface DirectoryResident {
  revision?:number;
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  contactNumber: string;
  address: string;
  createdAt: string;
}

export interface WalkInShift {
  revision?:number;
  id: string;
  staffName: string;
  role: string;
  days: string;
  hours: string;
  active: boolean;
}

interface PublicPostRow {
  updated_at?:string|null;
  revision?:number;
  id: string; title: string; content: string; type: PostType; published_at: string; archived: boolean;
  image_path?: string | null; image_alt?: string;
}
interface AppointmentRow {
  reference: string; owner_id: string; full_name: string; address: string; voter_id: string;
  id_type?:string;id_number?:string;id_review_acknowledged?:boolean;id_acknowledged_at?:string;id_acknowledgment_version?:string;
  school_id_image_path: string | null;
  request_type: string; purpose: string; appointment_date: string; time_slot: string;
  delivery_format: DeliveryFormat; status: RequestStatus; archived: boolean; submitted_at: string;
  rejection_reason?: string | null;
  version: number; status_reason: string | null; reschedule_reason: string | null;
  hardcopy_collected_at: string | null; hardcopy_collected_by: string | null; hardcopy_collected_name: string | null;
}
interface MessageRow {
  id: string; author_id: string; author_name: string; author_role: "Resident" | "Staff";
  body: string; sent_at: string;
}
interface ConcernRow {
  reference: string; owner_id: string; name: string; contact: string; category: string;
  message: string; status: ResidentConcern["status"]; archived: boolean; submitted_at: string;
  version?: number; resolution_note?: string | null;
}
interface ShiftRow {
  revision?:number;
  id: string; staff_name: string; role: string; days: string; hours: string; active: boolean;
}

function toPost(row: PublicPostRow): PublicPost {
  return { updatedAt:row.updated_at,revision:row.revision,id: row.id, title: row.title, content: row.content, type: row.type, publishedAt: row.published_at, archived: row.archived, imagePath: row.image_path, imageAlt: row.image_alt ?? "" };
}
function toRequest(row: AppointmentRow): AppointmentRequest {
  return {
    reference: row.reference, ownerId: row.owner_id, fullName: row.full_name, address: row.address,
    idType:row.id_type,idNumber:row.id_number,idReviewAcknowledged:row.id_review_acknowledged,idAcknowledgedAt:row.id_acknowledged_at,idAcknowledgmentVersion:row.id_acknowledgment_version,
    voterId: row.voter_id, requestType: row.request_type, purpose: row.purpose, date: row.appointment_date,
    schoolIdImagePath: row.school_id_image_path,
    timeSlot: row.time_slot, deliveryFormat: row.delivery_format, status: row.status, archived: row.archived, submittedAt: row.submitted_at,
    rejectionReason: row.rejection_reason ?? null,
    version: row.version, statusReason: row.status_reason, rescheduleReason: row.reschedule_reason,
    hardcopyCollectedAt: row.hardcopy_collected_at, hardcopyCollectedBy: row.hardcopy_collected_by,
    hardcopyCollectedName: row.hardcopy_collected_name,
  };
}
function toConcern(row: ConcernRow): ResidentConcern {
  return {
    reference: row.reference, ownerId: row.owner_id, name: row.name, contact: row.contact,
    category: row.category, message: row.message, status: row.status, archived: row.archived, submittedAt: row.submitted_at, version: row.version, resolutionNote: row.resolution_note,
  };
}
function toShift(row: ShiftRow): WalkInShift {
  return { revision:row.revision,id: row.id, staffName: row.staff_name, role: row.role, days: row.days, hours: row.hours, active: row.active };
}
function reportError(action: string, error: { message: string }): never {
  console.error(`Supabase ${action} failed:`, error);
  throw new Error(`${action} failed: ${error.message}`);
}

type ResidentNotification =
  | { type: "appointment_status"; reference: string; status: RequestStatus }
  | { type: "appointment_pdf"; reference: string; templateName: string; pdfBase64: string; deliveryId: string }
  | { type: "concern_status"; reference: string; status: ResidentConcern["status"] }
  | { type: "staff_reply"; reference: string; message: string };

export async function sendResidentNotification(notification: ResidentNotification): Promise<void> {
  const { error } = await requireSupabase().functions.invoke("notify-resident", { body: notification });
  if (!error) return;
  const context = error.context;
  if (context instanceof Response) {
    const payload = await context.clone().json().catch(()=>({error:null})) as { error?: unknown };
    if (typeof payload.error === "string") {
      throw new Error(payload.error);
    }
  }
  reportError("sending resident email notification", error);
}

async function getCurrentUserId(): Promise<string> {
  const client = requireSupabase();
  const { data, error } = await client.auth.getUser();
  if (error) return reportError("checking the signed-in account", error);
  if (!data.user) throw new Error("Sign in to continue.");
  return data.user.id;
}

export async function getPublicPosts(): Promise<PublicPost[]> {
  return (await allPortalRows<PublicPostRow>("posts")).map(toPost);
}

export async function savePublicPosts(posts:PublicPost[]){for(const post of posts)await savePublicPost(post);}

export async function savePublicPost(post: PublicPost): Promise<void> {
 const fields={title:post.title,content:post.content,type:post.type,published_at:post.publishedAt,archived:post.archived,image_path:post.imagePath??null,image_alt:post.imageAlt??''};
 const result=post.revision?await requireSupabase().from('public_posts').update(fields).eq('id',post.id).eq('revision',post.revision).select('revision,updated_at').single():await requireSupabase().from('public_posts').insert({id:post.id,...fields}).select('revision,updated_at').single();
 checkRevision(result.error,result.data);post.revision=result.data!.revision;post.updatedAt=result.data!.updated_at;
}

export async function setPublicPostArchived(id: string, archived: boolean,revision:number=1): Promise<void> {
  const {data,error}=await requireSupabase().from("public_posts").update({archived}).eq("id",id).eq("revision",revision).select("revision").single();checkRevision(error,data);
}

export function subscribePublicPosts(onUpdate: () => void): () => void {
  return subscribeTable("public_posts", onUpdate);
}

export async function getAppointmentRequests(ownerId?: string): Promise<AppointmentRequest[]> {
  return (await allPortalRows<AppointmentRow>("requests",{owner:ownerId})).map(toRequest);
}

export async function getAppointmentRequest(reference: string): Promise<AppointmentRequest> {
  const { data, error } = await requireSupabase().from("appointment_requests").select("*").eq("reference", reference).single();
  if (error) throw new Error(error.message);
  return toRequest(data as AppointmentRow);
}

export async function addAppointmentRequest(request: AppointmentRequest,attachments:{id:string;requirement_id:string;storage_path:string}[]=[]): Promise<void> {
  const { error } = await requireSupabase().rpc('submit_document_request',{p_request:{
    reference: request.reference, owner_id: request.ownerId, full_name: request.fullName,
    address: request.address, voter_id: request.voterId, request_type: request.requestType,
    school_id_image_path: request.schoolIdImagePath,id_type:request.idType,id_number:request.idNumber,id_review_acknowledged:request.idReviewAcknowledged===true,
    purpose: request.purpose, appointment_date: request.date, time_slot: request.timeSlot,
    delivery_format: request.deliveryFormat, status: "PENDING", archived: false,
  },p_attachments:attachments});
  if (error) reportError("submitting the appointment request", error);
}

export async function uploadSchoolIdImage(file: File, ownerId: string, reference: string): Promise<string> {
  await validateAnnouncementImage(file);
  const extensionByType: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };
  const extension = extensionByType[file.type];
  if (!extension) throw new Error("Upload a JPG, PNG, or WebP image of your valid ID.");
  if (!file.size || file.size > 5 * 1024 * 1024) throw new Error("Choose a nonempty ID image no larger than 5 MB.");

  // Preserve the existing private bucket/column for older bookings; each attempt gets its own immutable file.
  const path = `${ownerId}/${reference}/${crypto.randomUUID()}/school-id.${extension}`;
  const { error } = await requireSupabase().storage
    .from("resident-school-ids")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) reportError("uploading your ID image", error);
  return path;
}

export async function removeSchoolIdImage(path: string): Promise<void> {
  const { error } = await requireSupabase().storage.from("resident-school-ids").remove([path]);
  if (error) reportError("removing an unsubmitted ID image", error);
}

export async function getSchoolIdImageUrl(path: string): Promise<string> {
  const { data, error } = await requireSupabase()
    .storage
    .from("resident-school-ids")
    .createSignedUrl(path, 5 * 60);
  if (error) return reportError("opening a private ID image", error);
  return data.signedUrl;
}

export async function getCertificateTemplateUrl(fileName: string): Promise<string> {
  const { data, error } = await requireSupabase()
    .storage
    .from("certificate-templates")
    .createSignedUrl(fileName, 5 * 60, { download: fileName });
  if (error) return reportError("opening a private certificate template", error);
  return data.signedUrl;
}

export async function getCertificateTemplateFile(fileName: string): Promise<ArrayBuffer> {
  const { data, error } = await requireSupabase()
    .storage
    .from("certificate-templates")
    .download(fileName);
  if (error) return reportError("downloading a private certificate template", error);
  return data.arrayBuffer();
}

export type AppointmentAction = "approve" | "reject" | "complete" | "cancel" | "no_show" | "reschedule" | "collect";

export async function manageAppointment(request: AppointmentRequest, action: AppointmentAction, details: {
  reason?: string; date?: string; timeSlot?: string; recipient?: string;
} = {}): Promise<AppointmentRequest> {
  const { data, error } = await requireSupabase().rpc("manage_appointment", {
    p_reference: request.reference, p_action: action, p_expected_version: request.version,
    p_reason: details.reason?.trim() ?? null, p_date: details.date ?? null,
    p_time_slot: details.timeSlot ?? null, p_recipient: details.recipient?.trim() ?? null,
  });
  if (error) throw new Error(error.message);
  return toRequest(data as AppointmentRow);
}

export async function updateAppointmentStatus(request: AppointmentRequest, status: RequestStatus, reason?: string): Promise<AppointmentRequest> {
  const actions: Partial<Record<RequestStatus, AppointmentAction>> = { APPROVED: "approve", REJECTED: "reject", COMPLETED: "complete", CANCELLED: "cancel", NO_SHOW: "no_show" };
  const action = actions[status];
  if (!action) throw new Error("This status is managed automatically.");
  return manageAppointment(request, action, { reason });
}

export async function setAppointmentArchived(reference: string, archived: boolean): Promise<void> {
  const { error } = await requireSupabase().from("appointment_requests").update({ archived }).eq("reference", reference);
  if (error) reportError("updating appointment archive status", error);
}

export function subscribeAppointmentRequests(onUpdate: () => void): () => void {
  return subscribeTable("appointment_requests", onUpdate);
}

export async function getTransactionMessages(reference: string): Promise<TransactionMessage[]> {
  const rows:MessageRow[]=[];
  for(let page=0;;page++){const {data,error}=await requireSupabase().from('transaction_messages').select('*').eq('request_reference',reference).order('sent_at').order('id').range(page*500,page*500+499);if(error)return reportError('loading request messages',error);rows.push(...data);if(data.length<500)break;}
  const attachments=await readChatAttachments('request',reference);
  return rows.map((row) => ({
    id: row.id, authorId: row.author_id, author: row.author_name,
    role: row.author_role, body: row.body, sentAt: row.sent_at,attachments:attachments.filter(file=>file.request_message_id===row.id),
  }));
}

export async function addTransactionMessage(reference: string, message: TransactionMessage,files:File[]=[]): Promise<TransactionMessage> {
  const row=await sendChatMessage<MessageRow>('request',reference,message.id,message.body,files);
  return{id:row.id,authorId:row.author_id,author:row.author_name,role:row.author_role,body:row.body,sentAt:row.sent_at,attachments:row.attachments};
}

export function subscribeTransactionMessages(onUpdate: () => void): () => void {
  const messages=subscribeTable('transaction_messages',onUpdate),attachments=subscribeTable('chat_attachments',onUpdate);return()=>{messages();attachments();};
}

export async function getResidentConcerns(ownerId?: string): Promise<ResidentConcern[]> {
  return (await allPortalRows<ConcernRow>("concerns",{owner:ownerId})).map(toConcern);
}

export async function addResidentConcern(concern:ResidentConcern):Promise<ResidentConcern>{const{data,error}=await requireSupabase().rpc('submit_resident_concern',{p_id:concern.reference.replace(/^CON-/,''),p_contact:concern.contact,p_category:concern.category,p_message:concern.message});if(error)throw new Error(error.message);return toConcern(data);}

export async function updateResidentConcern(reference: string, status: ResidentConcern["status"]): Promise<void> {
  const { error } = await requireSupabase().from("resident_concerns").update({ status }).eq("reference", reference);
  if (error) reportError("updating resident feedback status", error);
}

export async function setResidentConcernArchived(reference: string, archived: boolean): Promise<void> {
  const { error } = await requireSupabase().from("resident_concerns").update({ archived }).eq("reference", reference);
  if (error) reportError("updating concern archive status", error);
}

export function subscribeResidentConcerns(onUpdate: () => void): () => void {
  return subscribeTable("resident_concerns", onUpdate);
}

export async function getResidentDirectory(): Promise<DirectoryResident[]> {
  const data=await allPortalRows<any>("residents");
  return data.map((row) => ({
    revision:row.revision,
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    name: `${row.first_name} ${row.last_name}`.trim(),
    email: row.email ?? "",
    contactNumber: row.contact_number,
    address: row.address,
    createdAt: row.created_at,
  }));
}

export async function updateResidentDirectoryEntry(input: {
  revision?:number;
  id: string;
  firstName: string;
  lastName: string;
  contactNumber: string;
  address: string;
}): Promise<void> {
  const fields = validateProfileFields(input);
  const { data,error } = await requireSupabase()
    .from("resident_profiles")
    .update({
      first_name: fields.firstName,
      last_name: fields.lastName,
      contact_number: fields.contactNumber,
      address: fields.address,
    })
    .eq("id", input.id).eq("revision",input.revision??1).select("id").single();
  checkRevision(error,data);
}

export function subscribeResidentDirectory(onUpdate: () => void): () => void {
  return subscribeTable("resident_profiles", onUpdate);
}

export async function getWalkInShifts(): Promise<WalkInShift[]> {
  const { data, error } = await requireSupabase().from("walk_in_shifts").select("*").order("days");
  if (error) return reportError("loading the walk-in schedule", error);
  return (data as ShiftRow[]).map(toShift);
}

export async function saveWalkInShifts(shifts: WalkInShift[]): Promise<void> {
  for(const shift of shifts){const{data,error}=await requireSupabase().rpc("save_walk_in_shift",{p_id:shift.id,p_staff:shift.staffName,p_role:shift.role,p_days:shift.days,p_hours:shift.hours,p_active:shift.active,p_revision:shift.revision??null});if(error)throw new Error(error.message);shift.revision=data.revision;}
  return;
}

export function subscribeWalkInShifts(onUpdate: () => void): () => void {
  return subscribeTable("walk_in_shifts", onUpdate);
}

function subscribeTable(table:string,onUpdate:()=>void){return reliableSubscription([table],onUpdate);}
export async function getAppointmentRequestPage(options:ListOptions={}){const page=await portalList<AppointmentRow>('requests',options);return{...page,rows:page.rows.map(toRequest)};}
export async function getConcernPage(options:ListOptions={}){const page=await portalList<ConcernRow>('concerns',options);return{...page,rows:page.rows.map(toConcern)};}
export async function getResidentPage(options:ListOptions={}){const page=await portalList<any>('residents',options);return{...page,rows:page.rows.map(row=>({id:row.id,firstName:row.first_name,lastName:row.last_name,name:row.first_name+' '+row.last_name,email:row.email??'',contactNumber:row.contact_number,address:row.address,createdAt:row.created_at,revision:row.revision})) as DirectoryResident[]};}
export async function getPostPage(options:ListOptions={}){const page=await portalList<PublicPostRow>('posts',options);return{...page,rows:page.rows.map(toPost)};}
export async function getRequestSummary(){const{data,error}=await requireSupabase().rpc('request_summary');if(error)throw new Error(error.message);return data as {total:number;pending:number;approved:number;served:number;statuses:Record<string,number>;months:Record<string,number>;types:{name:string;count:number}[]};}
