import { requireSupabase } from "./supabase";

export interface ResidentAccount {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  contactNumber: string;
  address: string;
  role: "resident" | "staff";
  createdAt: string;
}

export type ResidentRegistrationResult =
  | { status: "confirmation-required"; email: string }
  | { status: "signed-in"; account: ResidentAccount };

function toResidentAccount(profile: {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  contact_number: string;
  address: string;
  role: "resident" | "staff";
  created_at: string;
}): ResidentAccount {
  return {
    id: profile.id,
    firstName: profile.first_name,
    lastName: profile.last_name,
    name: `${profile.first_name} ${profile.last_name}`.trim(),
    email: profile.email ?? "",
    contactNumber: profile.contact_number,
    address: profile.address,
    role: profile.role,
    createdAt: profile.created_at,
  };
}

export async function getResidentProfile(userId: string): Promise<ResidentAccount> {
  const client = requireSupabase();
  const { data, error } = await client
    .from("resident_profiles")
    .select("id, first_name, last_name, email, contact_number, address, role, created_at")
    .eq("id", userId)
    .single();
  if (error) throw error;
  return toResidentAccount(data);
}

export async function updateResidentProfile(input: {
  id: string;
  firstName: string;
  lastName: string;
  contactNumber: string;
  address: string;
}): Promise<ResidentAccount> {
  const { data, error } = await requireSupabase()
    .from("resident_profiles")
    .update({
      first_name: input.firstName.trim(),
      last_name: input.lastName.trim(),
      contact_number: input.contactNumber.trim(),
      address: input.address.trim(),
    })
    .eq("id", input.id)
    .select("id, first_name, last_name, email, contact_number, address, role, created_at")
    .single();
  if (error) throw error;
  return toResidentAccount(data);
}

export async function registerResidentAccount(input: {
  firstName: string;
  lastName: string;
  email: string;
  contactNumber: string;
  address: string;
  password: string;
}): Promise<ResidentRegistrationResult> {
  const email = input.email.trim().toLowerCase();
  const { data, error } = await requireSupabase().auth.signUp({
    email,
    password: input.password,
    options: {
      emailRedirectTo: window.location.origin,
      data: {
        first_name: input.firstName.trim(),
        last_name: input.lastName.trim(),
        contact_number: input.contactNumber.trim(),
        address: input.address.trim(),
      },
    },
  });
  if (error) throw error;
  if (!data.user) throw new Error("Account creation did not return a user. Please try again.");
  if (data.user.identities?.length === 0) {
    throw new Error("An account with this email may already exist. Try signing in or use another email.");
  }
  if (!data.session) return { status: "confirmation-required", email };
  return { status: "signed-in", account: await getResidentProfile(data.user.id) };
}

export async function resendResidentConfirmation(email: string): Promise<void> {
  const { error } = await requireSupabase().auth.resend({
    type: "signup",
    email: email.trim().toLowerCase(),
    options: { emailRedirectTo: window.location.origin },
  });
  if (error) throw error;
}

export async function signInResident(email: string, password: string): Promise<ResidentAccount> {
      const client = requireSupabase();
      const { data, error } = await client.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
  if (error) throw error;
  const account = await getResidentProfile(data.user.id);
  if (account.role !== "resident") {
    await client.auth.signOut();
    throw new Error("This account is not authorized for resident access.");
  }
  return account;
}

export async function signInStaff(email: string, password: string): Promise<ResidentAccount> {
  const client = requireSupabase();
  const { data, error } = await client.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
  if (error) throw error;
  const account = await getResidentProfile(data.user.id);
  if (account.role !== "staff") {
    await client.auth.signOut();
    throw new Error("This account is not authorized for staff access.");
  }
  return account;
}

export async function getResidentSession(): Promise<ResidentAccount | null> {
  const client = requireSupabase();
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  if (!data.session) return null;
  try {
    return await getResidentProfile(data.session.user.id);
  } catch (error) {
    await client.auth.signOut();
    throw error;
  }
}

export async function signOutResident(): Promise<void> {
  const { error } = await requireSupabase().auth.signOut();
  if (error) throw error;
}
