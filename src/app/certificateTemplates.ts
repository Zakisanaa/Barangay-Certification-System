export interface CertificateTemplate {
  fileName: string;
  label: string;
  requestTypes: string[];
}

export const certificateTemplates: CertificateTemplate[] = [
  { fileName: "ATTESTATION.docx", label: "Attestation", requestTypes: ["Attestation"] },
  {
    fileName: "BARANGAY BUSINESS CLEARANCE.docx",
    label: "Barangay Business Clearance",
    requestTypes: ["Business Permit Clearance"],
  },
  { fileName: "BARANGAY CLEARANCE.docx", label: "Barangay Clearance", requestTypes: ["Barangay Clearance"] },
  {
    fileName: "FIRST TIME JOB SEEKER.docx",
    label: "First-Time Job Seeker",
    requestTypes: ["First-Time Job Seeker Certificate"],
  },
  {
    fileName: "INDIGENCY (FINANCIAL ASSISTANCE).docx",
    label: "Indigency - Financial Assistance",
    requestTypes: ["Certificate of Indigency", "Certificate of Indigency (Financial Assistance)"],
  },
  {
    fileName: "INDIGENCY (IMSWD & HOSPITAL).docx",
    label: "Indigency - IMSWD & Hospital",
    requestTypes: ["Certificate of Indigency", "Certificate of Indigency (IMSWD & Hospital)"],
  },
  {
    fileName: "INDIGENCY (INDIGENT ONLY).docx",
    label: "Indigency - Indigent Only",
    requestTypes: ["Certificate of Indigency", "Certificate of Indigency (Indigent Only)"],
  },
  {
    fileName: "LAGASIT POOREST TO THE POOR.docx",
    label: "Lagasit Poorest to the Poor",
    requestTypes: ["Lagasit Poorest to the Poor"],
  },
  { fileName: "LATE REGISTRATION.docx", label: "Late Registration", requestTypes: ["Late Registration"] },
  { fileName: "LIVESTOCK.docx", label: "Livestock", requestTypes: ["Livestock"] },
  {
    fileName: "NON-RESIDENCY.docx",
    label: "Non-Residency",
    requestTypes: ["Certificate of Non-Residency"],
  },
  { fileName: "PWD CERTIFICATE.docx", label: "PWD Certificate", requestTypes: ["PWD Certificate"] },
  { fileName: "RESIDENCY.docx", label: "Residency", requestTypes: ["Certificate of Residency"] },
  { fileName: "TENANCY.docx", label: "Tenancy", requestTypes: ["Tenancy"] },
];

export function getCertificateTemplates(requestType: string): CertificateTemplate[] {
  return certificateTemplates.filter((template) => template.requestTypes.includes(requestType));
}
