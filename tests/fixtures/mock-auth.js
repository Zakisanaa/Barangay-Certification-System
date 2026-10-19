const state = () => window.__review;
export async function getResidentSession() { if(state().failSession)throw new Error('Could not verify staff access.');return state().account; }
export async function getResidentProfile(id) { return structuredClone(id===state().staff.id?state().staff:state().resident); }
export async function updateResidentProfile(input) { return {...state().account, ...input}; }
export async function signOutResident() {
  if(state().failLogout)throw new Error('Simulated sign-out network error.');
  if(state().pauseLogout)await new Promise(resolve=>{state().finishLogout=resolve;});
  state().account = null; state().authCallback?.('SIGNED_OUT');
}
export async function signInResident() { return state().resident; }
export async function signInStaff() { return state().staff; }
export async function registerResidentAccount() { return {status: 'confirmation-required', email: 'resident@example.test'}; }
export async function resendResidentConfirmation() {}
export async function requestPasswordReset(email) { state().resetEmail = email; }
export async function updateRecoveredPassword(password) { state().recoveredPassword = password; await signOutResident(); }
