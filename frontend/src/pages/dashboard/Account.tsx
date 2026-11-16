import { useEffect, useState } from 'react';
import { Link, Navigate, Route, Routes, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowRight, BadgeCheck, Bell, Check, Copy, Download, Gift, Link2, Megaphone, Share2 } from 'lucide-react';
import { api, newKey, type Page } from '../../lib/api';
import { track } from '../../lib/analytics';
import { useAuth } from '../../lib/auth';
import { date, dateTime, money, titleCase } from '../../lib/format';
import { useSeo } from '../../lib/seo';
import { ResourceTable } from '../../components/ResourceTable';
import { Alert, Button, Card, EmptyState, ErrorState, Input, LinkButton, Modal, PageHeader, Select, Spinner, StatCard, StatusBadge, Tabs, Textarea, useToast, cx } from '../../components/ui';
import { passwordRule } from '../auth/Auth';
import { PlanCards } from '../public/Home';

export function CopyButton({ text, label = 'Copy', onCopied }: { text: string; label?: string; onCopied?: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button size="sm" variant="secondary" onClick={async () => {
      try { await navigator.clipboard.writeText(text); } catch { /* clipboard unavailable: the value is visible on screen to copy by hand */ }
      setCopied(true); onCopied?.(); setTimeout(() => setCopied(false), 2000);
    }}>{copied ? <Check className="h-4 w-4 text-success-600" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}{copied ? 'Copied' : label}</Button>
  );
}

// ---------------------------------------------------------------- Overview
export function Overview() {
  useSeo('Dashboard', undefined, { noindex: true });
  const { user, hasRole } = useAuth();
  const [params] = useSearchParams();
  const steps = [
    { done: !!user?.emailVerified, label: 'Verify your email address', to: '/dashboard' },
    { done: !!user?.profile?.profileCompleted, label: 'Complete your profile', to: '/dashboard/settings' },
    { done: hasRole('ADVERTISER') || hasRole('PROMOTER'), label: 'Set up a business or promoter profile', to: '/dashboard/settings?tab=business' },
  ];
  const remaining = steps.filter((s) => !s.done).length;
  return (
    <>
      <PageHeader title={`Welcome${params.get('welcome') ? '' : ' back'}, ${user?.fullName.split(' ')[0]}`} description="Choose how you want to use Promora today. You can do both from this account." />
      {remaining > 0 && (
        <Card title="Finish setting up" description={`${steps.length - remaining} of ${steps.length} done`} className="mb-6">
          <ul className="space-y-2">{steps.map((s) => (
            <li key={s.label} className="flex items-center justify-between gap-3 rounded-xl border border-ink-200 px-4 py-3">
              <span className="flex items-center gap-3"><span className={cx('flex h-6 w-6 items-center justify-center rounded-full text-xs', s.done ? 'bg-success-600 text-white' : 'border border-ink-300 text-ink-400')}>{s.done && <Check className="h-4 w-4" aria-hidden />}</span><span className={cx(s.done && 'text-ink-500 line-through')}>{s.label}</span></span>
              {!s.done && s.to !== '/dashboard' && <Link to={s.to} className="link text-sm">Do this</Link>}
            </li>))}</ul>
        </Card>
      )}
      <div className="grid gap-5 md:grid-cols-2">
        <div className="card flex flex-col p-6"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-100 text-brand-600"><Megaphone className="h-5 w-5" aria-hidden /></span>
          <h2 className="mt-4 text-xl font-semibold">Advertise</h2><p className="mt-1 flex-1 text-ink-600">Create campaigns, approve promoters and pay only for verified clicks and leads.</p>
          {hasRole('ADVERTISER') ? <div className="mt-5 flex flex-wrap gap-2"><LinkButton to="/dashboard/advertiser">Advertiser dashboard</LinkButton><LinkButton to="/dashboard/advertiser/campaigns/new" variant="secondary">New campaign</LinkButton></div>
            : <LinkButton to="/dashboard/settings?tab=business" className="mt-5 self-start">Create a business profile<ArrowRight className="h-4 w-4" aria-hidden /></LinkButton>}</div>
        <div className="card flex flex-col p-6"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-sky-600"><Link2 className="h-5 w-5" aria-hidden /></span>
          <h2 className="mt-4 text-xl font-semibold">Promote</h2><p className="mt-1 flex-1 text-ink-600">Find campaigns that fit your audience, share your tracking link and earn.</p>
          {hasRole('PROMOTER') ? <div className="mt-5 flex flex-wrap gap-2"><LinkButton to="/dashboard/promoter">Promoter dashboard</LinkButton><LinkButton to="/dashboard/promoter/marketplace" variant="secondary">Find campaigns</LinkButton></div>
            : <LinkButton to="/dashboard/settings?tab=promoter" className="mt-5 self-start">Create a promoter profile<ArrowRight className="h-4 w-4" aria-hidden /></LinkButton>}</div>
      </div>
      <div className="mt-5 card flex flex-col items-start justify-between gap-4 p-6 sm:flex-row sm:items-center">
        <div className="flex items-center gap-4"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-ink-900 text-white"><Gift className="h-5 w-5" aria-hidden /></span><div><h2 className="font-semibold">Invite a business or creator</h2><p className="text-sm text-ink-600">Earn promotional credits when the people you refer become active.</p></div></div>
        <LinkButton to="/dashboard/referrals" variant="secondary">Open referrals</LinkButton>
      </div>
    </>
  );
}

