import {formatServiceFee} from './serviceFee.ts';
interface ServiceConfiguration {
  services: { request_type: string; active: boolean; requirements: string; fee_description: string; fee_amount?:number|null; processing_time: string; softcopy_available: boolean }[];
  office: { contact_number: string; contact_email: string; address: string; office_hours: string };
}

export function getRecognizedServiceFaq(query: string, config: ServiceConfiguration): string | null {
  const answer = getServiceFaq(query, config);
  return answer.startsWith("I can help with") ? null : answer;
}

export function getServiceFaq(query: string, config: ServiceConfiguration): string {
  const text = query.toLowerCase().trim();
  const services = config.services.filter(service => service.active);
  const office = config.office;
  const contact = [office.contact_number && `Phone: ${office.contact_number}`, office.contact_email && `Email: ${office.contact_email}`, office.address && `Office: ${office.address}`].filter(Boolean).join("\n");
  if (/reschedul|cancel/.test(text)) return `To cancel an unfulfilled Pending or Approved appointment, open your Dashboard, select the request, and choose Cancel appointment. Give a reason and confirm. For rescheduling, send a message in the request conversation; staff can change the date and time after checking availability. Issued or collected certificates need staff assistance. Pending requests expire after their scheduled day (Asia/Manila). Staff review missed Approved appointments; past appointment dates do not block a new request.\n\n${contact}`;
  if (/office|hours|open|contact|phone|email/.test(text)) return `${office.office_hours ? `Office hours: ${office.office_hours}` : "Office hours have not yet been confirmed by staff."}\n\n${contact}\n\nUse the booking calendar for the weekdays, dates, and times currently available.`;
  const aliases: [RegExp, string][] = [
    [/business permit/, "Business Permit Clearance"], [/clearance/, "Barangay Clearance"],
    [/residency|residence/, "Certificate of Residency"], [/indigency|indigent/, "Certificate of Indigency"],
    [/job seeker/, "First-Time Job Seeker Certificate"], [/pwd/, "PWD Certificate"],
    [/good moral/, "Good Moral Certificate"], [/attestation/, "Attestation"],
    [/agrarian|agraryo/, "Barangay Agrarian Certificate"],
  ];
  const service = [...services].sort((a, b) => b.request_type.length - a.request_type.length).find(service => text.includes(service.request_type.toLowerCase()))
    ?? services.find(service => service.request_type === aliases.find(([pattern]) => pattern.test(text))?.[1]);
  if (service) return `${service.request_type}\n\nRequirements:\n${service.requirements || "Not yet confirmed by staff. Contact the barangay office before preparing documents."}\n\nFee: ${formatServiceFee(service)}\nProcessing time: ${service.processing_time || "Confirm with the barangay office."}\nFormat: ${service.softcopy_available ? "Hardcopy, softcopy, or both" : "Hardcopy only"}\n\n${contact}`;
  if (/\b(?:ids?|identification|book|booking)\b/.test(text)) return `Every new appointment requires an attached photo of your valid ID, regardless of ID type. In Book, select your ID type, enter its number, upload a clear JPG, PNG, or WebP image up to 5 MB, and confirm staff review. ID images are private to authorized reviewers. Then choose your document service, provide its required supporting documents, and select an available date and time. Additional requirements depend on your selected service. Good Moral has no additional document requirements; the booking ID is still required. Agrarian Certificate also needs proof of land ownership or tenancy. Staff review the request; uploading an ID does not automatically approve it.\n\n${contact}`;
  if (/fee|cost|charge|payment/.test(text)) return `Fees maintained by barangay staff:\n\n${services.map(service => `${service.request_type}: ${formatServiceFee(service)}`).join("\n")}\n\nConfirm any unlisted amount with the office before paying.\n${contact}`;
  if (/process|how long|wait/.test(text)) return `Processing times maintained by barangay staff:\n\n${services.map(service => `${service.request_type}: ${service.processing_time || "Not yet confirmed"}`).join("\n")}\n\n${contact}`;
  return `I can help with document requirements, fees, processing times, office contacts, and appointment questions. Include the document name in your question or choose a quick topic.\n\nAvailable services:\n${services.map(service => `• ${service.request_type}`).join("\n")}`;
}
