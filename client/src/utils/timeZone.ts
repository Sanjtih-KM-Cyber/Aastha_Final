/** The device's IANA time zone (e.g. "Asia/Kolkata"), sent to the server so check-ins follow the user's own clock. */
export const deviceTimeZone = (): string | undefined => {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined; } catch { return undefined; }
};
