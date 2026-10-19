import { useEffect,useSyncExternalStore } from 'react';
import { requireSupabase } from './supabase';
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
  return (manifest??certificateTemplates).filter((template) => template.requestTypes.includes(requestType));
}
let manifest:CertificateTemplate[]|null=null;
let revision=0;
const listeners=new Set<()=>void>();
export function setCertificateTemplateManifest(rows:{storage_path:string;label:string;request_type:string;active:boolean}[]){
 const next=rows.filter(row=>row.active).map(row=>({fileName:row.storage_path,label:row.label,requestTypes:[row.request_type]}));
 if(JSON.stringify(next)===JSON.stringify(manifest))return;manifest=next;revision++;listeners.forEach(listener=>listener());
}
export async function refreshCertificateTemplateManifest(){const {data,error}=await requireSupabase().from('certificate_templates').select('storage_path,label,request_type,active').eq('active',true).order('request_type');if(error)throw new Error(error.message);setCertificateTemplateManifest(data);}
export function useCertificateTemplates(requestType:string){useSyncExternalStore(listener=>{listeners.add(listener);return()=>{listeners.delete(listener);};},()=>revision,()=>0);useEffect(()=>{void refreshCertificateTemplateManifest().catch(()=>{console.error('Could not refresh certificate templates.');});},[requestType]);return getCertificateTemplates(requestType);}
