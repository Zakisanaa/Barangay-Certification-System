export function validateProfileFields(input: {
  firstName: string; lastName: string; contactNumber: string; address: string;
}) {
  const fields = {
    firstName: input.firstName.trim(), lastName: input.lastName.trim(),
    contactNumber: input.contactNumber.trim().replace(/[\s().-]/g, ""), address: input.address.trim(),
  };
  if (!fields.firstName || fields.firstName.length > 100 || !fields.lastName || fields.lastName.length > 100) {
    throw new Error("Enter a first and last name with up to 100 characters each.");
  }
  if (!fields.address || fields.address.length > 500) throw new Error("Enter an address with up to 500 characters.");
  if (!/^\+?[0-9]{7,15}$/.test(fields.contactNumber)) {
    throw new Error("Enter a valid contact number with 7 to 15 digits and an optional leading +.");
  }
  return fields;
}