// ---------------------------------------------------------------- Settings
const profileSchema = z.object({ fullName: z.string().trim().min(2, 'Enter your full name'), phone: z.string().trim().regex(/^$|^[+0-9 -]{7,20}$/, 'Enter a valid phone number'), city: z.string().trim().max(80), state: z.string().trim().max(80), bio: z.string().trim().max(1000), marketingConsent: z.boolean() });
const httpsUrl = z.string().trim().regex(/^$|^https:\/\/\S{3,290}$/, 'Use a full https:// address');
const businessSchema = z.object({ businessName: z.string().trim().min(2, 'Enter the business name').max(120), categoryId: z.string(), website: httpsUrl, city: z.string().trim().max(80), description: z.string().trim().max(2000) });
const promoterSchema = z.object({ displayName: z.string().trim().min(2, 'Enter a display name').max(120), bio: z.string().trim().max(2000), audienceSize: z.coerce.number().int().min(0, 'Cannot be negative').max(500000000),
  audienceDescription: z.string().trim().max(1000), interests: z.string().trim().max(500), languages: z.string().trim().max(200), instagramUrl: httpsUrl, youtubeUrl: httpsUrl, linkedinUrl: httpsUrl, websiteUrl: httpsUrl,
  upiId: z.string().trim().regex(/^$|^[\w.-]{2,60}@[A-Za-z]{2,30}$/, 'Enter a valid UPI ID, for example name@bank') });
const passwordSchema = z.object({ currentPassword: z.string().min(1, 'Enter your current password'), newPassword: passwordRule });

function useSave<T>(path: string, method: string, message: string, after?: () => void) {
  const { reload } = useAuth();
  const toast = useToast();
  return useMutation({ mutationFn: (body: T) => api(path, { method, body }), onSuccess: async () => { await reload(); toast(message); after?.(); } });
}

