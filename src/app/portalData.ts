import { requireSupabase, supabase } from "./supabase";

export type PostType = "NOTICE" | "ADVISORY" | "UPDATE";

export interface PublicPost {
  id: string;
  title: string;
  content: string;
  type: PostType;
  publishedAt: string;
  archived: boolean;
}

export type RequestStatus = "PENDING" | "APPROVED" | "COMPLETED" | "REJECTED";
export type DeliveryFormat = "Softcopy" | "Hardcopy" | "Both";

export interface AppointmentRequest {
  reference: string;
  ownerId: string;
  fullName: string;
  address: string;
  voterId: string;
  schoolIdImagePath: string | null;
  requestType: string;
  purpose: string;
  date: string;
  timeSlot: string;
  deliveryFormat: DeliveryFormat;
  status: RequestStatus;
  archived: boolean;
  submittedAt: string;
}

export interface TransactionMessage {
  id: string;
  authorId: string;
  author: string;
  role: "Resident" | "Staff";
  body: string;
  sentAt: string;
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
}

export interface DirectoryResident {
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
  id: string;
  staffName: string;
  role: string;
  days: string;
  hours: string;
  active: boolean;
}

interface PublicPostRow {
  id: string; title: string; content: string; type: PostType; published_at: string; archived: boolean;
}
interface AppointmentRow {
  reference: string; owner_id: string; full_name: string; address: string; voter_id: string;
  school_id_image_path: string | null;
  request_type: string; purpose: string; appointment_date: string; time_slot: string;
  delivery_format: DeliveryFormat; status: RequestStatus; archived: boolean; submitted_at: string;
}
interface MessageRow {
  id: string; author_id: string; author_name: string; author_role: "Resident" | "Staff";
  body: string; sent_at: string;
}
interface ConcernRow {
  reference: string; owner_id: string; name: string; contact: string; category: string;
  message: string; status: ResidentConcern["status"]; archived: boolean; submitted_at: string;
}
interface ShiftRow {
  id: string; staff_name: string; role: string; days: string; hours: string; active: boolean;
}

function toPost(row: PublicPostRow): PublicPost {
  return { id: row.id, title: row.title, content: row.content, type: row.type, publishedAt: row.published_at, archived: row.archived };
}
function toRequest(row: AppointmentRow): AppointmentRequest {
  return {
    reference: row.reference, ownerId: row.owner_id, fullName: row.full_name, address: row.address,
    voterId: row.voter_id, requestType: row.request_type, purpose: row.purpose, date: row.appointment_date,
    schoolIdImagePath: row.school_id_image_path,
    timeSlot: row.time_slot, deliveryFormat: row.delivery_format, status: row.status, archived: row.archived, submittedAt: row.submitted_at,
  };
}
function toConcern(row: ConcernRow): ResidentConcern {
  return {
    reference: row.reference, ownerId: row.owner_id, name: row.name, contact: row.contact,
    category: row.category, message: row.message, status: row.status, archived: row.archived, submittedAt: row.submitted_at,
  };
}
function toShift(row: ShiftRow): WalkInShift {
  return { id: row.id, staffName: row.staff_name, role: row.role, days: row.days, hours: row.hours, active: row.active };
}
function reportError(action: string, error: { message: string }): never {
  console.error(`Supabase ${action} failed:`, error);
  throw new Error(`${action} failed: ${error.message}`);
}

type ResidentNotification =
  | { type: "appointment_status"; reference: string; status: RequestStatus }
  | { type: "concern_status"; reference: string; status: ResidentConcern["status"] }
  | { type: "staff_reply"; reference: string; message: string };

export async function sendResidentNotification(notification: ResidentNotification): Promise<void> {
  const { error } = await requireSupabase().functions.invoke("notify-resident", { body: notification });
  if (!error) return;
  const context = error.context;
  if (context instanceof Response) {
    const payload = await context.clone().json() as { error?: unknown };
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
  const { data, error } = await requireSupabase().from("public_posts").select("*").order("published_at", { ascending: false });
  if (error) return reportError("loading announcements", error);
  return (data as PublicPostRow[]).map(toPost);
}

export async function savePublicPosts(posts: PublicPost[]): Promise<void> {
  if (!posts.length) return;
  const rows = posts.map((post) => ({
    id: post.id, title: post.title, content: post.content, type: post.type,
    published_at: post.publishedAt, archived: post.archived,
  }));
  const { error } = await requireSupabase().from("public_posts").upsert(rows, { onConflict: "id" });
  if (error) reportError("saving announcements", error);
}

export function subscribePublicPosts(onUpdate: () => void): () => void {
  return subscribeTable("public_posts", onUpdate);
}

export async function getAppointmentRequests(ownerId?: string): Promise<AppointmentRequest[]> {
  let query = requireSupabase().from("appointment_requests").select("*").order("submitted_at", { ascending: false });
  if (ownerId) query = query.eq("owner_id", ownerId);
  const { data, error } = await query;
  if (error) return reportError("loading appointment requests", error);
  return (data as AppointmentRow[]).map(toRequest);
}

export async function addAppointmentRequest(request: AppointmentRequest): Promise<void> {
  const { error } = await requireSupabase().from("appointment_requests").insert({
    reference: request.reference, owner_id: request.ownerId, full_name: request.fullName,
    address: request.address, voter_id: request.voterId, request_type: request.requestType,
    school_id_image_path: request.schoolIdImagePath,
    purpose: request.purpose, appointment_date: request.date, time_slot: request.timeSlot,
    delivery_format: request.deliveryFormat, status: "PENDING", archived: false,
  });
  if (error) reportError("submitting the appointment request", error);
}

export async function uploadSchoolIdImage(file: File, ownerId: string, reference: string): Promise<string> {
  const extensionByType: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };
  const extension = extensionByType[file.type];
  if (!extension) throw new Error("Upload a JPG, PNG, or WebP image of the school ID.");
  if (file.size > 5 * 1024 * 1024) throw new Error("The school ID image must be 5 MB or smaller.");

  const path = `${ownerId}/${reference}/school-id.${extension}`;
  const { error } = await requireSupabase().storage
    .from("resident-school-ids")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) reportError("uploading the school ID image", error);
  return path;
}

