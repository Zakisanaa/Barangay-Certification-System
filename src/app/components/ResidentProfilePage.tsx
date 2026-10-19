import {useUnsavedChanges} from '../useUnsavedChanges';
import { FormEvent, useRef, useState } from "react";
import { toast } from "sonner";
import { ResidentAccount, updateResidentProfile } from "../residentAuth";
import { formatResidentAddress, getResidentAddressDetails, RESIDENT_BARANGAY_ADDRESS } from "../residentAddress";
import ResidentVerification from './ResidentVerification';
import AccountSecurity from './AccountSecurity';

export default function ResidentProfilePage({
  resident,
  onProfileUpdated,
}: {
  resident: ResidentAccount;
  onProfileUpdated: (account: ResidentAccount) => void;
}) {
  const revision=useRef(resident.revision);
  const [form, setForm] = useState({
    firstName: resident.firstName,
    lastName: resident.lastName,
    contactNumber: resident.contactNumber,
    addressDetails: getResidentAddressDetails(resident.address),
  });
  const baseline=useRef(JSON.stringify(form));useUnsavedChanges(JSON.stringify(form)!==baseline.current);
  const [saving, setSaving] = useState(false);

  const updateField = (field: keyof typeof form, value: string) => {
    setForm(current => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.firstName.trim() || !form.lastName.trim() || !form.contactNumber.trim() || !form.addressDetails.trim()) {
      toast.error("Please complete all profile fields.");
      return;
    }
    setSaving(true);
    try {
      const account = await updateResidentProfile({
        id: resident.id,revision:revision.current,
        firstName: form.firstName,
        lastName: form.lastName,
        contactNumber: form.contactNumber,
        address: formatResidentAddress(form.addressDetails),
      });
      revision.current=account.revision;onProfileUpdated(account);
      baseline.current=JSON.stringify({firstName:account.firstName,lastName:account.lastName,contactNumber:account.contactNumber,addressDetails:getResidentAddressDetails(account.address)});
      setForm({
        firstName: account.firstName,
        lastName: account.lastName,
        contactNumber: account.contactNumber,
        addressDetails: getResidentAddressDetails(account.address),
      });
      toast.success("Your profile has been updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update your profile.");
    } finally {
      setSaving(false);
    }
  };

  const inputClass = "w-full rounded border border-[#c9d1ca] bg-white px-3 py-3 text-base text-[#122d1f] outline-none focus:border-[#123323]";

  return (
    <section className="min-h-full bg-[#edf1ee] p-4 md:p-7" style={{ fontFamily: "'Segoe UI', 'Arial', sans-serif" }}>
      <div className="mx-auto max-w-2xl">
        <header className="mb-6">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-[#6a766e]">Resident account</p>
          <h1 className="text-2xl font-bold text-[#122d1f] md:text-3xl">My profile</h1>
          <p className="mt-2 text-sm leading-relaxed text-[#53645b]">
            Review and update the personal details used for your barangay requests.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-5 border border-[#c9d1ca] bg-white p-5 shadow-sm md:p-7">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-semibold text-[#34483a]">
              First name
              <input required autoComplete="given-name" value={form.firstName} onChange={event => updateField("firstName", event.target.value)} className={inputClass} />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-[#34483a]">
              Last name
              <input required autoComplete="family-name" value={form.lastName} onChange={event => updateField("lastName", event.target.value)} className={inputClass} />
            </label>
          </div>

          <label className="grid gap-2 text-sm font-semibold text-[#34483a]">
            Email address
            <input type="email" value={resident.email} readOnly aria-describedby="profile-email-note" className={`${inputClass} cursor-not-allowed bg-[#f5f7f5] text-[#6e7a71]`} />
            <span id="profile-email-note" className="text-xs font-normal text-[#6e6b65]">
              Use Change sign-in email below to request a verified email change.
            </span>
          </label>

          <label className="grid gap-2 text-sm font-semibold text-[#34483a]">
            Contact number
            <input required type="tel" autoComplete="tel" value={form.contactNumber} onChange={event => updateField("contactNumber", event.target.value)} className={inputClass} />
          </label>

          <fieldset className="grid gap-3">
            <legend className="text-sm font-semibold text-[#34483a]">Home address</legend>
            <label className="grid gap-2 text-sm font-semibold text-[#34483a]">
              Barangay
              <select value={RESIDENT_BARANGAY_ADDRESS} disabled className={`${inputClass} cursor-not-allowed bg-[#f5f7f5] text-[#6e7a71]`}>
                <option value={RESIDENT_BARANGAY_ADDRESS}>{RESIDENT_BARANGAY_ADDRESS}</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm font-semibold text-[#34483a]">
              House / street / sitio
              <textarea required autoComplete="street-address" rows={2} value={form.addressDetails} onChange={event => updateField("addressDetails", event.target.value)} className={`${inputClass} resize-y`} />
            </label>
          </fieldset>

          <div className="flex justify-end border-t border-[#e4e9e4] pt-5">
            <button type="submit" disabled={saving} className="min-h-12 rounded bg-[#123323] px-6 py-3 text-sm font-bold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60">
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
        <div className="mt-5 space-y-5"><AccountSecurity resident={resident} onEmailConfirmed={account=>{revision.current=account.revision;onProfileUpdated(account);}}/>{resident.role==='resident'&&<ResidentVerification residentId={resident.id}/>}</div>
      </div>
    </section>
  );
}
