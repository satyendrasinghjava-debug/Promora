/** Formatting helpers. Money arrives from the API as integer paise. */
const inr0 = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const inr2 = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 });
const num = new Intl.NumberFormat('en-IN');

export const money = (paise: number | string | null | undefined) => {
  const p = Number(paise || 0);
  return p % 100 === 0 ? inr0.format(p / 100) : inr2.format(p / 100);
};
export const count = (n: number | string | null | undefined) => num.format(Number(n || 0));
export const compact = (n: number) => new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
export const date = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
export const dateTime = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—';
export const titleCase = (s?: string | null) => (s ? s.toLowerCase().replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()) : '');
export const rupeesToPaise = (rupees: number | string) => Math.round(Number(rupees || 0) * 100);
export const rewardLabel = (type: string, paise: number) => `${money(paise)} per ${type === 'CPL' ? 'lead' : 'qualified click'}`;
export const OBJECTIVES: Record<string, string> = {
  WEBSITE_VISITS: 'Website visits', LEADS: 'Leads and enquiries', APP_INSTALLS: 'App installs', SALES: 'Sales', AWARENESS: 'Awareness', FOLLOWERS: 'Followers and subscribers',
};