function VerificationBox({ type, status }: { type: 'ADVERTISER' | 'PROMOTER'; status?: string }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const { reload } = useAuth();
  const toast = useToast();
  const m = useMutation({ mutationFn: () => api('/me/verification-requests', { method: 'POST', body: { profileType: type, note } }), onSuccess: async () => { setOpen(false); await reload(); toast('Verification request sent'); } });
  if (status === 'VERIFIED') return <Alert tone="success" title="Verified profile">This profile shows a verified badge.</Alert>;
  if (status === 'PENDING') return <Alert tone="warning" title="Verification under review">Our team is reviewing your request.</Alert>;
  return (
    <>
      <Alert tone="info" title={status === 'REJECTED' ? 'Verification was not approved' : 'Get a verified badge'} action={<Button size="sm" variant="secondary" onClick={() => setOpen(true)}><BadgeCheck className="h-4 w-4" aria-hidden />Request verification</Button>}>Verified profiles earn more trust in the marketplace.</Alert>
      <Modal open={open} title="Request verification" onClose={() => setOpen(false)} footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button loading={m.isPending} onClick={() => m.mutate()}>Send request</Button></>}>
        <div className="space-y-4"><Textarea label="Tell us how we can verify you" value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} hint="For example your registered business name and website, or links to your channels." />{m.isError && <Alert tone="danger">{(m.error as Error).message}</Alert>}</div>
      </Modal>
    </>
  );
}

