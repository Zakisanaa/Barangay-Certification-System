const state = () => window.__review;
export async function getAppointmentRequests(owner) { return structuredClone(state().requests.filter(request => !owner || request.ownerId === owner)); }
export function subscribeAppointmentRequests(callback) { state().refreshRequests = callback; return () => { state().refreshRequests = null; }; }
export async function addAppointmentRequest(request) { state().requests.push({...request}); }
export async function getCertificateTemplateFile(name) { state().downloads.push(name); return new TextEncoder().encode('mock DOCX').buffer; }
export async function sendResidentNotification(input) { state().notifications.push(input); }
export async function updateAppointmentStatus(reference, status, reason) { const request = state().requests.find(request => request.reference === reference); request.status = status; request.rejectionReason = reason ?? null; state().events.push({ id: crypto.randomUUID(), actor_name: 'Test Staff', status, description: reason || `Request marked ${status.toLowerCase()}.`, created_at: new Date().toISOString() }); }
export async function setAppointmentArchived(reference, archived) { state().requests.find(request => request.reference === reference).archived = archived; }
export async function getSchoolIdImageUrl() { return ''; }
export async function uploadSchoolIdImage() { return 'mock-school-id'; }
export async function removeSchoolIdImage() {}
export async function getTransactionMessages() { return []; }
export async function addTransactionMessage() {}
export function subscribeTransactionMessages() { return () => {}; }
export async function getPublicPosts() { return structuredClone((state().posts??[]).filter(post=>!post.archived || state().account?.role==='staff')); }
export async function savePublicPosts() {}
export async function savePublicPost(post) { if(state().failAnnouncementSave)throw new Error('Simulated network failure');state().posts=[structuredClone(post),...(state().posts??[]).filter(item=>item.id!==post.id)]; }
export async function setPublicPostArchived(id,archived) { state().posts.find(post=>post.id===id).archived=archived; }
export function subscribePublicPosts() { return () => {}; }
export async function getResidentConcerns() { return []; }
export async function addResidentConcern() {}
export async function updateResidentConcern() {}
export async function setResidentConcernArchived() {}
export function subscribeResidentConcerns() { return () => {}; }
export async function getResidentDirectory() { return [{ ...state().resident }]; }
export async function updateResidentDirectoryEntry() {}
export function subscribeResidentDirectory() { return () => {}; }
export async function getWalkInShifts() { return []; }
export async function saveWalkInShifts() {}
export function subscribeWalkInShifts() { return () => {}; }
