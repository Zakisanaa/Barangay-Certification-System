const state = () => window.__review;
export async function getResidentSession() { return state().account; }
export async function getResidentProfile(id) { return state().resident; }
export async function updateResidentProfile(input) { return {...state().resident, ...input}; }
export async function signOutResident() { state().account = null; state().authCallback?.('SIGNED_OUT'); }
export async function signInResident() { return state().resident; }
export async function signInStaff() { return state().staff; }
export async function registerResidentAccount() { return {status: 'confirmation-required', email: 'resident@example.test'}; }
export async function resendResidentConfirmation() {}
export async function requestPasswordReset(email) { state().resetEmail = email; }
export async function updateRecoveredPassword(password) { state().recoveredPassword = password; await signOutResident(); }
