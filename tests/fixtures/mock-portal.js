import {reliableSubscription} from './reliableData';
import {readChatAttachments,sendChatMessage} from './chatAttachments';
const state = () => window.__review;
export const REQUEST_STATUSES = ['PENDING','APPROVED','COMPLETED','REJECTED','CANCELLED','NO_SHOW','EXPIRED'];
export async function getAppointmentRequests(owner) { return structuredClone(state().requests.filter(request => !owner || request.ownerId === owner)); }
export async function getAppointmentRequest(reference) { const request=state().requests.find(request=>request.reference===reference);if(!request)throw new Error('Request not found');return structuredClone(request); }
export function subscribeAppointmentRequests(callback) { state().refreshRequests = callback; const stop=reliableSubscription(['appointment_requests'],callback);return () => { stop();state().refreshRequests = null; }; }
export async function addAppointmentRequest(request,attachments=[]) { if(!request.schoolIdImagePath)throw new Error('Attach an image of your valid ID before booking an appointment.');if(state().failBookingSave)throw new Error('Simulated booking save failure.');state().requests.push({...request});state().bookingSupportingUploads=structuredClone(attachments); }
export async function getCertificateTemplateFile(name) { state().downloads.push(name); return new TextEncoder().encode('mock DOCX').buffer; }
export async function sendResidentNotification(input) {
  state().notifications.push(input);
  if(input.type==='appointment_pdf'){
    state().deliveries.push({id:input.deliveryId,request_reference:input.reference,sender_name:'Test Staff',recipient_email:'resident@example.test',template_name:input.templateName,storage_path:'mock-saved.pdf',status:'sent',file_available:true,provider_id:'provider-test',error_message:null,created_at:new Date().toISOString(),updated_at:new Date().toISOString()});
    for(const refresh of state().serviceCallbacks??[])refresh();
  }
}
export async function manageAppointment(original, action, details={}) {
  if(state().appointmentActionError?.action===action)throw new Error(state().appointmentActionError.message);
  const request=state().requests.find(request=>request.reference===original.reference);
  if(request.version!==original.version)throw new Error('This request changed. Refresh its details before trying again.');
  if(action==='reschedule'){request.date=details.date;request.timeSlot=details.timeSlot;request.rescheduleReason=details.reason;}
  else if(action==='collect'){request.hardcopyCollectedAt=new Date().toISOString();request.hardcopyCollectedBy=state().staff.id;request.hardcopyCollectedName=details.recipient;}
  else {request.status=({approve:'APPROVED',reject:'REJECTED',complete:'COMPLETED',cancel:'CANCELLED',no_show:'NO_SHOW'})[action];request.rejectionReason=action==='reject'?details.reason:null;request.statusReason=['cancel','no_show'].includes(action)?details.reason:null;}
  request.version++;state().events.push({id:crypto.randomUUID(),actor_name:state().account.name,status:request.status,description:details.reason||`Request updated: ${action}.`,created_at:new Date().toISOString()});
  for(const refresh of state().serviceCallbacks??[])refresh();
  return structuredClone(request);
}
export async function updateAppointmentStatus(request, status, reason) { return manageAppointment(request,({APPROVED:'approve',REJECTED:'reject',COMPLETED:'complete',CANCELLED:'cancel',NO_SHOW:'no_show'})[status],{reason}); }
export async function setAppointmentArchived(reference, archived) { state().requests.find(request => request.reference === reference).archived = archived; }
export async function getSchoolIdImageUrl(path) { state().idLinkReads=(state().idLinkReads??0)+1;return state().imageUrls[path]??''; }
export async function uploadSchoolIdImage(file,owner,reference) {const path=`${owner}/${reference}/${crypto.randomUUID()}/school-id.png`;state().imageUrls[path]=URL.createObjectURL(file);state().idUploads??=[];state().idUploads.push({path,owner,reference,name:file.name});return path;}
export async function removeSchoolIdImage(path) {if(state().requests.some(request=>request.schoolIdImagePath===path))return;state().removedIdUploads??=[];state().removedIdUploads.push(path);delete state().imageUrls[path];}
export async function getTransactionMessages(reference) {const attachments=await readChatAttachments('request',reference);return structuredClone((state().transaction_messages??[]).filter(row=>row.request_reference===reference).map(row=>({id:row.id,authorId:row.author_id,author:row.author_name,role:row.author_role,body:row.body,sentAt:row.sent_at,attachments:attachments.filter(file=>file.request_message_id===row.id)})));}
export async function addTransactionMessage(reference,message,files=[]) {const row=await sendChatMessage('request',reference,message.id,message.body,files);return{id:row.id,authorId:row.author_id,author:row.author_name,role:row.author_role,body:row.body,sentAt:row.sent_at,attachments:row.attachments};}
export function subscribeTransactionMessages() { return () => {}; }
export async function getPublicPosts() {if(state().failPosts)throw new Error('Could not load announcements.'); return structuredClone((state().posts??[]).filter(post=>!post.archived || state().account?.role==='staff')); }
export async function savePublicPosts() {}
export async function savePublicPost(post) { const previous=state().posts.find(item=>item.id===post.id);if(previous&&previous.revision!==post.revision)throw new Error("Another staff member changed this record. Reload and review it before saving.");post.updatedAt=new Date().toISOString();post.revision=(previous?.revision??0)+1;if(state().failAnnouncementSave)throw new Error('Simulated network failure');state().posts=[structuredClone(post),...(state().posts??[]).filter(item=>item.id!==post.id)]; }
export async function setPublicPostArchived(id,archived) { const post=state().posts.find(post=>post.id===id);post.archived=archived;post.revision=(post.revision??1)+1; }
export function subscribePublicPosts() { return () => {}; }
export async function getResidentConcerns(owner) { return structuredClone((state().resident_concerns??[]).filter(r=>!owner||r.owner_id===owner).map(r=>({...r,ownerId:r.owner_id,submittedAt:r.submitted_at,resolutionNote:r.resolution_note}))); }
export async function addResidentConcern(concern){const s=state();if(s.pauseConcern)await new Promise(resolve=>{s.finishConcern=resolve;});if(s.failConcernSave)throw new Error('Simulated concern save failure.');s.resident_concerns??=[];let row=s.resident_concerns.find(item=>item.reference===concern.reference);if(!row){row={reference:concern.reference,owner_id:s.account.id,name:s.account.name,contact:concern.contact,category:concern.category,message:concern.message,status:'RECEIVED',archived:false,submitted_at:new Date().toISOString(),version:1};s.resident_concerns.push(row);}if(s.failAfterConcernSave)s.failList='concerns';return{...row,ownerId:row.owner_id,submittedAt:row.submitted_at};}
export async function updateResidentConcern() {}
export async function setResidentConcernArchived() {}
export function subscribeResidentConcerns() { return () => {}; }
export async function getResidentDirectory() { return [{ ...state().resident }]; }
export async function updateResidentDirectoryEntry(input){if(state().failResidentEdit)throw new Error('Another staff member changed this record. Reload and review it before saving.');Object.assign(state().resident,input);state().resident.revision=(input.revision??1)+1;}
export function subscribeResidentDirectory() { return () => {}; }
export async function getWalkInShifts(){if(state().failSchedule)throw new Error('Could not load schedule.');return structuredClone(state().shifts??[]);}
export async function saveWalkInShifts(shifts){const s=state();if(s.pauseShift)await new Promise(resolve=>{s.finishShift=resolve;});s.shifts??=[];for(const shift of shifts){const previous=s.shifts.find(item=>item.id===shift.id);if(previous&&previous.revision!==shift.revision)throw new Error('Schedule changed. Reload and review it before saving.');shift.revision=(previous?.revision??0)+1;s.shifts=[...s.shifts.filter(item=>item.id!==shift.id),structuredClone(shift)];}}
export function subscribeWalkInShifts() { return () => {}; }

