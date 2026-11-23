/**
 * ONE place for the details the Privacy Policy and Terms need.
 * ⚠️ OWNER: fill every value in [square brackets] before launch, unfilled values are shown highlighted on
 * the pages. Have a lawyer review the documents (they are written to match what the app actually does).
 * When you change the documents materially, bump the versions here AND in server/src/legal.ts
 * → every user is asked to accept again.
 */
export const LEGAL = {
  brand: 'Aastha',
  operator: '[Your full legal name, or your company name if you register one]',
  address: '[Postal address in India for legal notices]',
  supportEmail: '[support@your-domain]',
  grievanceOfficer: '[Name of the Grievance Officer]',
  grievanceEmail: '[grievance@your-domain]',
  jurisdictionCity: '[City, State]',
  website: 'aasthaai.site',
  effectiveDate: '23 November 2026',
  termsVersion: '2026-11-23',
  privacyVersion: '2026-11-23',
  minAge: 18,
} as const;

export const isPlaceholder = (v: string) => v.startsWith('[');
