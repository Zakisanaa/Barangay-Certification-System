import type { ServiceConfiguration } from "./serviceData";

export function getServiceFaq(query: string, config: ServiceConfiguration): string {
  const text = query.toLowerCase().trim();
  const services = config.services.filter(service => service.active);
  const office = config.office;
  const contact = [office.contact_number && `Phone: ${office.contact_number}`, office.contact_email && `Email: ${office.contact_email}`, office.address && `Office: ${office.address}`].filter(Boolean).join("\n");
  if (/reschedul|cancel/.test(text)) return `To request a schedule change or cancellation, open your Dashboard, select your request, and send a message in the request conversation. Staff will confirm the next steps.\n\n${contact}`;
  if (/office|hours|open|contact|phone|email/.test(text)) return `${office.office_hours ? `Office hours: ${office.office_hours}` : "Office hours have not yet been confirmed by staff."}\n\n${contact}\n\nThe booking calendar shows weekends and dates marked closed by staff.`;
  const aliases: [RegExp, string][] = [
    [/business permit/, "Business Permit Clearance"], [/clearance/, "Barangay Clearance"],
    [/residency|residence/, "Certificate of Residency"], [/indigency|indigent/, "Certificate of Indigency"],
    [/job seeker/, "First-Time Job Seeker Certificate"], [/pwd/, "PWD Certificate"],
  ];
  const service = [...services].sort((a, b) => b.request_type.length - a.request_type.length).find(service => text.includes(service.request_type.toLowerCase()))
    ?? services.find(service => service.request_type === aliases.find(([pattern]) => pattern.test(text))?.[1]);
  if (service) return `${service.request_type}\n\nRequirements:\n${service.requirements || "Not yet confirmed by staff. Contact the barangay office before preparing documents."}\n\nFee: ${service.fee_description || "Not yet confirmed by staff."}\nProcessing time: ${service.processing_time || "Confirm with the barangay office."}\nFormat: ${service.softcopy_available ? "Hardcopy, softcopy, or both" : "Hardcopy only"}\n\n${contact}`;
  if (/fee|cost|charge|payment/.test(text)) return `Fees maintained by barangay staff:\n\n${services.map(service => `${service.request_type}: ${service.fee_description || "Not yet confirmed"}`).join("\n")}\n\nConfirm any unlisted amount with the office before paying.\n${contact}`;
  if (/process|how long|wait/.test(text)) return `Processing times maintained by barangay staff:\n\n${services.map(service => `${service.request_type}: ${service.processing_time || "Not yet confirmed"}`).join("\n")}\n\n${contact}`;
  return `I can help with document requirements, fees, processing times, office contacts, and appointment questions. Include the document name in your question or choose a quick topic.\n\nAvailable services:\n${services.map(service => `• ${service.request_type}`).join("\n")}`;
}
