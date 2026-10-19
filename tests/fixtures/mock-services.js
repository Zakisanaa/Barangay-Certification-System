const state = () => window.__review;
export async function getServiceConfiguration() { for(const service of state().config.services)service.revision??=1;state().config.office.revision??=1;return structuredClone(state().config); }
export async function getOfficeSettings() { return structuredClone(state().config.office); }
export async function getSlotAvailability() { return state().config.slots.map((slot, i) => ({ ...slot, remaining: i ? 9 : 0, available: !!i, reason: i ? '' : 'Fully booked' })); }
export async function saveDocumentService(service) { if(state().failServiceEdit)throw new Error('Another staff member changed this record. Reload and review it before saving.');service.revision=(service.revision??1)+1;state().config.services = state().config.services.map(item => item.request_type === service.request_type ? {...service} : item); }
export async function saveOfficeSettings(office) { office.revision=(office.revision??1)+1;state().config.office = {...office}; }
export async function saveAppointmentSlot(slot) { state().config.slots = state().config.slots.map(item => item.label === slot.label ? {...slot} : item); }
export async function saveOfficeClosure(closure) { state().config.closures.push(closure);return{...closure,revision:1}; }
export async function removeOfficeClosure(day) { state().config.closures = state().config.closures.filter(item => item.closed_date !== day); }
export async function getRequestHistory() { return {events: [...state().events], deliveries: state().deliveries.map(delivery=>({...delivery,file_available:delivery.file_available??true})), notifications: [...(state().emailUpdates??[])]}; }
export async function retryEmailNotification(id) { const job=state().emailUpdates.find(job=>job.id===id);job.status='pending';job.last_error=null; }
export async function getCompletedCertificateUrl() { state().pdfDownloads = (state().pdfDownloads ?? 0) + 1; return URL.createObjectURL(new Blob(['%PDF-1.4\n'], {type: 'application/pdf'})); }
export function subscribeServiceData(tables,refresh) { state().serviceCallbacks??=new Set();state().serviceCallbacks.add(refresh);return()=>state().serviceCallbacks.delete(refresh); }

export async function retryCertificateDelivery(reference,id){state().retriedCertificate=id;const row=state().deliveries.find(item=>item.id===id);row.status='sent';row.provider_id='recovered-provider';for(const refresh of state().serviceCallbacks??[])refresh();}