export async function removeSchoolIdImage(path: string): Promise<void> {
  const { error } = await requireSupabase().storage.from("resident-school-ids").remove([path]);
  if (error) reportError("removing an unsubmitted school ID image", error);
}

export async function getSchoolIdImageUrl(path: string): Promise<string> {
  const { data, error } = await requireSupabase()
    .storage
    .from("resident-school-ids")
    .createSignedUrl(path, 5 * 60);
  if (error) return reportError("opening a private school ID image", error);
  return data.signedUrl;
}

export async function updateAppointmentStatus(reference: string, status: RequestStatus): Promise<void> {
  const { error } = await requireSupabase().from("appointment_requests").update({ status }).eq("reference", reference);
  if (error) reportError("updating the appointment status", error);
}

export async function setAppointmentArchived(reference: string, archived: boolean): Promise<void> {
  const { error } = await requireSupabase().from("appointment_requests").update({ archived }).eq("reference", reference);
  if (error) reportError("updating appointment archive status", error);
}

export function subscribeAppointmentRequests(onUpdate: () => void): () => void {
  return subscribeTable("appointment_requests", onUpdate);
}

export async function getTransactionMessages(reference: string): Promise<TransactionMessage[]> {
  const { data, error } = await requireSupabase()
    .from("transaction_messages").select("*").eq("request_reference", reference).order("sent_at");
  if (error) return reportError("loading request messages", error);
  return (data as MessageRow[]).map((row) => ({
    id: row.id, authorId: row.author_id, author: row.author_name,
    role: row.author_role, body: row.body, sentAt: row.sent_at,
  }));
}

export async function addTransactionMessage(reference: string, message: TransactionMessage): Promise<void> {
  const authorId = await getCurrentUserId();
  const { error } = await requireSupabase().from("transaction_messages").insert({
    request_reference: reference, author_id: authorId, author_name: message.author,
    author_role: message.role, body: message.body,
  });
  if (error) reportError("sending the request message", error);
}

export function subscribeTransactionMessages(onUpdate: () => void): () => void {
  return subscribeTable("transaction_messages", onUpdate);
}

export async function getResidentConcerns(ownerId?: string): Promise<ResidentConcern[]> {
  let query = requireSupabase().from("resident_concerns").select("*").order("submitted_at", { ascending: false });
  if (ownerId) query = query.eq("owner_id", ownerId);
  const { data, error } = await query;
  if (error) return reportError("loading resident concerns", error);
  return (data as ConcernRow[]).map(toConcern);
}

export async function addResidentConcern(concern: ResidentConcern): Promise<void> {
  const { error } = await requireSupabase().from("resident_concerns").insert({
    reference: concern.reference, owner_id: concern.ownerId, name: concern.name,
    contact: concern.contact, category: concern.category, message: concern.message, archived: false,
  });
  if (error) reportError("submitting resident feedback", error);
}

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
  const { data, error } = await requireSupabase()
    .from("resident_profiles")
    .select("id, first_name, last_name, email, contact_number, address, created_at")
    .eq("role", "resident")
    .order("created_at", { ascending: false });
  if (error) return reportError("loading the resident directory", error);
  return data.map((row) => ({
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
  id: string;
  firstName: string;
  lastName: string;
  contactNumber: string;
  address: string;
}): Promise<void> {
  const { error } = await requireSupabase()
    .from("resident_profiles")
    .update({
      first_name: input.firstName.trim(),
      last_name: input.lastName.trim(),
      contact_number: input.contactNumber.trim(),
      address: input.address.trim(),
    })
    .eq("id", input.id);
  if (error) reportError("updating resident details", error);
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
  if (!shifts.length) return;
  const rows = shifts.map((shift) => ({
    id: shift.id, staff_name: shift.staffName, role: shift.role,
    days: shift.days, hours: shift.hours, active: shift.active, updated_at: new Date().toISOString(),
  }));
  const { error } = await requireSupabase().from("walk_in_shifts").upsert(rows, { onConflict: "id" });
  if (error) reportError("saving the walk-in schedule", error);
}

export function subscribeWalkInShifts(onUpdate: () => void): () => void {
  return subscribeTable("walk_in_shifts", onUpdate);
}

function subscribeTable(table: string, onUpdate: () => void): () => void {
  if (!supabase) return () => undefined;
  const channel = supabase
    .channel(`${table}-${crypto.randomUUID()}`)
    .on("postgres_changes", { event: "*", schema: "public", table }, onUpdate)
    .subscribe((status, error) => {
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        console.error(`Supabase Realtime subscription failed for ${table}.`, error);
      }
    });
  return () => { void supabase?.removeChannel(channel); };
}
