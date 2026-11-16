import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3, Bell, Megaphone, CreditCard, FileText, Flag, Gift, LayoutDashboard, LogOut, Menu, Search, Settings, ShieldAlert, ShieldCheck, Users, Wallet, X,
  PlusCircle, Link2, ScrollText, BadgeCheck, Home, type LucideIcon,
} from 'lucide-react';
import { api } from '../lib/api';
import { isStaff, useAuth } from '../lib/auth';
import { Logo } from '../components/brand';
import { Alert, Button, Spinner, cx, useToast } from '../components/ui';

interface Item { to: string; label: string; icon: LucideIcon; end?: boolean; permission?: string }
interface Group { title?: string; items: Item[] }

function Shell({ groups, dark, badge, children }: { groups: Group[]; dark?: boolean; badge?: string; children: ReactNode }) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  useEffect(() => { setOpen(false); window.scrollTo(0, 0); }, [pathname]);
  const notifications = useQuery({ queryKey: ['notifications', 'count'], queryFn: () => api<{ unread: number }>('/me/notifications?size=1'), refetchInterval: 60_000 });
  const unread = notifications.data?.unread || 0;
  const side = (
    <div className={cx('flex h-full flex-col', dark ? 'bg-ink-900 text-ink-300' : 'border-r border-ink-200 bg-white')}>
      <div className="flex h-16 items-center justify-between px-5">
        <Link to="/" aria-label="Promora home"><Logo white={dark} /></Link>
        <button className="rounded-lg p-1.5 lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu"><X className="h-5 w-5" /></button>
      </div>
      {badge && <p className="mx-5 mb-2 rounded-lg bg-brand-500/20 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-brand-200">{badge}</p>}
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-3" aria-label="Section">
        {groups.map((g, i) => (
          <div key={i}>
            {g.title && <p className={cx('px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider', dark ? 'text-ink-500' : 'text-ink-400')}>{g.title}</p>}
            {g.items.map((it) => (
              <NavLink key={it.to} to={it.to} end={it.end}
                className={({ isActive }) => cx('flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition',
                  dark ? (isActive ? 'bg-white/10 text-white' : 'hover:bg-white/5 hover:text-white') : (isActive ? 'bg-brand-100 text-brand-700' : 'text-ink-600 hover:bg-ink-100 hover:text-ink-900'))}>
                <it.icon className="h-[18px] w-[18px]" aria-hidden />{it.label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
      <div className={cx('border-t p-4', dark ? 'border-white/10' : 'border-ink-200')}>
        <p className={cx('truncate text-sm font-semibold', dark ? 'text-white' : 'text-ink-900')}>{user?.fullName}</p>
        <p className="truncate text-xs">{user?.email}</p>
        <button onClick={async () => { await logout(); navigate('/'); }} className={cx('mt-3 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium', dark ? 'hover:bg-white/5 hover:text-white' : 'text-ink-600 hover:bg-ink-100')}>
          <LogOut className="h-4 w-4" aria-hidden />Log out
        </button>
      </div>
    </div>
  );
  return (
    <div className="min-h-screen bg-ink-50 lg:pl-64">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 lg:block">{side}</aside>
      {open && <div className="fixed inset-0 z-50 lg:hidden"><div className="absolute inset-0 bg-ink-900/50" onClick={() => setOpen(false)} /><aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] shadow-pop">{side}</aside></div>}
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-ink-200 bg-white/95 px-4 backdrop-blur sm:px-6">
        <button className="rounded-lg p-2 text-ink-700 hover:bg-ink-100 lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu"><Menu className="h-6 w-6" /></button>
        <div className="hidden text-sm text-ink-500 lg:block">{dark ? 'Administration' : 'Workspace'}</div>
        <div className="flex items-center gap-1">
          {isStaff(user) && <Link to={dark ? '/dashboard' : '/admin'} className="rounded-lg px-3 py-2 text-sm font-medium text-ink-600 hover:bg-ink-100">{dark ? 'User workspace' : 'Admin'}</Link>}
          <Link to="/campaigns" className="hidden rounded-lg px-3 py-2 text-sm font-medium text-ink-600 hover:bg-ink-100 sm:block">Marketplace</Link>
          <Link to="/dashboard/notifications" className="relative rounded-lg p-2 text-ink-600 hover:bg-ink-100" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}>
            <Bell className="h-5 w-5" />{unread > 0 && <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger-600 px-1 text-[10px] font-bold text-white">{unread > 9 ? '9+' : unread}</span>}
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-content px-4 py-6 sm:px-6 lg:py-8">{children}</main>
    </div>
  );
}

function VerifyBanner() {
  const { user, reload } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [devToken, setDevToken] = useState<string | null>(null);
  if (!user || user.emailVerified) return null;
  const resend = async () => {
    setBusy(true);
    try {
      const res = await api<{ devVerificationToken?: string }>('/me/resend-verification', { method: 'POST' });
      setDevToken(res.devVerificationToken || null);
      toast('Verification email sent');
    } catch (e: any) { toast(e.message, 'danger'); } finally { setBusy(false); }
  };
  return (
    <div className="mb-6">
      <Alert tone="warning" title="Verify your email address"
        action={<div className="flex gap-2"><Button size="sm" variant="secondary" loading={busy} onClick={resend}>Resend email</Button><Button size="sm" variant="ghost" onClick={() => reload()}>I have verified</Button></div>}>
        You need a verified email to submit campaigns, apply to campaigns and request payouts.
        {devToken && <span className="mt-1 block">Development mode: <Link className="link" to={`/verify-email?token=${devToken}`}>open the verification link</Link> (no mail server is configured).</span>}
      </Alert>
    </div>
  );
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="min-h-screen"><Spinner label="Loading your workspace" /></div>;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  return <>{children}</>;
}

/** Client-side convenience only. Every admin API call is authorised again on the server. */
export function RequireStaff({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (!isStaff(user)) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

export function DashboardLayout() {
  const { user } = useAuth();
  const groups: Group[] = [
    { items: [{ to: '/dashboard', label: 'Overview', icon: Home, end: true }] },
    { title: 'Advertise', items: user?.roles.includes('ADVERTISER')
      ? [{ to: '/dashboard/advertiser', label: 'Advertiser dashboard', icon: LayoutDashboard, end: true }, { to: '/dashboard/advertiser/campaigns', label: 'My campaigns', icon: Megaphone, end: true }, { to: '/dashboard/advertiser/campaigns/new', label: 'New campaign', icon: PlusCircle }]
      : [{ to: '/dashboard/settings?tab=business', label: 'Become an advertiser', icon: Megaphone }] },
    { title: 'Promote', items: user?.roles.includes('PROMOTER')
      ? [{ to: '/dashboard/promoter', label: 'Promoter dashboard', icon: LayoutDashboard, end: true }, { to: '/dashboard/promoter/marketplace', label: 'Find campaigns', icon: Search }, { to: '/dashboard/promoter/campaigns', label: 'My promotions', icon: Link2 }, { to: '/dashboard/promoter/earnings', label: 'Earnings and payouts', icon: Wallet }]
      : [{ to: '/dashboard/settings?tab=promoter', label: 'Become a promoter', icon: Link2 }] },
    { title: 'Account', items: [{ to: '/dashboard/referrals', label: 'Referrals', icon: Gift }, { to: '/dashboard/billing', label: 'Billing', icon: CreditCard }, { to: '/dashboard/notifications', label: 'Notifications', icon: Bell }, { to: '/dashboard/settings', label: 'Settings', icon: Settings }] },
  ];
  return <RequireAuth><Shell groups={groups}><VerifyBanner /><Outlet /></Shell></RequireAuth>;
}

export function AdminLayout() {
  const { can } = useAuth();
  const all: Group[] = [
    { items: [{ to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true }] },
    { title: 'Operations', items: [
      { to: '/admin/users', label: 'Users', icon: Users, permission: 'user.view' }, { to: '/admin/campaigns', label: 'Campaigns', icon: Megaphone, permission: 'campaign.moderate' },
      { to: '/admin/verifications', label: 'Verification', icon: BadgeCheck, permission: 'verification.review' }, { to: '/admin/moderation', label: 'Content moderation', icon: Flag, permission: 'content.moderate' }] },
    { title: 'Money and risk', items: [
      { to: '/admin/finance', label: 'Payments and finance', icon: Wallet, permission: 'finance.view' }, { to: '/admin/referrals', label: 'Referrals', icon: Gift, permission: 'referral.manage' },
      { to: '/admin/fraud', label: 'Fraud and risk', icon: ShieldAlert, permission: 'fraud.manage' }] },
    { title: 'Platform', items: [
      { to: '/admin/reports', label: 'Reports', icon: BarChart3, permission: 'report.view' }, { to: '/admin/settings', label: 'Settings', icon: Settings, permission: 'admin.access' },
      { to: '/admin/audit', label: 'Audit log', icon: ScrollText, permission: 'audit.view' }, { to: '/admin/operations', label: 'Email and contact log', icon: FileText, permission: 'admin.access' }] },
  ];
  const groups = all.map((g) => ({ ...g, items: g.items.filter((i) => !i.permission || can(i.permission)) })).filter((g) => g.items.length);
  return <RequireAuth><RequireStaff><Shell groups={groups} dark badge="Admin console"><Outlet /></Shell></RequireStaff></RequireAuth>;
}
export { ShieldCheck };
