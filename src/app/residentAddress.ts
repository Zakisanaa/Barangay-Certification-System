export const RESIDENT_BARANGAY_ADDRESS = "Barangay Lagasit, San Quintin, Pangasinan";

export function getResidentAddressDetails(address: string): string {
  const trimmed = address.trim();
  const suffix = new RegExp(`,?\\s*${RESIDENT_BARANGAY_ADDRESS.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
  return trimmed.replace(suffix, "").trim().replace(/,\s*$/, "");
}

export function formatResidentAddress(details: string): string {
  const normalizedDetails = getResidentAddressDetails(details);
  return normalizedDetails
    ? `${normalizedDetails}, ${RESIDENT_BARANGAY_ADDRESS}`
    : RESIDENT_BARANGAY_ADDRESS;
}
