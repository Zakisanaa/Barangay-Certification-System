const state = () => window.__review;
export async function getServiceConfiguration() { return structuredClone(state().config); }
export async function getOfficeSettings() { return structuredClone(state().config.office); }
export async function getSlotAvailability() { return state().config.slots.map((slot, i) => ({ ...slot, remaining: i ? 9 : 0, available: !!i, reason: i ? '' : 'Fully booked' })); }
export async function saveDocumentService(service) { state().config.services = state().config.services.map(item => item.request_type === service.request_type ? {...service} : item); }
export async function saveOfficeSettings(office) { state().config.office = {...office}; }
export async function saveAppointmentSlot(slot) { state().config.slots = state().config.slots.map(item => item.label === slot.label ? {...slot} : item); }
export async function saveOfficeClosure(closure) { state().config.closures.push(closure); }
export async function removeOfficeClosure(day) { state().config.closures = state().config.closures.filter(item => item.closed_date !== day); }
export async function getRequestHistory() { return {events: [...state().events], deliveries: [...state().deliveries]}; }
export async function getCompletedCertificateUrl() { state().pdfDownloads = (state().pdfDownloads ?? 0) + 1; return URL.createObjectURL(new Blob(['%PDF-1.4\n'], {type: 'application/pdf'})); }
export function subscribeServiceData() { return () => {}; }
