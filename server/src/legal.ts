/**
 * Legal versions (Terms of Service + Privacy Policy). Bump when the documents in
 * client/src/legal/ change materially → every user is asked to accept again on next open.
 * Keep in sync with client/src/legal/legalInfo.ts.
 */
export const TERMS_VERSION = '2026-11-23';
export const PRIVACY_VERSION = '2026-11-24'; // Sarvam AI added as voice processor
export const MIN_AGE = 18; // DPDP Act 2023 s.9: under-18s need verifiable parental consent, which we don't collect

export const ageOn = (dob: Date, now = new Date()) => {
  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  const m = now.getUTCMonth() - dob.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < dob.getUTCDate())) age--;
  return age;
};

export const consentIsCurrent = (c: any) => !!c && c.termsVersion === TERMS_VERSION && c.privacyVersion === PRIVACY_VERSION;
export const currentConsent = () => ({ termsVersion: TERMS_VERSION, privacyVersion: PRIVACY_VERSION, acceptedAt: new Date() });