export function SettingsPage() {
  useSeo('Settings', undefined, { noindex: true });
  const { user, logout } = useAuth();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const tab = params.get('tab') || 'profile';
  const categories = useQuery({ queryKey: ['categories'], queryFn: () => api<any[]>('/public/categories'), staleTime: 300_000 });
  const p = user?.profile || {}, a = user?.advertiserProfile, pr = user?.promoterProfile;

  const profile = useForm<z.infer<typeof profileSchema>>({ resolver: zodResolver(profileSchema), defaultValues: { fullName: user?.fullName || '', phone: p.phone || '', city: p.city || '', state: p.state || '', bio: p.bio || '', marketingConsent: !!p.marketingConsent } });
  const business = useForm<z.infer<typeof businessSchema>>({ resolver: zodResolver(businessSchema), defaultValues: { businessName: a?.businessName || '', categoryId: a?.categoryId || '', website: a?.website || '', city: a?.city || '', description: a?.description || '' } });
  const promoter = useForm<z.infer<typeof promoterSchema>>({ resolver: zodResolver(promoterSchema), defaultValues: { displayName: pr?.displayName || '', bio: pr?.bio || '', audienceSize: pr?.audienceSize || 0, audienceDescription: pr?.audienceDescription || '', interests: pr?.interests || '', languages: pr?.languages || '', instagramUrl: pr?.instagramUrl || '', youtubeUrl: pr?.youtubeUrl || '', linkedinUrl: pr?.linkedinUrl || '', websiteUrl: pr?.websiteUrl || '', upiId: pr?.upiId || '' } });
  const password = useForm<z.infer<typeof passwordSchema>>({ resolver: zodResolver(passwordSchema) });

  const saveProfile = useSave<any>('/me/profile', 'PUT', 'Profile saved');
  const saveBusiness = useSave<any>('/me/advertiser-profile', 'PUT', a ? 'Business profile saved' : 'Business profile created. You can now create campaigns.', () => { if (!a) navigate('/dashboard/advertiser'); });
  const savePromoter = useSave<any>('/me/promoter-profile', 'PUT', pr ? 'Promoter profile saved' : 'Promoter profile created. You can now apply to campaigns.', () => { if (!pr) navigate('/dashboard/promoter/marketplace'); });
  const changePassword = useMutation({ mutationFn: (b: any) => api('/me/change-password', { method: 'POST', body: b }), onSuccess: async () => { toast('Password changed. Please log in again.'); await logout(); navigate('/login'); } });
  const exportData = async () => {
    const data = await api('/me/data-export');
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'promora-my-data.json'; link.click(); URL.revokeObjectURL(url);
  };
  const err = (m: { isError: boolean; error: unknown }) => m.isError && <Alert tone="danger">{(m.error as Error).message}</Alert>;

  return (
    <>
      <PageHeader title="Settings" description="Your account, public profiles and security." />
      <Tabs value={tab} onChange={(t) => setParams({ tab: t })} tabs={[{ id: 'profile', label: 'Profile' }, { id: 'business', label: 'Business profile' }, { id: 'promoter', label: 'Promoter profile' }, { id: 'security', label: 'Security and privacy' }]} />
      {tab === 'profile' && (
        <Card title="Your profile" description={user?.email}>
          <form className="grid max-w-2xl gap-5" noValidate onSubmit={profile.handleSubmit((v) => saveProfile.mutate(v))}>
            <Input label="Full name" required error={profile.formState.errors.fullName?.message} {...profile.register('fullName')} />
            <div className="grid gap-5 sm:grid-cols-2"><Input label="Phone" type="tel" hint="Needed to complete your profile." error={profile.formState.errors.phone?.message} {...profile.register('phone')} /><Input label="City" hint="Needed to complete your profile." {...profile.register('city')} /></div>
            <Input label="State" {...profile.register('state')} />
            <Textarea label="About you" rows={3} {...profile.register('bio')} />
            <label className="flex gap-2.5 text-sm text-ink-700"><input type="checkbox" className="mt-1 h-4 w-4 rounded border-ink-300" {...profile.register('marketingConsent')} /><span>Email me product updates and tips. You can withdraw this consent at any time.</span></label>
            {err(saveProfile)}<div><Button type="submit" loading={saveProfile.isPending}>Save profile</Button></div>
          </form>
        </Card>
      )}
      {tab === 'business' && (
        <div className="space-y-5">
          {a && <VerificationBox type="ADVERTISER" status={a.verificationStatus} />}
          <Card title={a ? 'Business profile' : 'Create your business profile'} description={a ? `Public page: /businesses/${a.slug}` : 'This is shown publicly and lets you create campaigns.'}>
            <form className="grid max-w-2xl gap-5" noValidate onSubmit={business.handleSubmit((v) => saveBusiness.mutate({ ...v, categoryId: v.categoryId || null }))}>
              <Input label="Business or brand name" required error={business.formState.errors.businessName?.message} {...business.register('businessName')} />
              <Select label="Category" {...business.register('categoryId')}><option value="">Choose a category</option>{(categories.data || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
              <div className="grid gap-5 sm:grid-cols-2"><Input label="Website" placeholder="https://" error={business.formState.errors.website?.message} {...business.register('website')} /><Input label="City" {...business.register('city')} /></div>
              <Textarea label="Description" rows={4} hint="What you offer, in a few sentences." {...business.register('description')} />
              {err(saveBusiness)}<div><Button type="submit" loading={saveBusiness.isPending}>{a ? 'Save business profile' : 'Create business profile'}</Button></div>
            </form>
          </Card>
        </div>
      )}
      {tab === 'promoter' && (
        <div className="space-y-5">
          {pr && <VerificationBox type="PROMOTER" status={pr.verificationStatus} />}
          <Card title={pr ? 'Promoter profile' : 'Create your promoter profile'} description={pr ? `Public page: /creators/${pr.slug}` : 'Advertisers see this when you apply to a campaign.'}>
            <form className="grid max-w-2xl gap-5" noValidate onSubmit={promoter.handleSubmit((v) => savePromoter.mutate(v))}>
              <Input label="Display name" required error={promoter.formState.errors.displayName?.message} {...promoter.register('displayName')} />
              <Textarea label="Bio" rows={3} {...promoter.register('bio')} />
              <div className="grid gap-5 sm:grid-cols-2"><Input label="Total audience size" type="number" min={0} inputMode="numeric" hint="Followers and subscribers across your channels." error={promoter.formState.errors.audienceSize?.message} {...promoter.register('audienceSize')} /><Input label="Languages" placeholder="English, Hindi" {...promoter.register('languages')} /></div>
              <Textarea label="Audience information" rows={2} hint="Who follows you: age range, cities, interests." {...promoter.register('audienceDescription')} />
              <Input label="Interests and categories" placeholder="Home, Fitness, Education" hint="Comma separated." {...promoter.register('interests')} />
              <div className="grid gap-5 sm:grid-cols-2">
                <Input label="Instagram" placeholder="https://instagram.com/..." error={promoter.formState.errors.instagramUrl?.message} {...promoter.register('instagramUrl')} />
                <Input label="YouTube" placeholder="https://youtube.com/@..." error={promoter.formState.errors.youtubeUrl?.message} {...promoter.register('youtubeUrl')} />
                <Input label="LinkedIn" placeholder="https://linkedin.com/in/..." error={promoter.formState.errors.linkedinUrl?.message} {...promoter.register('linkedinUrl')} />
                <Input label="Website or blog" placeholder="https://" error={promoter.formState.errors.websiteUrl?.message} {...promoter.register('websiteUrl')} />
              </div>
              <Input label="UPI ID for payouts" placeholder="name@bank" hint="Must be in your own name. Required before you request a payout." error={promoter.formState.errors.upiId?.message} {...promoter.register('upiId')} />
              {err(savePromoter)}<div><Button type="submit" loading={savePromoter.isPending}>{pr ? 'Save promoter profile' : 'Create promoter profile'}</Button></div>
            </form>
          </Card>
        </div>
      )}
      {tab === 'security' && (
        <div className="space-y-5">
          <Card title="Change password" description="Changing your password signs you out on every device.">
            <form className="grid max-w-md gap-5" noValidate onSubmit={password.handleSubmit((v) => changePassword.mutate(v))}>
              <Input label="Current password" type="password" autoComplete="current-password" error={password.formState.errors.currentPassword?.message} {...password.register('currentPassword')} />
              <Input label="New password" type="password" autoComplete="new-password" error={password.formState.errors.newPassword?.message} {...password.register('newPassword')} />
              {err(changePassword)}<div><Button type="submit" loading={changePassword.isPending}>Change password</Button></div>
            </form>
          </Card>
          <Card title="Your data" description="Download a copy of the personal data held in your account.">
            <div className="flex flex-wrap items-center gap-3"><Button variant="secondary" onClick={exportData}><Download className="h-4 w-4" aria-hidden />Download my data</Button><p className="text-sm text-ink-500">To delete your account, <Link className="link" to="/contact">contact us</Link>. Financial records are kept as the law requires.</p></div>
          </Card>
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------- Notifications
export function NotificationsPage() {
  useSeo('Notifications', undefined, { noindex: true });
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [page, setPage] = useState(0);
  const q = useQuery({ queryKey: ['notifications', 'list', page], queryFn: () => api<{ unread: number; page: Page }>(`/me/notifications?page=${page}&size=20`) });
  const refresh = () => qc.invalidateQueries({ queryKey: ['notifications'] });
  const readAll = useMutation({ mutationFn: () => api('/me/notifications/read-all', { method: 'POST' }), onSuccess: refresh });
  const open = async (n: any) => { if (!n.readAt) { await api(`/me/notifications/${n.id}/read`, { method: 'POST' }); refresh(); } if (n.link) navigate(n.link); };
  return (
    <>
      <PageHeader title="Notifications" description={q.data ? `${q.data.unread} unread` : undefined} actions={<Button variant="secondary" disabled={!q.data?.unread} loading={readAll.isPending} onClick={() => readAll.mutate()}>Mark all as read</Button>} />
      <Card padded={false}>
        {q.isLoading ? <Spinner /> : q.isError ? <div className="p-6"><ErrorState error={q.error} onRetry={() => q.refetch()} /></div> : q.data!.page.items.length === 0
          ? <EmptyState kind="notifications" title="No notifications" text="Campaign decisions, applications, conversions, payments and referral rewards will appear here." />
          : <ul className="divide-y divide-ink-100">{q.data!.page.items.map((n) => (
              <li key={n.id}><button className={cx('flex w-full items-start gap-3 px-5 py-4 text-left hover:bg-ink-50', !n.readAt && 'bg-brand-50/60')} onClick={() => open(n)}>
                <span className={cx('mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full', n.readAt ? 'bg-ink-100 text-ink-500' : 'bg-brand-500 text-white')}><Bell className="h-4 w-4" aria-hidden /></span>
                <span className="min-w-0 flex-1"><span className="block font-semibold text-ink-900">{n.title}</span>{n.body && <span className="block text-sm text-ink-600">{n.body}</span>}<span className="mt-1 block text-xs text-ink-400">{dateTime(n.createdAt)}</span></span>
              </button></li>))}</ul>}
      </Card>
      {q.data && q.data.page.totalPages > 1 && <div className="mt-3 flex justify-end gap-2"><Button size="sm" variant="secondary" disabled={page === 0} onClick={() => setPage(page - 1)}>Newer</Button><Button size="sm" variant="secondary" disabled={page >= q.data.page.totalPages - 1} onClick={() => setPage(page + 1)}>Older</Button></div>}
    </>
  );
}

// ---------------------------------------------------------------- Referrals
export function ReferralsPage() {
  useSeo('Referrals', undefined, { noindex: true });
  const q = useQuery({ queryKey: ['referrals'], queryFn: () => api<any>('/me/referrals') });
  if (q.isLoading) return <Spinner />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const d = q.data, s = d.summary;
  const share = async () => {
    track('promotion_shared', { kind: 'referral' });
    if (navigator.share) { try { await navigator.share({ title: 'Join me on Promora', text: 'Promote your work or earn by promoting on Promora.', url: d.url }); } catch { /* share cancelled */ } }
    else window.open(`https://wa.me/?text=${encodeURIComponent('Join me on Promora: ' + d.url)}`, '_blank', 'noopener');
  };
  return (
    <>
      <PageHeader title="Referrals" description="Invite businesses and creators. You earn promotional credits when they become active, not when they sign up." />
      <Card className="mb-6">
        <p className="label">Your referral link</p>
        <div className="flex flex-col gap-3 sm:flex-row"><input className="input num flex-1" readOnly value={d.url} aria-label="Referral link" onFocus={(e) => e.currentTarget.select()} />
          <div className="flex gap-2"><CopyButton text={d.url} label="Copy link" onCopied={() => track('promotion_shared', { kind: 'referral_copy' })} /><Button size="sm" onClick={share}><Share2 className="h-4 w-4" aria-hidden />Share</Button></div></div>
        <p className="mt-3 text-sm text-ink-500">Referral code: <span className="num font-semibold text-ink-800">{d.code}</span></p>
      </Card>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Signed up" value={s.signedUp} /><StatCard label="Activated" value={s.activated} /><StatCard label="Credits earned" value={money(s.creditsEarnedPaise)} /><StatCard label="Credits awaiting review" value={money(s.creditsPendingPaise)} />
      </div>
      <Card title="How rewards work" className="mt-6">
        <ul className="space-y-2 text-ink-700">
          <li><strong>{money(d.rules.businessRewardPaise)}</strong> in promotional credits when a business you referred gets its first campaign approved.</li>
          <li><strong>{money(d.rules.promoterRewardPaise)}</strong> in promotional credits when a promoter you referred is accepted into their first campaign.</li>
          <li>Rewards are reviewed by our team before they are added. Credits reduce the platform fee on your campaigns and cannot be withdrawn as cash.</li>
          <li>Self-referrals, duplicate accounts and other abuse are not rewarded.</li>
        </ul>
      </Card>
      <Card title="People you referred" padded={false} className="mt-6">
        {d.referrals.length === 0 ? <EmptyState kind="referrals" title="No referrals yet" text="Share your link to get started." /> : (
          <ul className="divide-y divide-ink-100">{d.referrals.map((r: any) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <div><p className="font-semibold">{r.firstName}</p><p className="text-sm text-ink-500">Joined {date(r.createdAt)}{r.referredType && ` · ${titleCase(r.referredType)}`}</p></div>
              <div className="flex items-center gap-3"><StatusBadge status={r.status} />{r.rewardStatus && <span className="text-sm text-ink-600">Reward {money(r.rewardPaise)}: <StatusBadge status={r.rewardStatus} /></span>}</div>
            </li>))}</ul>)}
      </Card>
    </>
  );
}

// ---------------------------------------------------------------- Checkout (shared by campaign funding and subscriptions)
declare global { interface Window { Razorpay?: any } }
function loadRazorpay(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}
/** Shows the server-calculated breakdown, then pays through Razorpay checkout or, in sandbox mode, a clearly labelled simulation. */
export function CheckoutModal({ order, onClose, onPaid }: { order: any | null; onClose: () => void; onPaid: () => void }) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { setError(null); setBusy(false); }, [order?.transactionId]);
  if (!order) return null;
  const b = order.breakdown;
  const pay = async () => {
    setBusy(true); setError(null);
    try {
      if (order.sandbox) { await api(`/payments/sandbox/${order.transactionId}/complete`, { method: 'POST' }); onPaid(); return; }
      if (!(await loadRazorpay())) throw new Error('The payment window could not be loaded. Check your connection and try again.');
      const rzp = new window.Razorpay({
        key: order.keyId, order_id: order.orderId, amount: order.amountPaise, currency: order.currency, name: 'Promora', description: order.description, prefill: { email: user?.email, name: user?.fullName },
        theme: { color: '#6C4CF1' },
        handler: async (res: any) => {
          try { await api('/payments/verify', { method: 'POST', body: { transactionId: order.transactionId, paymentId: res.razorpay_payment_id, signature: res.razorpay_signature } }); onPaid(); }
          catch (e: any) { setError(e.message); setBusy(false); }
        },
        modal: { ondismiss: () => setBusy(false) },
      });
      rzp.open();
    } catch (e: any) { setError(e.message); setBusy(false); }
  };
  return (
    <Modal open title="Review and pay" onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={busy} onClick={pay}>{order.sandbox ? 'Simulate payment (sandbox)' : `Pay ${money(order.amountPaise)}`}</Button></>}>
      <div className="space-y-4">
        {order.sandbox && <Alert tone="warning" title="Sandbox mode: no real money moves">Razorpay keys are not configured on this server. This button simulates a successful payment so the rest of the flow can be tested.</Alert>}
        <p className="text-ink-700">{order.description}</p>
        <dl className="divide-y divide-ink-100 rounded-xl border border-ink-200 text-sm">
          <div className="flex justify-between px-4 py-3"><dt>{b.feePaise || b.creditPaise ? 'Promoter reward budget' : 'Plan price'}</dt><dd className="num font-medium">{money(b.basePaise)}</dd></div>
          {(b.feePaise > 0 || b.creditPaise > 0) && <div className="flex justify-between px-4 py-3"><dt>Platform fee{b.creditPaise > 0 && ` (after ${money(b.creditPaise)} promo credit)`}</dt><dd className="num font-medium">{money(b.feePaise)}</dd></div>}
          <div className="flex justify-between px-4 py-3"><dt>GST</dt><dd className="num font-medium">{money(b.taxPaise)}</dd></div>
          <div className="flex justify-between bg-brand-50 px-4 py-3 text-base font-semibold"><dt>Total</dt><dd className="num">{money(b.totalPaise)}</dd></div>
        </dl>
        {error && <Alert tone="danger">{error}</Alert>}
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- Billing
export function BillingPage() {
  useSeo('Billing', undefined, { noindex: true });
  const [params, setParams] = useSearchParams();
  const qc = useQueryClient();
  const toast = useToast();
  const [order, setOrder] = useState<any | null>(null);
  const config = useQuery({ queryKey: ['payment-config'], queryFn: () => api<any>('/payments/config') });
  const sub = useQuery({ queryKey: ['subscription'], queryFn: () => api<any>('/payments/subscription') });
  const plans = useQuery({ queryKey: ['plans'], queryFn: () => api<any[]>('/public/plans') });
  const createOrder = useMutation({ mutationFn: (planCode: string) => api('/payments/subscriptions/order', { method: 'POST', body: { planCode }, idempotencyKey: newKey() }), onSuccess: setOrder, onError: (e: any) => toast(e.message, 'danger') });
  const wanted = params.get('plan');
  return (
    <>
      <PageHeader title="Billing" description="Your plan, payments, refunds and payouts." />
      {config.data?.sandbox && <div className="mb-6"><Alert tone="warning" title="Payments are in sandbox mode">{config.data.message}</Alert></div>}
      <div className="grid gap-5 lg:grid-cols-[1fr_1.4fr]">
        <Card title="Current plan">
          {sub.isLoading ? <Spinner /> : sub.data?.current
            ? <><p className="font-display text-2xl font-bold">{sub.data.current.name}</p><p className="mt-1 text-sm text-ink-600">Active until {date(sub.data.current.expiresAt)}. Platform fee {(sub.data.feeBps / 100).toFixed(0)}%.</p></>
            : <><p className="font-display text-2xl font-bold">Free</p><p className="mt-1 text-sm text-ink-600">Platform fee {sub.data ? (sub.data.feeBps / 100).toFixed(0) : '15'}% on promoter rewards.</p></>}
        </Card>
        <Card title="Change plan" description="Monthly plans. Prices exclude GST.">
          <div className="grid gap-3 sm:grid-cols-3">
            {(plans.data || []).filter((p) => p.pricePaise > 0).map((p) => (
              <div key={p.code} className={cx('rounded-xl border p-4', wanted === p.code ? 'border-brand-500 ring-1 ring-brand-500' : 'border-ink-200')}>
                <p className="font-semibold">{p.name}</p><p className="num mt-1 text-lg font-bold">{money(p.pricePaise)}<span className="text-xs font-normal text-ink-500"> / month</span></p>
                <Button size="sm" variant={wanted === p.code ? 'primary' : 'secondary'} className="mt-3 w-full" loading={createOrder.isPending && createOrder.variables === p.code} disabled={sub.data?.current?.code === p.code} onClick={() => createOrder.mutate(p.code)}>{sub.data?.current?.code === p.code ? 'Current plan' : 'Choose'}</Button>
              </div>))}
          </div>
        </Card>
      </div>
      <div className="mt-6">
        <ResourceTable queryKey="my-transactions" url="/me/transactions" title="Transaction history"
          empty={{ kind: 'transactions', title: 'No transactions yet', text: 'Campaign payments, subscriptions, refunds and payouts are listed here.' }}
          columns={[
            { header: 'Description', primary: true, cell: (t: any) => <><span className="font-medium text-ink-900">{t.description || titleCase(t.type)}</span><span className="block text-xs text-ink-500">{t.providerOrderId || t.provider}</span></> },
            { header: 'Type', cell: (t: any) => titleCase(t.type) }, { header: 'Date', cell: (t: any) => dateTime(t.createdAt) },
            { header: 'Amount', className: 'text-right', cell: (t: any) => <span className="num font-semibold">{money(t.amountPaise)}</span> }, { header: 'Status', cell: (t: any) => <StatusBadge status={t.status} /> },
          ]} />
      </div>
      <details className="mt-6"><summary className="cursor-pointer text-sm font-semibold text-brand-600">Compare all plans</summary><div className="mt-4"><PlanCards compactView /></div></details>
      <CheckoutModal order={order} onClose={() => setOrder(null)} onPaid={() => { setOrder(null); setParams({}); toast('Payment confirmed. Your plan is active.'); qc.invalidateQueries({ queryKey: ['subscription'] }); qc.invalidateQueries({ queryKey: ['my-transactions'] }); }} />
    </>
  );
}

// ---------------------------------------------------------------- Routes
export function AccountRoutes() {
  return (
    <Routes>
      <Route index element={<Overview />} />
      <Route path="settings" element={<SettingsPage />} />
      <Route path="notifications" element={<NotificationsPage />} />
      <Route path="referrals" element={<ReferralsPage />} />
      <Route path="billing" element={<BillingPage />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
