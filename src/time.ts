// KST (Asia/Seoul) time helpers. The bot serves a Korean audience, so all
// per-guild notification hours are interpreted in this fixed timezone.

const KST = 'Asia/Seoul';

/** Current hour (0-23) in KST. */
export function getKstHour(): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: KST,
    hour: '2-digit',
    hour12: false,
  }).formatToParts(new Date());
  const hour = parts.find(p => p.type === 'hour')?.value ?? '0';
  // Some ICU versions return "24" for midnight with hour12:false — normalize.
  return parseInt(hour, 10) % 24;
}

/** Current date as `YYYY-MM-DD` in KST (used as a once-per-day delivery key). */
export function getKstDateString(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: KST,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}
