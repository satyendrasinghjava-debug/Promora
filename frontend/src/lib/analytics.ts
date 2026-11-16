/** First-party product analytics: a small allow-listed set of browser events sent to the Promora API, with UTM attribution. */
const UTM_KEY = 'promora_utm';
const ANON_KEY = 'promora_anon';

function store(): Storage | null { try { return window.sessionStorage; } catch { return null; } }

export function captureUtm() {
  const p = new URLSearchParams(window.location.search);
  const utm = { utmSource: p.get('utm_source'), utmMedium: p.get('utm_medium'), utmCampaign: p.get('utm_campaign') };
  if (utm.utmSource || utm.utmMedium || utm.utmCampaign) store()?.setItem(UTM_KEY, JSON.stringify(utm));
  const ref = p.get('ref');
  if (ref) store()?.setItem('promora_ref', ref);
}
export function getUtm(): { utmSource?: string; utmMedium?: string; utmCampaign?: string } {
  try { return JSON.parse(store()?.getItem(UTM_KEY) || '{}'); } catch { return {}; }
}
export const getReferralCode = () => store()?.getItem('promora_ref') || '';

function anonymousId() {
  const s = store();
  let id = s?.getItem(ANON_KEY);
  if (!id) { id = Math.random().toString(36).slice(2) + Date.now().toString(36); s?.setItem(ANON_KEY, id); }
  return id;
}

export function track(name: 'landing_page_viewed' | 'signup_started' | 'promotion_shared' | 'pricing_plan_clicked', properties: Record<string, unknown> = {}) {
  const body = JSON.stringify({ name, properties, anonymousId: anonymousId(), path: window.location.pathname, ...getUtm() });
  // Analytics must never break the page, so failures are ignored.
  fetch('/api/v1/public/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => undefined);
}
