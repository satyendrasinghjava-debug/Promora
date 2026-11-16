import { useState, type ReactNode } from 'react';
import { Navigate, Route, Routes, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Banknote, Download, Flag, Gift, Megaphone, ShieldAlert, UserPlus, Users, Wallet, BadgeCheck, Receipt } from 'lucide-react';
import { api, getAccessToken } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { count, date, dateTime, money, rewardLabel, titleCase } from '../../lib/format';
import { useSeo } from '../../lib/seo';
import { BarChart } from '../../components/charts';
import { ResourceTable } from '../../components/ResourceTable';
import { Alert, Button, Card, ConfirmDialog, DataTable, EmptyState, ErrorState, Input, LinkButton, Modal, PageHeader, Select, Spinner, StatCard, StatusBadge, Tabs, Textarea, useToast } from '../../components/ui';

const opts = (values: string[]) => values.map((v) => ({ value: v, label: titleCase(v) }));

/** Runs one admin action behind a confirmation dialog, with a reason when the API needs one. */
function useAdminAction(invalidate: string[]) {
  const qc = useQueryClient();
  const toast = useToast();
  const [pending, setPending] = useState<null | { title: string; message: ReactNode; path: string; method?: string; reason?: 'required' | 'optional'; danger?: boolean; body?: (reason: string) => any; label?: string }>(null);
  const m = useMutation({
    mutationFn: (reason: string) => api(pending!.path, { method: pending!.method || 'POST', body: pending!.body ? pending!.body(reason) : { reason } }),
    onSuccess: () => { setPending(null); invalidate.forEach((k) => qc.invalidateQueries({ queryKey: [k] })); qc.invalidateQueries({ queryKey: ['admin-dashboard'] }); toast('Done. The action was recorded in the audit log.'); },
  });
  const dialog = <ConfirmDialog open={!!pending} title={pending?.title || ''} message={pending?.message} reason={pending?.reason} danger={pending?.danger} confirmLabel={pending?.label || 'Confirm'}
    busy={m.isPending} error={m.isError ? (m.error as Error).message : null} onClose={() => { setPending(null); m.reset(); }} onConfirm={(r) => m.mutate(r)} />;
  return { ask: setPending, dialog };
}

// ---------------------------------------------------------------- Dashboard
export function AdminDashboard() {
  useSeo('Admin dashboard', undefined, { noindex: true });
  const q = useQuery({ queryKey: ['admin-dashboard'], queryFn: () => api<any>('/admin/dashboard'), refetchInterval: 60_000 });
  if (q.isLoading) return <Spinner />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const t = q.data.totals;
  const queues = [['Campaigns awaiting review', t.pendingCampaigns, '/admin/campaigns?status=PENDING_REVIEW'], ['Verification requests', t.pendingVerifications, '/admin/verifications'], ['Payouts to process', t.pendingPayouts, '/admin/finance?tab=payouts'],
    ['Referral rewards to review', t.pendingReferralRewards, '/admin/referrals'], ['Open fraud alerts', t.fraudAlerts, '/admin/fraud'], ['Open content reports', t.openReports, '/admin/moderation']];
  return (
    <>
      <PageHeader title="Admin dashboard" description="Every figure on this page is read live from the database." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total users" value={count(t.totalUsers)} hint={`${count(t.newRegistrations7d)} new in 7 days`} icon={<Users className="h-4 w-4" />} />
        <StatCard label="Advertisers" value={count(t.advertisers)} icon={<Megaphone className="h-4 w-4" />} />
        <StatCard label="Promoters" value={count(t.promoters)} icon={<UserPlus className="h-4 w-4" />} />
        <StatCard label="Active campaigns" value={count(t.activeCampaigns)} hint={`${count(t.campaignsUnderReview)} under review`} icon={<Megaphone className="h-4 w-4" />} />
        <StatCard label="Total transactions" value={count(t.totalTransactions)} icon={<Receipt className="h-4 w-4" />} />
        <StatCard label="Campaign spending funded" value={money(t.campaignFundingPaise)} icon={<Wallet className="h-4 w-4" />} />
        <StatCard label="Platform revenue" value={money(t.platformRevenuePaise)} hint="Fees and subscriptions, before tax" icon={<Banknote className="h-4 w-4" />} />
        <StatCard label="Pending payouts" value={money(t.pendingPayoutsPaise)} hint={`${count(t.pendingPayouts)} requests`} icon={<Wallet className="h-4 w-4" />} />
        <StatCard label="Referral activity" value={count(t.referrals)} hint={`${count(t.pendingReferralRewards)} rewards to review`} icon={<Gift className="h-4 w-4" />} />
        <StatCard label="Fraud alerts" value={count(t.fraudAlerts)} icon={<ShieldAlert className="h-4 w-4" />} />
        <StatCard label="Open reports" value={count(t.openReports)} icon={<Flag className="h-4 w-4" />} />
        <StatCard label="Pending verifications" value={count(t.pendingVerifications)} icon={<BadgeCheck className="h-4 w-4" />} />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <Card title="Platform growth, last 30 days"><BarChart data={q.data.growth} labelKey="day" series={[{ key: 'registrations', label: 'Registrations', color: '#3B82F6' }, { key: 'qualifiedClicks', label: 'Qualified clicks', color: '#6C4CF1' }]} /></Card>
        <Card title="Work queues" padded={false}>
          <ul className="divide-y divide-ink-100">{queues.map(([label, n, to]) => (
            <li key={label as string} className="flex items-center justify-between gap-3 px-5 py-3.5"><span className="flex items-center gap-2 text-sm">{Number(n) > 0 && <AlertTriangle className="h-4 w-4 text-warning-600" aria-hidden />}{label}</span>
              <span className="flex items-center gap-3"><span className="num font-semibold">{n}</span><LinkButton to={to as string} size="sm" variant="secondary">Open</LinkButton></span></li>))}</ul>
        </Card>
      </div>
    </>
  );
}

// ---------------------------------------------------------------- Users
export function AdminUsers() {
  useSeo('Users', undefined, { noindex: true });
  const navigate = useNavigate();
  return (
    <>
      <PageHeader title="User management" description="Search, verify, suspend and manage roles." />
      <ResourceTable queryKey="admin-users" url="/admin/users" searchable searchPlaceholder="Search by name or email"
        filters={[{ name: 'role', label: 'Role', options: opts(['USER', 'ADVERTISER', 'PROMOTER', 'ADMIN', 'SUPER_ADMIN']) }, { name: 'status', label: 'Status', options: opts(['ACTIVE', 'SUSPENDED']) }]}
        empty={{ kind: 'search', title: 'No users match' }} onRowClick={(u: any) => navigate(`/admin/users/${u.id}`)}
        columns={[
          { header: 'User', primary: true, cell: (u: any) => <><span className="font-semibold text-ink-900">{u.fullName}</span><span className="block text-xs text-ink-500">{u.email}</span></> },
          { header: 'Roles', cell: (u: any) => <span className="text-xs">{String(u.roles || '').split(',').map(titleCase).join(', ')}</span> },
          { header: 'Status', cell: (u: any) => <StatusBadge status={u.status} /> },
          { header: 'Email', cell: (u: any) => (u.emailVerified ? 'Verified' : 'Unverified') },
          { header: 'Joined', cell: (u: any) => date(u.createdAt) }, { header: 'Last login', cell: (u: any) => dateTime(u.lastLoginAt) },
        ]} />
    </>
  );
}