function pageOf(kind,rows,o={}){if(state().failList===kind)throw new Error('Could not load '+kind+'. Please retry.');const q=o.query?.trim().toLowerCase();const filtered=rows.filter(row=>(o.archived==null||row.archived===o.archived)&&(!o.status||row.status===o.status)&&(!o.date||row.date===o.date)&&(!o.owner||row.ownerId===o.owner)&&(!q||Object.values(row).some(value=>String(value).toLowerCase().includes(q))));filtered.sort((a,b)=>o.sort?.startsWith('name_')?String(a.fullName??a.name??a.title).localeCompare(String(b.fullName??b.name??b.title))*(o.sort==='name_desc'?-1:1):o.sort?.startsWith('date_')?String(a.date).localeCompare(String(b.date))*(o.sort==='date_desc'?-1:1):String(a.submittedAt??a.publishedAt??a.createdAt).localeCompare(String(b.submittedAt??b.publishedAt??b.createdAt))*(o.sort==='oldest'?1:-1));return{rows:structuredClone(filtered.slice((o.page??0)*(o.size??25),((o.page??0)+1)*(o.size??25))),total:filtered.length};}
export async function getAppointmentRequestPage(o={}){return pageOf('requests',state().requests,o);}
export async function getConcernPage(o={}){return pageOf('concerns',await getResidentConcerns(o.owner),o);}
export async function getResidentPage(o={}){return pageOf('residents',state().directory??[{...state().resident,revision:state().resident.revision??1}],o);}
export async function getPostPage(o={}){if(state().pauseList==='posts')await new Promise(resolve=>{state().finishList=resolve;});return pageOf('posts',state().posts,o);}
export async function getRequestSummary(){const all=state().requests,active=all.filter(row=>!row.archived),statuses={},months={},types={};for(const row of active){statuses[row.status]=(statuses[row.status]??0)+1;const month=String(new Date(row.submittedAt).getMonth()+1);months[month]=(months[month]??0)+1;types[row.requestType]=(types[row.requestType]??0)+1;}return{total:active.length,pending:statuses.PENDING??0,approved:statuses.APPROVED??0,served:new Set(all.filter(row=>row.status==='COMPLETED').map(row=>row.ownerId)).size,statuses,months,types:Object.entries(types).map(([name,count])=>({name,count}))};}