export function AdminUserDetail() {
  const { id } = useParams();
  const { can, user: me } = useAuth();
  const q = useQuery({ queryKey: ['admin-user', id], queryFn: () => api<any>(`/admin/users/${id}`) });
  const { ask, dialog } = useAdminAction(['admin-user', 'admin-users']);
  const [rolesOpen, setRolesOpen] = useState(false);
  const [roles, setRoles] = useState<string[]>([]);
  const qc = useQueryClient();
  const toast = useToast();
  const saveRoles = useMutation({ mutationFn: () => api(`/admin/users/${id}/roles`, { method: 'PUT', body: { roles } }), onSuccess: () => { setRolesOpen(false); qc.invalidateQueries({ queryKey: ['admin-user'] }); toast('Roles updated'); } });
  if (q.isLoading) return <Spinner />;
  if (q.isError) return <ErrorState error={q.error} />;
  const u = q.data.user, current = String(u.roles || '').split(',').filter(Boolean), self = me?.id === u.id;
  return (
    <>
      <PageHeader title={u.fullName} back={{ to: '/admin/users', label: 'Users' }} description={<span className="flex flex-wrap items-center gap-2">{u.email}<StatusBadge status={u.status} />{u.verifiedBadge && <StatusBadge status="VERIFIED" />}</span>}
        actions={can('user.manage') && !self && <>
          <Button variant="secondary" onClick={() => ask({ title: u.verifiedBadge ? 'Remove verified badge?' : 'Mark this account as verified?', message: 'This is recorded in the audit log.', path: `/admin/users/${id}/${u.verifiedBadge ? 'unverify' : 'verify'}` })}>{u.verifiedBadge ? 'Remove verification' : 'Verify account'}</Button>
          {u.status === 'ACTIVE'
            ? <Button variant="danger" onClick={() => ask({ title: 'Suspend this account?', message: 'The user is signed out at once, their tracking links stop earning and their live campaigns are paused.', path: `/admin/users/${id}/suspend`, reason: 'required', danger: true, label: 'Suspend account' })}>Suspend</Button>
            : <Button onClick={() => ask({ title: 'Reactivate this account?', message: 'The user will be able to sign in again.', path: `/admin/users/${id}/reactivate`, reason: 'optional' })}>Reactivate</Button>}
          {can('user.roles') && <Button variant="secondary" onClick={() => { setRoles(current); setRolesOpen(true); }}>Manage roles</Button>}
        </>} />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Account"><dl className="space-y-2.5 text-sm">{[['Roles', current.map(titleCase).join(', ')], ['Email verified', u.emailVerified ? 'Yes' : 'No'], ['Phone', u.phone || '—'], ['City', u.city || '—'], ['Joined', dateTime(u.createdAt)], ['Last login', dateTime(u.lastLoginAt)], ['Promo credits', money(u.promoCreditsPaise)], ['Sign-up source', [u.utmSource, u.utmMedium, u.utmCampaign].filter(Boolean).join(' / ') || 'Direct or unknown']].map(([k, v]) => <div key={k} className="flex justify-between gap-4"><dt className="text-ink-500">{k}</dt><dd className="text-right font-medium">{v}</dd></div>)}</dl></Card>
        <Card title="Profiles"><dl className="space-y-3 text-sm">
          <div><dt className="text-ink-500">Business</dt><dd className="font-medium">{q.data.advertiserProfile ? <>{q.data.advertiserProfile.businessName} <StatusBadge status={q.data.advertiserProfile.verificationStatus} />{q.data.advertiserProfile.hidden && ' (hidden)'}</> : 'None'}</dd></div>
          <div><dt className="text-ink-500">Promoter</dt><dd className="font-medium">{q.data.promoterProfile ? <>{q.data.promoterProfile.displayName} <StatusBadge status={q.data.promoterProfile.verificationStatus} />{q.data.promoterProfile.hidden && ' (hidden)'}</> : 'None'}</dd></div></dl></Card>
        <Card title="Activity counts"><dl className="space-y-2.5 text-sm">{[['Campaigns', q.data.counts.campaigns], ['Applications', q.data.counts.applications], ['Transactions', q.data.counts.transactions], ['Open risk flags', q.data.counts.openRiskFlags]].map(([k, v]) => <div key={k} className="flex justify-between"><dt className="text-ink-500">{k}</dt><dd className="num font-semibold">{v}</dd></div>)}</dl></Card>
      </div>
      <Card title="Activity history" padded={false} className="mt-6">
        {q.data.activity.length === 0 ? <EmptyState kind="analytics" title="No recorded activity" /> : <DataTable rows={q.data.activity} rowKey={(r: any) => r.createdAt + r.action}
          columns={[{ header: 'Action', primary: true, cell: (r: any) => titleCase(r.action) }, { header: 'By', cell: (r: any) => r.actorEmail || 'System' }, { header: 'Details', cell: (r: any) => r.details || '—' }, { header: 'When', cell: (r: any) => dateTime(r.createdAt) }]} />}
      </Card>
      <Modal open={rolesOpen} title="Manage account roles" onClose={() => setRolesOpen(false)} footer={<><Button variant="secondary" onClick={() => setRolesOpen(false)}>Cancel</Button><Button loading={saveRoles.isPending} onClick={() => saveRoles.mutate()}>Save roles</Button></>}>
        <div className="space-y-3">{['ADVERTISER', 'PROMOTER', 'ADMIN', 'SUPER_ADMIN'].map((r) => (
          <label key={r} className="flex items-center gap-3"><input type="checkbox" className="h-4 w-4 rounded border-ink-300" checked={roles.includes(r)} onChange={(e) => setRoles(e.target.checked ? [...roles, r] : roles.filter((x) => x !== r))} /><span>{titleCase(r)}{(r === 'ADMIN' || r === 'SUPER_ADMIN') && <span className="text-sm text-ink-500"> (staff access; super admin only)</span>}</span></label>))}
          {saveRoles.isError && <Alert tone="danger">{(saveRoles.error as Error).message}</Alert>}</div>
      </Modal>
      {dialog}
    </>
  );
}

// ---------------------------------------------------------------- Campaign moderation
export function AdminCampaigns() {
  useSeo('Campaign moderation', undefined, { noindex: true });
  const navigate = useNavigate();
  const [params] = useSearchParams();
  return (
    <>
      <PageHeader title="Campaign moderation" description="Review, approve, reject, pause and terminate campaigns." />
      <ResourceTable queryKey="admin-campaigns" url="/admin/campaigns" searchable searchPlaceholder="Search title, business or owner email" initial={{ status: params.get('status') || '' }}
        filters={[{ name: 'status', label: 'Status', options: opts(['PENDING_REVIEW', 'CHANGES_REQUESTED', 'APPROVED', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED', 'REJECTED', 'TERMINATED', 'DRAFT']) }, { name: 'reported', label: 'Reports', options: [{ value: 'true', label: 'Reported only' }] }]}
        empty={{ kind: 'campaigns', title: 'No campaigns found' }} onRowClick={(c: any) => navigate(`/admin/campaigns/${c.id}`)}
        columns={[
          { header: 'Campaign', primary: true, cell: (c: any) => <><span className="font-semibold text-ink-900">{c.title}</span><span className="block text-xs text-ink-500">{c.businessName} · {c.ownerEmail}</span></> },
          { header: 'Status', cell: (c: any) => <StatusBadge status={c.status} /> }, { header: 'Reward', cell: (c: any) => rewardLabel(c.rewardType, c.rewardPaise) },
          { header: 'Budget', className: 'text-right', cell: (c: any) => <span className="num">{money(c.budgetPaise)}</span> },
          { header: 'Reports', className: 'text-right', cell: (c: any) => (c.openReports > 0 ? <span className="num font-semibold text-danger-600">{c.openReports}</span> : '0') },
          { header: 'Submitted', cell: (c: any) => dateTime(c.submittedAt) },
        ]} />
    </>
  );
}

export function AdminCampaignDetail() {
  const { id } = useParams();
  const q = useQuery({ queryKey: ['admin-campaign', id], queryFn: () => api<any>(`/admin/campaigns/${id}`) });
  const { ask, dialog } = useAdminAction(['admin-campaign', 'admin-campaigns']);
  if (q.isLoading) return <Spinner />;
  if (q.isError) return <ErrorState error={q.error} />;
  const c = q.data.campaign, s = q.data.stats, base = `/admin/campaigns/${id}`;
  return (
    <>
      <PageHeader title={c.title} back={{ to: '/admin/campaigns', label: 'Campaigns' }} description={<span className="flex flex-wrap items-center gap-2"><StatusBadge status={c.status} />{c.businessName} · {c.ownerEmail}</span>}
        actions={<>
          {c.status === 'PENDING_REVIEW' && <>
            <Button onClick={() => ask({ title: 'Approve this campaign?', message: 'The advertiser is notified and can fund the campaign to make it live.', path: `${base}/approve`, label: 'Approve' })}>Approve</Button>
            <Button variant="secondary" onClick={() => ask({ title: 'Request corrections', message: 'The advertiser can edit and resubmit.', path: `${base}/request-changes`, reason: 'required', label: 'Request changes' })}>Request changes</Button>
            <Button variant="danger" onClick={() => ask({ title: 'Reject this campaign?', message: 'The advertiser is told the reason. A rejected campaign cannot be resubmitted.', path: `${base}/reject`, reason: 'required', danger: true, label: 'Reject' })}>Reject</Button></>}
          {c.status === 'ACTIVE' && <Button variant="secondary" onClick={() => ask({ title: 'Pause this campaign?', message: 'Tracking stops earning until the advertiser resumes.', path: `${base}/pause`, reason: 'required', label: 'Pause' })}>Pause</Button>}
          {['APPROVED', 'ACTIVE', 'PAUSED'].includes(c.status) && <Button variant="danger" onClick={() => ask({ title: 'Terminate this campaign?', message: 'This permanently ends the campaign for a policy breach. It cannot be undone.', path: `${base}/terminate`, reason: 'required', danger: true, label: 'Terminate' })}>Terminate</Button>}
          {c.status === 'ACTIVE' && <Button variant="ghost" onClick={() => ask({ title: c.featured ? 'Remove from featured?' : 'Feature this campaign?', message: 'Featured campaigns are listed first in the marketplace.', path: `${base}/${c.featured ? 'unfeature' : 'feature'}` })}>{c.featured ? 'Unfeature' : 'Feature'}</Button>}
        </>} />
      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-6">
          <Card title="Campaign content">
            {q.data.images.length > 0 && <div className="mb-4 grid grid-cols-3 gap-3">{q.data.images.map((i: any) => <img key={i.url} src={i.url} alt="Campaign creative" className="aspect-[4/3] w-full rounded-xl object-cover" />)}</div>}
            <p className="whitespace-pre-line text-ink-700">{c.description}</p>
            <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">{[['Category', c.categoryName || '—'], ['Objective', titleCase(c.objective)], ['Audience', c.targetAudience || '—'], ['Geography', c.geography], ['Landing page', c.landingUrl || 'Promora enquiry form'], ['Reward', rewardLabel(c.rewardType, c.rewardPaise)], ['Budget', `${money(c.budgetPaise)} (funded ${money(c.fundedPaise)}, spent ${money(c.spentPaise)})`], ['Schedule', `${date(c.startDate)} to ${date(c.endDate)}`], ['Instructions', c.promoInstructions || '—'], ['Disclosure', c.disclosureText || '—']].map(([k, v]) => <div key={k}><dt className="text-ink-500">{k}</dt><dd className="break-words font-medium">{v}</dd></div>)}</dl>
          </Card>
          <Card title="Moderation history" padded={false}>{q.data.history.length === 0 ? <p className="p-5 text-sm text-ink-500">No moderation actions yet.</p> : <ul className="divide-y divide-ink-100">{q.data.history.map((h: any) => <li key={h.createdAt + h.action} className="px-5 py-3.5 text-sm"><p className="font-semibold">{titleCase(h.action)} <span className="font-normal text-ink-500">by {h.adminEmail} · {dateTime(h.createdAt)}</span></p>{h.reason && <p className="text-ink-600">{h.reason}</p>}</li>)}</ul>}</Card>
        </div>
        <div className="space-y-6">
          <Card title="Review checklist"><p className="text-sm text-ink-700">{q.data.policy}</p><ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-ink-600"><li>Claims are specific and believable</li><li>Landing page matches the description</li><li>Instructions do not ask promoters to hide the paid relationship</li><li>Advertiser: {titleCase(c.businessVerification)} verification</li></ul>{c.reviewNote && <div className="mt-4"><Alert tone="warning" title="Current review note">{c.reviewNote}</Alert></div>}</Card>
          <Card title="Performance"><dl className="space-y-2.5 text-sm">{[['All clicks', s.clicks], ['Qualified clicks', s.qualifiedClicks], ['Conversions', s.conversions], ['Promoters', s.promoters]].map(([k, v]) => <div key={k} className="flex justify-between"><dt className="text-ink-500">{k}</dt><dd className="num font-semibold">{count(v)}</dd></div>)}</dl></Card>
        </div>
      </div>
      {dialog}
    </>
  );
}

// ---------------------------------------------------------------- Verification
export function AdminVerifications() {
  useSeo('Verification', undefined, { noindex: true });
  const { ask, dialog } = useAdminAction(['admin-verifications']);
  return (
    <>
      <PageHeader title="Business and creator verification" description="Decisions and reasons are kept in the audit history." />
      <ResourceTable queryKey="admin-verifications" url="/admin/verifications" filters={[{ name: 'status', label: 'Status', options: opts(['PENDING', 'APPROVED', 'REJECTED']) }]} empty={{ kind: 'search', title: 'No verification requests' }}
        columns={[
          { header: 'Profile', primary: true, cell: (v: any) => <><span className="font-semibold text-ink-900">{v.profileName}</span><span className="block text-xs text-ink-500">{titleCase(v.profileType)} · {v.email}</span>{v.note && <span className="mt-1 block max-w-md text-sm text-ink-600">{v.note}</span>}</> },
          { header: 'Status', cell: (v: any) => <><StatusBadge status={v.status} />{v.decisionReason && <span className="mt-1 block text-xs text-ink-500">{v.decisionReason}</span>}</> },
          { header: 'Requested', cell: (v: any) => dateTime(v.createdAt) },
          { header: 'Actions', cell: (v: any) => v.status === 'PENDING' ? <div className="flex gap-2">
            <Button size="sm" onClick={() => ask({ title: 'Approve verification?', message: `${v.profileName} will show a verified badge.`, path: `/admin/verifications/${v.id}/approve`, reason: 'optional', label: 'Approve' })}>Approve</Button>
            <Button size="sm" variant="secondary" onClick={() => ask({ title: 'Reject verification?', message: 'The user is told the reason.', path: `/admin/verifications/${v.id}/reject`, reason: 'required', danger: true, label: 'Reject' })}>Reject</Button></div> : <span className="text-ink-400">—</span> },
        ]} />
      {dialog}
    </>
  );
}

// ---------------------------------------------------------------- Finance
export function AdminFinance() {
  useSeo('Payments and finance', undefined, { noindex: true });
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'transactions';
  const { can } = useAuth();
  const manage = can('finance.manage');
  const summary = useQuery({ queryKey: ['admin-finance-summary'], queryFn: () => api<any>('/admin/finance/summary') });
  const { ask, dialog } = useAdminAction(['admin-transactions', 'admin-commissions', 'admin-payouts', 'admin-finance-summary']);
  const [paid, setPaid] = useState<any | null>(null);
  const [reference, setReference] = useState('');
  const qc = useQueryClient();
  const toast = useToast();
  const markPaid = useMutation({ mutationFn: () => api(`/admin/finance/payouts/${paid.id}/mark-paid`, { method: 'POST', body: { reference } }), onSuccess: () => { setPaid(null); setReference(''); qc.invalidateQueries({ queryKey: ['admin-payouts'] }); qc.invalidateQueries({ queryKey: ['admin-finance-summary'] }); toast('Payout marked as paid'); } });
  const s = summary.data;
  return (
    <>
      <PageHeader title="Payments and finance" description="Transactions, platform and creator commission, refunds and payouts." />
      {s?.payments?.sandbox && <div className="mb-5"><Alert tone="warning" title="Payments are in sandbox mode">{s.payments.message}</Alert></div>}
      {s && <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Collected" value={money(s.collectedPaise)} hint="Paid campaign and subscription payments" /><StatCard label="Platform commission" value={money(s.platformFeesPaise + s.subscriptionRevenuePaise)} hint={`Tax collected ${money(s.taxCollectedPaise)}`} />
        <StatCard label="Creator commission" value={money(s.creatorCommissionPaise)} hint={`${money(s.commissionPaidPaise)} paid · ${money(s.commissionPendingPaise)} pending`} /><StatCard label="Refunded" value={money(s.refundedPaise)} hint={`Unspent campaign funds ${money(s.unspentCampaignFundsPaise)}`} />
      </div>}
      <div className="mt-6"><Tabs value={tab} onChange={(t) => setParams({ tab: t })} tabs={[{ id: 'transactions', label: 'Transactions' }, { id: 'commissions', label: 'Commissions' }, { id: 'payouts', label: 'Payout requests' }]} /></div>
      {tab === 'transactions' && <ResourceTable queryKey="admin-transactions" url="/admin/finance/transactions" searchable searchPlaceholder="Search email, order id or campaign"
        filters={[{ name: 'type', label: 'Type', options: opts(['CAMPAIGN_FUNDING', 'SUBSCRIPTION', 'REFUND', 'PAYOUT']) }, { name: 'status', label: 'Status', options: opts(['CREATED', 'PAID', 'FAILED', 'REFUNDED']) }]} empty={{ kind: 'transactions', title: 'No transactions' }}
        columns={[
          { header: 'Transaction', primary: true, cell: (t: any) => <><span className="font-semibold text-ink-900">{t.description || titleCase(t.type)}</span><span className="block text-xs text-ink-500">{t.userEmail} · {t.providerOrderId || t.provider}</span></> },
          { header: 'Type', cell: (t: any) => titleCase(t.type) }, { header: 'Amount', className: 'text-right', cell: (t: any) => <span className="num font-semibold">{money(t.amountPaise)}</span> },
          { header: 'Fee / tax', className: 'text-right', cell: (t: any) => <span className="num text-ink-600">{money(t.feePaise)} / {money(t.taxPaise)}</span> },
          { header: 'Status', cell: (t: any) => <StatusBadge status={t.status} /> }, { header: 'Date', cell: (t: any) => dateTime(t.createdAt) },
          { header: '', cell: (t: any) => manage && t.type === 'CAMPAIGN_FUNDING' && t.status === 'PAID' && t.campaignStatus !== 'ACTIVE' ? <Button size="sm" variant="secondary" onClick={() => ask({ title: 'Refund unspent budget?', message: 'The unspent part of this payment is refunded through the payment provider and recorded as a refund transaction.', path: `/admin/finance/transactions/${t.id}/refund`, reason: 'required', danger: true, label: 'Issue refund' })}>Refund</Button> : null },
        ]} />}
      {tab === 'commissions' && <ResourceTable queryKey="admin-commissions" url="/admin/finance/commissions" filters={[{ name: 'status', label: 'Status', options: opts(['PENDING', 'APPROVED', 'PAID', 'REVERSED']) }]} empty={{ kind: 'analytics', title: 'No commissions' }}
        columns={[
          { header: 'Commission', primary: true, cell: (c: any) => <><span className="font-semibold text-ink-900">{c.campaignTitle}</span><span className="block text-xs text-ink-500">{c.promoterEmail} · {c.conversionType === 'LEAD' ? 'Lead' : 'Qualified click'}</span></> },
          { header: 'Creator', className: 'text-right', cell: (c: any) => <span className="num font-semibold">{money(c.amountPaise)}</span> }, { header: 'Platform', className: 'text-right', cell: (c: any) => <span className="num">{money(c.platformFeePaise)}</span> },
          { header: 'Status', cell: (c: any) => <StatusBadge status={c.status} /> }, { header: 'Hold until', cell: (c: any) => dateTime(c.holdUntil) },
          { header: '', cell: (c: any) => manage ? <div className="flex gap-2">
            {c.status === 'PENDING' && <Button size="sm" variant="secondary" onClick={() => ask({ title: 'Release this commission now?', message: 'It becomes available for payout before the hold period ends.', path: `/admin/finance/commissions/${c.id}/release`, reason: 'optional' })}>Release</Button>}
            {['PENDING', 'APPROVED'].includes(c.status) && !c.payoutRequestId && <Button size="sm" variant="ghost" onClick={() => ask({ title: 'Reverse this commission?', message: 'The amount returns to the campaign budget and the promoter is notified.', path: `/admin/finance/commissions/${c.id}/reverse`, reason: 'required', danger: true, label: 'Reverse' })}>Reverse</Button>}</div> : null },
        ]} />}
      {tab === 'payouts' && <ResourceTable queryKey="admin-payouts" url="/admin/finance/payouts" filters={[{ name: 'status', label: 'Status', options: opts(['REQUESTED', 'APPROVED', 'PAID', 'REJECTED']) }]} empty={{ kind: 'transactions', title: 'No payout requests' }}
        columns={[
          { header: 'Payout', primary: true, cell: (p: any) => <><span className="num font-semibold text-ink-900">{money(p.amountPaise)}</span><span className="block text-xs text-ink-500">{p.promoterEmail} · {p.upiId} · {p.commissions} commissions</span>{p.openRiskFlags > 0 && <span className="mt-1 block text-xs font-semibold text-danger-600">{p.openRiskFlags} open risk flag(s) on this account</span>}</> },
          { header: 'Status', cell: (p: any) => <><StatusBadge status={p.status} />{p.paidReference && <span className="mt-1 block text-xs text-ink-500">Ref {p.paidReference}</span>}</> }, { header: 'Requested', cell: (p: any) => dateTime(p.createdAt) },
          { header: '', cell: (p: any) => manage ? <div className="flex flex-wrap gap-2">
            {p.status === 'REQUESTED' && <Button size="sm" onClick={() => ask({ title: 'Approve this payout?', message: `Approve ${money(p.amountPaise)} to ${p.upiId}. Send the transfer, then mark it paid.`, path: `/admin/finance/payouts/${p.id}/approve`, body: (r) => ({ note: r }), reason: 'optional', label: 'Approve' })}>Approve</Button>}
            {p.status === 'APPROVED' && <Button size="sm" onClick={() => setPaid(p)}>Mark paid</Button>}
            {['REQUESTED', 'APPROVED'].includes(p.status) && <Button size="sm" variant="ghost" onClick={() => ask({ title: 'Reject this payout?', message: 'The commissions return to the promoter\'s available balance.', path: `/admin/finance/payouts/${p.id}/reject`, body: (r) => ({ note: r }), reason: 'required', danger: true, label: 'Reject' })}>Reject</Button>}</div> : null },
        ]} />}
      <Modal open={!!paid} title="Mark payout as paid" onClose={() => setPaid(null)} footer={<><Button variant="secondary" onClick={() => setPaid(null)}>Cancel</Button><Button loading={markPaid.isPending} disabled={!reference.trim()} onClick={() => markPaid.mutate()}>Confirm paid</Button></>}>
        <div className="space-y-4"><p className="text-ink-700">Confirm that <strong>{paid && money(paid.amountPaise)}</strong> was transferred to <strong>{paid?.upiId}</strong>. Promora records the payout; the transfer itself is made from your bank or UPI app.</p>
          <Input label="Transfer reference (UTR)" required value={reference} onChange={(e) => setReference(e.target.value)} />{markPaid.isError && <Alert tone="danger">{(markPaid.error as Error).message}</Alert>}</div>
      </Modal>
      {dialog}
    </>
  );
}

// ---------------------------------------------------------------- Referrals
export function AdminReferrals() {
  useSeo('Referral management', undefined, { noindex: true });
  const { ask, dialog } = useAdminAction(['admin-referrals']);
  return (
    <>
      <PageHeader title="Referral management" description="Referral records, suspicious patterns and the reward ledger." />
      <ResourceTable queryKey="admin-referrals" url="/admin/referrals" filters={[{ name: 'status', label: 'Status', options: opts(['PENDING', 'ACTIVATED', 'REJECTED']) }, { name: 'suspicious', label: 'Risk', options: [{ value: 'true', label: 'Suspicious only' }] }]} empty={{ kind: 'referrals', title: 'No referrals recorded' }}
        columns={[
          { header: 'Referral', primary: true, cell: (r: any) => <><span className="font-semibold text-ink-900">{r.referrerEmail}</span><span className="block text-xs text-ink-500">referred {r.referredEmail} · code {r.code}</span>{r.suspicious && <span className="mt-1 block text-xs font-semibold text-danger-600">Suspicious: {r.suspiciousReason}</span>}</> },
          { header: 'Status', cell: (r: any) => <StatusBadge status={r.status} /> }, { header: 'Type', cell: (r: any) => titleCase(r.referredType) || '—' },
          { header: 'Reward', cell: (r: any) => r.rewardId ? <><span className="num font-semibold">{money(r.rewardPaise)}</span> <StatusBadge status={r.rewardStatus} /></> : <span className="text-ink-400">Not yet eligible</span> },
          { header: 'Signed up', cell: (r: any) => date(r.createdAt) },
          { header: '', cell: (r: any) => r.rewardStatus === 'PENDING_APPROVAL' ? <div className="flex gap-2">
            <Button size="sm" onClick={() => ask({ title: 'Approve this reward?', message: `${money(r.rewardPaise)} in promotional credits will be added to ${r.referrerEmail}.`, path: `/admin/referrals/rewards/${r.rewardId}/approve`, reason: 'optional', label: 'Approve reward' })}>Approve</Button>
            <Button size="sm" variant="secondary" onClick={() => ask({ title: 'Reject this reward?', message: 'No credits are added.', path: `/admin/referrals/rewards/${r.rewardId}/reject`, reason: 'required', danger: true, label: 'Reject reward' })}>Reject</Button></div> : null },
        ]} />
      {dialog}
    </>
  );
}

// ---------------------------------------------------------------- Fraud
export function AdminFraud() {
  useSeo('Fraud and risk', undefined, { noindex: true });
  const { ask, dialog } = useAdminAction(['admin-risk']);
  const patterns = useQuery({ queryKey: ['admin-click-patterns'], queryFn: () => api<any[]>('/admin/fraud/click-patterns') });
  return (
    <>
      <PageHeader title="Fraud and risk management" description="Risk flags raised by tracking, conversion and referral checks, with investigation records." />
      <ResourceTable queryKey="admin-risk" url="/admin/risk-flags" title="Risk flags" filters={[{ name: 'status', label: 'Status', options: opts(['OPEN', 'INVESTIGATING', 'RESOLVED']) }, { name: 'type', label: 'Type', options: opts(['SUSPICIOUS_CLICKS', 'DUPLICATE_CONVERSION', 'REFERRAL_ABUSE', 'ACCOUNT_RISK']) }]} empty={{ kind: 'analytics', title: 'No risk flags', text: 'Flags appear when tracking or referral checks detect unusual activity.' }}
        columns={[
          { header: 'Flag', primary: true, cell: (f: any) => <><span className="font-semibold text-ink-900">{titleCase(f.type)}</span><span className="block text-xs text-ink-500">{f.userEmail || 'No account'} · {dateTime(f.createdAt)}</span><span className="mt-1 block max-w-lg text-sm text-ink-600">{f.details}</span>{f.resolutionNote && <span className="mt-1 block text-sm text-ink-500">Investigation note: {f.resolutionNote}</span>}</> },
          { header: 'Severity', cell: (f: any) => <StatusBadge status={f.severity} /> }, { header: 'Status', cell: (f: any) => <StatusBadge status={f.status} /> },
          { header: '', cell: (f: any) => f.status !== 'RESOLVED' ? <div className="flex gap-2">
            {f.status === 'OPEN' && <Button size="sm" variant="secondary" onClick={() => ask({ title: 'Start investigating?', message: 'Add what you are checking.', path: `/admin/risk-flags/${f.id}`, body: (r) => ({ status: 'INVESTIGATING', note: r }), reason: 'optional', label: 'Start' })}>Investigate</Button>}
            <Button size="sm" onClick={() => ask({ title: 'Resolve this flag?', message: 'Record what you found and what you did.', path: `/admin/risk-flags/${f.id}`, body: (r) => ({ status: 'RESOLVED', note: r }), reason: 'required', label: 'Resolve' })}>Resolve</Button></div> : null },
        ]} />
      <Card title="Suspicious click report" description="Links with rejected clicks in the last 30 days" padded={false} className="mt-6">
        {patterns.isLoading ? <Spinner /> : !patterns.data?.length ? <EmptyState kind="analytics" title="No rejected clicks in the last 30 days" /> : <DataTable rows={patterns.data} rowKey={(r: any) => r.promoterEmail + r.campaignTitle}
          columns={[{ header: 'Promoter and campaign', primary: true, cell: (r: any) => <><span className="font-semibold text-ink-900">{r.promoterEmail}</span><span className="block text-xs text-ink-500">{r.campaignTitle}</span></> },
            { header: 'Clicks', className: 'text-right', cell: (r: any) => <span className="num">{r.clicks}</span> }, { header: 'Qualified', className: 'text-right', cell: (r: any) => <span className="num">{r.qualified}</span> },
            { header: 'Duplicates', className: 'text-right', cell: (r: any) => <span className="num">{r.duplicates}</span> }, { header: 'Bots', className: 'text-right', cell: (r: any) => <span className="num">{r.bots}</span> },
            { header: 'Velocity / self', className: 'text-right', cell: (r: any) => <span className="num">{r.suspicious}</span> }, { header: 'Distinct IPs', className: 'text-right', cell: (r: any) => <span className="num">{r.distinctIps}</span> }]} />}
      </Card>
      {dialog}
    </>
  );
}

// ---------------------------------------------------------------- Content moderation
export function AdminModeration() {
  useSeo('Content moderation', undefined, { noindex: true });
  const [tab, setTab] = useState('reports');
  const [target, setTarget] = useState<any | null>(null);
  const [action, setAction] = useState('RESOLVE');
  const [resolution, setResolution] = useState('');
  const qc = useQueryClient();
  const toast = useToast();
  const resolve = useMutation({ mutationFn: () => api(`/admin/moderation/reports/${target.id}/resolve`, { method: 'POST', body: { action, resolution } }), onSuccess: () => { setTarget(null); setResolution(''); qc.invalidateQueries({ queryKey: ['admin-reports'] }); qc.invalidateQueries({ queryKey: ['admin-modhistory'] }); toast('Report handled'); } });
  return (
    <>
      <PageHeader title="Content moderation" description="Reported listings and profiles, copyright complaints, takedowns and moderation history." />
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'reports', label: 'Reports' }, { id: 'history', label: 'Moderation history' }]} />
      {tab === 'reports' && <ResourceTable queryKey="admin-reports" url="/admin/moderation/reports" initial={{ status: 'OPEN' }}
        filters={[{ name: 'status', label: 'Status', options: opts(['OPEN', 'RESOLVED', 'DISMISSED']) }, { name: 'reason', label: 'Reason', options: opts(['COPYRIGHT', 'SCAM', 'SPAM', 'ILLEGAL', 'MISLEADING', 'OTHER']) }]} empty={{ kind: 'search', title: 'No reports in this view' }}
        columns={[
          { header: 'Report', primary: true, cell: (r: any) => <><span className="font-semibold text-ink-900">{titleCase(r.reason)}: {r.targetName || 'Deleted item'}</span><span className="block text-xs text-ink-500">{titleCase(r.targetType)} · reported by {r.reporterEmail || 'anonymous visitor'} · {dateTime(r.createdAt)}</span>{r.details && <span className="mt-1 block max-w-lg text-sm text-ink-600">{r.details}</span>}{r.resolution && <span className="mt-1 block text-sm text-ink-500">Resolution: {r.resolution}</span>}</> },
          { header: 'Status', cell: (r: any) => <StatusBadge status={r.status} /> },
          { header: '', cell: (r: any) => r.status === 'OPEN' ? <Button size="sm" onClick={() => { setTarget(r); setAction('RESOLVE'); }}>Handle</Button> : null },
        ]} />}
      {tab === 'history' && <ResourceTable queryKey="admin-modhistory" url="/admin/moderation/history" empty={{ kind: 'analytics', title: 'No moderation actions yet' }}
        columns={[{ header: 'Action', primary: true, cell: (h: any) => <><span className="font-semibold text-ink-900">{titleCase(h.action)}</span><span className="block text-xs text-ink-500">{titleCase(h.targetType)} {String(h.targetId).slice(0, 8)}</span></> }, { header: 'Reason', cell: (h: any) => h.reason || '—' }, { header: 'Admin', cell: (h: any) => h.adminEmail }, { header: 'When', cell: (h: any) => dateTime(h.createdAt) }]} />}
      <Modal open={!!target} title="Handle report" onClose={() => setTarget(null)} footer={<><Button variant="secondary" onClick={() => setTarget(null)}>Cancel</Button><Button variant={action === 'REMOVE_CONTENT' ? 'danger' : 'primary'} loading={resolve.isPending} disabled={!resolution.trim()} onClick={() => resolve.mutate()}>Confirm</Button></>}>
        <div className="space-y-4">
          <Select label="Decision" value={action} onChange={(e) => setAction(e.target.value)}><option value="RESOLVE">Resolve without removing content</option><option value="REMOVE_CONTENT">Remove the reported content (takedown)</option><option value="DISMISS">Dismiss the report</option></Select>
          {action === 'REMOVE_CONTENT' && <Alert tone="warning">A campaign is terminated; a business or creator profile is hidden from public pages. The owner is notified for campaigns.</Alert>}
          <Textarea label="Resolution note (required)" value={resolution} onChange={(e) => setResolution(e.target.value)} maxLength={500} />
          {resolve.isError && <Alert tone="danger">{(resolve.error as Error).message}</Alert>}
        </div>
      </Modal>
    </>
  );
}

// ---------------------------------------------------------------- Reports
const REPORTS = [['acquisition', 'Acquisition'], ['sources', 'Sign-up sources'], ['revenue', 'Revenue'], ['campaigns', 'Campaigns'], ['conversions', 'Conversions'], ['retention', 'Retention and liquidity'], ['events', 'Product events']];
export function AdminReports() {
  useSeo('Reports', undefined, { noindex: true });
  const [type, setType] = useState('acquisition');
  const [days, setDays] = useState(30);
  const toast = useToast();
  const q = useQuery({ queryKey: ['admin-report', type, days], queryFn: () => api<any>(`/admin/analytics/${type}?days=${days}`) });
  const exportCsv = async () => {
    const res = await fetch(`/api/v1/admin/analytics/${type}?days=${days}&format=csv`, { headers: { Authorization: `Bearer ${getAccessToken()}` }, credentials: 'include' });
    if (!res.ok) { toast('Export failed', 'danger'); return; }
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement('a'); a.href = url; a.download = `promora-${type}-report.csv`; a.click(); URL.revokeObjectURL(url);
  };
  const rows: any[] = q.data?.rows || [];
  const keys = rows[0] ? Object.keys(rows[0]) : [];
  const cell = (k: string, v: any) => v === null || v === undefined ? '—' : k.endsWith('Paise') ? money(v) : typeof v === 'number' ? count(v) : /^\d{4}-\d{2}-\d{2}T/.test(String(v)) ? dateTime(v) : String(v);
  const chartSeries = type === 'acquisition' ? [{ key: 'registrations', label: 'Registrations', color: '#3B82F6' }, { key: 'landingPageViews', label: 'Landing page views', color: '#C9CEDD' }]
    : type === 'conversions' ? [{ key: 'clicks', label: 'Clicks', color: '#C9CEDD' }, { key: 'qualifiedClicks', label: 'Qualified', color: '#6C4CF1' }] : null;
  return (
    <>
      <PageHeader title="Reports and analytics" description="Computed from persisted events and business records." actions={<Button variant="secondary" disabled={!rows.length} onClick={exportCsv}><Download className="h-4 w-4" aria-hidden />Export CSV</Button>} />
      <div className="mb-5 flex flex-col gap-3 sm:flex-row"><select className="input sm:w-72" aria-label="Report" value={type} onChange={(e) => setType(e.target.value)}>{REPORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        <select className="input sm:w-48" aria-label="Period" value={days} onChange={(e) => setDays(Number(e.target.value))}>{[7, 30, 90, 365].map((d) => <option key={d} value={d}>Last {d} days</option>)}</select></div>
      {chartSeries && rows.length > 0 && <Card title="Trend" className="mb-6"><BarChart data={[...rows].reverse()} labelKey="day" series={chartSeries} /></Card>}
      <Card padded={false}>
        {q.isLoading ? <Spinner /> : q.isError ? <div className="p-6"><ErrorState error={q.error} onRetry={() => q.refetch()} /></div> : rows.length === 0 ? <EmptyState kind="analytics" title="No analytics available" text="There is no data for this report in the selected period." />
          : <DataTable rows={rows} rowKey={(r: any) => JSON.stringify(r)} columns={keys.map((k, i) => ({ header: titleCase(k.replace(/([A-Z])/g, '_$1').replace(/_paise$/i, '')), primary: i === 0, className: i === 0 ? '' : 'text-right', cell: (r: any) => <span className="num">{cell(k, r[k])}</span> }))} />}
      </Card>
    </>
  );
}

// ---------------------------------------------------------------- Settings
export function AdminSettings() {
  useSeo('Platform settings', undefined, { noindex: true });
  const { can } = useAuth();
  const editable = can('settings.manage');
  const qc = useQueryClient();
  const toast = useToast();
  const [tab, setTab] = useState('rules');
  const q = useQuery({ queryKey: ['admin-settings'], queryFn: () => api<any>('/admin/settings') });
  const [edit, setEdit] = useState<any | null>(null);
  const [value, setValue] = useState('');
  const [cat, setCat] = useState<any | null>(null);
  const [plan, setPlan] = useState<any | null>(null);
  const [ann, setAnn] = useState({ title: '', body: '' });
  const done = (msg: string) => { qc.invalidateQueries({ queryKey: ['admin-settings'] }); qc.invalidateQueries({ queryKey: ['categories'] }); qc.invalidateQueries({ queryKey: ['plans'] }); qc.invalidateQueries({ queryKey: ['announcements'] }); toast(msg); };
  const saveSetting = useMutation({ mutationFn: () => api(`/admin/settings/${edit.key}`, { method: 'PUT', body: { value } }), onSuccess: () => { setEdit(null); done('Setting saved'); } });
  const saveCat = useMutation({ mutationFn: () => api(cat.id ? `/admin/categories/${cat.id}` : '/admin/categories', { method: cat.id ? 'PUT' : 'POST', body: { name: cat.name, description: cat.description || '', icon: cat.icon || 'Tag', active: cat.active, sortOrder: Number(cat.sortOrder) || 0 } }), onSuccess: () => { setCat(null); done('Category saved'); } });
  const savePlan = useMutation({ mutationFn: () => api(`/admin/plans/${plan.id}`, { method: 'PUT', body: { name: plan.name, pricePaise: Math.round(Number(plan.priceRupees) * 100), maxActiveCampaigns: Number(plan.maxActiveCampaigns), platformFeeBps: Math.round(Number(plan.feePercent) * 100), features: plan.features, highlighted: plan.highlighted, active: plan.active } }), onSuccess: () => { setPlan(null); done('Plan saved'); } });
  const announce = useMutation({ mutationFn: () => api('/admin/announcements', { method: 'POST', body: ann }), onSuccess: () => { setAnn({ title: '', body: '' }); done('Announcement published'); } });
  const toggleAnn = useMutation({ mutationFn: (a: any) => api(`/admin/announcements/${a.id}/${a.active ? 'deactivate' : 'activate'}`, { method: 'POST' }), onSuccess: () => done('Announcement updated') });
  if (q.isLoading) return <Spinner />;
  if (q.isError) return <ErrorState error={q.error} />;
  const d = q.data;
  const group = (prefix: string[]) => d.settings.filter((s: any) => prefix.some((p) => s.key.startsWith(p)));
  const settingList = (rows: any[]) => <ul className="divide-y divide-ink-100">{rows.map((s: any) => (
    <li key={s.key} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="font-semibold">{s.description || s.key}</p><p className="text-xs text-ink-500">{s.key}</p><p className="num mt-1 break-words text-sm text-ink-800">{s.key.endsWith('_paise') ? `${money(s.value)} (${s.value} paise)` : s.key.endsWith('_bps') ? `${Number(s.value) / 100}% (${s.value} bps)` : s.value}</p></div>
      {editable && <Button size="sm" variant="secondary" onClick={() => { setEdit(s); setValue(s.value); }}>Edit</Button>}</li>))}</ul>;
  return (
    <>
      <PageHeader title="Platform settings" description="Categories, plans, commission and referral rules, policies, templates and announcements." />
      {!editable && <div className="mb-5"><Alert tone="info">You can view settings. Changing them requires the super admin role.</Alert></div>}
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'rules', label: 'Commission and referral rules' }, { id: 'categories', label: 'Categories' }, { id: 'plans', label: 'Subscription plans' }, { id: 'policies', label: 'Policies and templates' }, { id: 'announcements', label: 'Announcements' }]} />
      {tab === 'rules' && <Card padded={false}>{settingList(group(['commission.', 'payout.', 'referral.', 'tracking.', 'campaign.min']))}</Card>}
      {tab === 'policies' && <Card padded={false}>{settingList(group(['campaign.policy', 'notification.']))}</Card>}
      {tab === 'categories' && <Card padded={false} title="Categories" actions={editable && <Button size="sm" onClick={() => setCat({ name: '', description: '', icon: 'Tag', active: true, sortOrder: d.categories.length + 1 })}>Add category</Button>}>
        <DataTable rows={d.categories} rowKey={(c: any) => c.id} columns={[{ header: 'Name', primary: true, cell: (c: any) => <><span className="font-semibold text-ink-900">{c.name}</span><span className="block text-xs text-ink-500">{c.description}</span></> }, { header: 'Icon', cell: (c: any) => c.icon }, { header: 'Order', cell: (c: any) => c.sortOrder }, { header: 'Status', cell: (c: any) => <StatusBadge status={c.active ? 'ACTIVE' : 'PAUSED'} /> }, { header: '', cell: (c: any) => editable ? <Button size="sm" variant="secondary" onClick={() => setCat({ ...c })}>Edit</Button> : null }]} /></Card>}
      {tab === 'plans' && <Card padded={false}><DataTable rows={d.plans} rowKey={(p: any) => p.id} columns={[{ header: 'Plan', primary: true, cell: (p: any) => <><span className="font-semibold text-ink-900">{p.name}</span><span className="block text-xs text-ink-500">{p.code}</span></> }, { header: 'Price', className: 'text-right', cell: (p: any) => <span className="num">{money(p.pricePaise)}</span> }, { header: 'Platform fee', className: 'text-right', cell: (p: any) => `${p.platformFeeBps / 100}%` }, { header: 'Campaign limit', className: 'text-right', cell: (p: any) => p.maxActiveCampaigns }, { header: 'Status', cell: (p: any) => <StatusBadge status={p.active ? 'ACTIVE' : 'PAUSED'} /> },
        { header: '', cell: (p: any) => editable ? <Button size="sm" variant="secondary" onClick={() => setPlan({ ...p, priceRupees: p.pricePaise / 100, feePercent: p.platformFeeBps / 100 })}>Edit</Button> : null }]} /></Card>}
      {tab === 'announcements' && <div className="space-y-6">
        {editable && <Card title="Publish an announcement" description="The newest active announcement is shown at the top of the public site."><div className="grid max-w-2xl gap-4"><Input label="Title" value={ann.title} maxLength={160} onChange={(e) => setAnn({ ...ann, title: e.target.value })} /><Textarea label="Message" rows={3} value={ann.body} maxLength={1000} onChange={(e) => setAnn({ ...ann, body: e.target.value })} />{announce.isError && <Alert tone="danger">{(announce.error as Error).message}</Alert>}<div><Button loading={announce.isPending} disabled={!ann.title.trim() || !ann.body.trim()} onClick={() => announce.mutate()}>Publish</Button></div></div></Card>}
        <Card title="Announcements" padded={false}>{d.announcements.length === 0 ? <EmptyState kind="notifications" title="No announcements" /> : <ul className="divide-y divide-ink-100">{d.announcements.map((a: any) => <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"><div><p className="font-semibold">{a.title}</p><p className="text-sm text-ink-600">{a.body}</p><p className="text-xs text-ink-400">{dateTime(a.createdAt)}</p></div><div className="flex items-center gap-3"><StatusBadge status={a.active ? 'ACTIVE' : 'PAUSED'} />{editable && <Button size="sm" variant="secondary" onClick={() => toggleAnn.mutate(a)}>{a.active ? 'Deactivate' : 'Activate'}</Button>}</div></li>)}</ul>}</Card></div>}
      <Modal open={!!edit} title="Edit setting" onClose={() => setEdit(null)} footer={<><Button variant="secondary" onClick={() => setEdit(null)}>Cancel</Button><Button loading={saveSetting.isPending} onClick={() => saveSetting.mutate()}>Save setting</Button></>}>
        <div className="space-y-4"><p className="text-sm text-ink-600">{edit?.description}</p>{edit && edit.value.length > 60 ? <Textarea label={edit.key} rows={5} value={value} onChange={(e) => setValue(e.target.value)} /> : <Input label={edit?.key || ''} value={value} onChange={(e) => setValue(e.target.value)} hint={edit?.key.endsWith('_paise') ? 'In paise: 100 paise = ₹1.' : edit?.key.endsWith('_bps') ? 'In basis points: 100 = 1%.' : undefined} />}<Alert tone="warning">Changes apply to new transactions immediately and are recorded in the audit log.</Alert>{saveSetting.isError && <Alert tone="danger">{(saveSetting.error as Error).message}</Alert>}</div>
      </Modal>
      <Modal open={!!cat} title={cat?.id ? 'Edit category' : 'Add category'} onClose={() => setCat(null)} footer={<><Button variant="secondary" onClick={() => setCat(null)}>Cancel</Button><Button loading={saveCat.isPending} disabled={!cat?.name?.trim()} onClick={() => saveCat.mutate()}>Save category</Button></>}>
        {cat && <div className="space-y-4"><Input label="Name" value={cat.name} onChange={(e) => setCat({ ...cat, name: e.target.value })} /><Input label="Description" value={cat.description || ''} onChange={(e) => setCat({ ...cat, description: e.target.value })} />
          <div className="grid grid-cols-2 gap-4"><Select label="Icon" value={cat.icon} onChange={(e) => setCat({ ...cat, icon: e.target.value })}>{['Tag', 'Building2', 'ShoppingBag', 'Smartphone', 'Video', 'GraduationCap', 'Briefcase', 'CalendarDays', 'MapPin', 'Link2', 'Megaphone', 'Sparkles', 'Store', 'Heart', 'Users'].map((i) => <option key={i}>{i}</option>)}</Select><Input label="Sort order" type="number" min={0} value={cat.sortOrder} onChange={(e) => setCat({ ...cat, sortOrder: e.target.value })} /></div>
          <label className="flex items-center gap-2.5 text-sm"><input type="checkbox" className="h-4 w-4 rounded border-ink-300" checked={cat.active} onChange={(e) => setCat({ ...cat, active: e.target.checked })} />Active (shown in the marketplace)</label>{saveCat.isError && <Alert tone="danger">{(saveCat.error as Error).message}</Alert>}</div>}
      </Modal>
      <Modal open={!!plan} title={`Edit plan: ${plan?.code}`} onClose={() => setPlan(null)} footer={<><Button variant="secondary" onClick={() => setPlan(null)}>Cancel</Button><Button loading={savePlan.isPending} onClick={() => savePlan.mutate()}>Save plan</Button></>}>
        {plan && <div className="space-y-4"><Input label="Name" value={plan.name} onChange={(e) => setPlan({ ...plan, name: e.target.value })} />
          <div className="grid grid-cols-3 gap-4"><Input label="Price (₹ / month)" type="number" min={0} value={plan.priceRupees} onChange={(e) => setPlan({ ...plan, priceRupees: e.target.value })} /><Input label="Platform fee (%)" type="number" min={0} max={100} step={0.5} value={plan.feePercent} onChange={(e) => setPlan({ ...plan, feePercent: e.target.value })} /><Input label="Campaign limit" type="number" min={1} value={plan.maxActiveCampaigns} onChange={(e) => setPlan({ ...plan, maxActiveCampaigns: e.target.value })} /></div>
          <Textarea label="Features" hint="Separate features with the | character." rows={3} value={plan.features} onChange={(e) => setPlan({ ...plan, features: e.target.value })} />
          <div className="flex gap-6 text-sm"><label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4 rounded border-ink-300" checked={plan.highlighted} onChange={(e) => setPlan({ ...plan, highlighted: e.target.checked })} />Highlight as most popular</label><label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4 rounded border-ink-300" checked={plan.active} onChange={(e) => setPlan({ ...plan, active: e.target.checked })} />Active</label></div>{savePlan.isError && <Alert tone="danger">{(savePlan.error as Error).message}</Alert>}</div>}
      </Modal>
    </>
  );
}

// ---------------------------------------------------------------- Audit and operations
export function AdminAudit() {
  useSeo('Audit log', undefined, { noindex: true });
  return (
    <>
      <PageHeader title="Admin audit log" description="An append-only record of sensitive actions. Rows cannot be edited or deleted, even in the database." />
      <ResourceTable queryKey="admin-audit" url="/admin/audit-logs" searchable searchPlaceholder="Search action, actor or target id" size={50} empty={{ kind: 'analytics', title: 'No audit entries' }}
        columns={[{ header: 'Action', primary: true, cell: (a: any) => <span className="font-semibold text-ink-900">{titleCase(a.action)}</span> }, { header: 'Actor', cell: (a: any) => a.actorEmail || 'System' }, { header: 'Target', cell: (a: any) => a.targetType ? `${titleCase(a.targetType)} ${String(a.targetId || '').slice(0, 8)}` : '—' },
          { header: 'Details', cell: (a: any) => <span className="block max-w-sm break-words">{a.details || '—'}</span> }, { header: 'IP', cell: (a: any) => a.ip || '—' }, { header: 'When', cell: (a: any) => dateTime(a.createdAt) }]} />
    </>
  );
}

export function AdminOperations() {
  useSeo('Email and contact log', undefined, { noindex: true });
  const { can } = useAuth();
  const [tab, setTab] = useState('email');
  return (
    <>
      <PageHeader title="Email and contact log" description="Outgoing email records and messages from the contact form." />
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'email', label: 'Email log' }, ...(can('content.moderate') ? [{ id: 'contact', label: 'Contact messages' }] : [])]} />
      {tab === 'email' && <ResourceTable queryKey="admin-email" url="/admin/email-log" empty={{ kind: 'notifications', title: 'No emails recorded' }}
        columns={[{ header: 'Subject', primary: true, cell: (e: any) => <span className="font-semibold text-ink-900">{e.subject}</span> }, { header: 'To', cell: (e: any) => e.toEmail }, { header: 'Transport', cell: (e: any) => e.transport === 'log' ? 'Not sent (no mail server configured)' : 'SMTP' }, { header: 'When', cell: (e: any) => dateTime(e.createdAt) }]} />}
      {tab === 'contact' && <ResourceTable queryKey="admin-contact" url="/admin/contact-messages" empty={{ kind: 'notifications', title: 'No contact messages' }}
        columns={[{ header: 'Message', primary: true, cell: (m: any) => <><span className="font-semibold text-ink-900">{m.subject}</span><span className="block text-xs text-ink-500">{m.name} · {m.email}</span><span className="mt-1 block max-w-xl whitespace-pre-line text-sm text-ink-600">{m.message}</span></> }, { header: 'When', cell: (m: any) => dateTime(m.createdAt) }]} />}
    </>
  );
}

// ---------------------------------------------------------------- Routes
export function AdminRoutes() {
  return (
    <Routes>
      <Route index element={<AdminDashboard />} />
      <Route path="users" element={<AdminUsers />} />
      <Route path="users/:id" element={<AdminUserDetail />} />
      <Route path="campaigns" element={<AdminCampaigns />} />
      <Route path="campaigns/:id" element={<AdminCampaignDetail />} />
      <Route path="verifications" element={<AdminVerifications />} />
      <Route path="finance" element={<AdminFinance />} />
      <Route path="payouts" element={<Navigate to="/admin/finance?tab=payouts" replace />} />
      <Route path="referrals" element={<AdminReferrals />} />
      <Route path="fraud" element={<AdminFraud />} />
      <Route path="moderation" element={<AdminModeration />} />
      <Route path="reports" element={<AdminReports />} />
      <Route path="settings" element={<AdminSettings />} />
      <Route path="audit" element={<AdminAudit />} />
      <Route path="operations" element={<AdminOperations />} />
      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Routes>
  );
}
