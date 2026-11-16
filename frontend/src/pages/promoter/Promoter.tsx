import { useState } from 'react';
import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Banknote, Clock, ExternalLink, Link2, MousePointerClick, Share2, Wallet } from 'lucide-react';
import { api, newKey } from '../../lib/api';
import { track } from '../../lib/analytics';
import { useAuth } from '../../lib/auth';
import { count, date, dateTime, money, rewardLabel, titleCase } from '../../lib/format';
import { useSeo } from '../../lib/seo';
import { BarChart } from '../../components/charts';
import { ResourceTable } from '../../components/ResourceTable';
import { Alert, Button, Card, ConfirmDialog, EmptyState, ErrorState, LinkButton, PageHeader, Spinner, StatCard, StatusBadge, useToast } from '../../components/ui';
import { CopyButton } from '../dashboard/Account';
import { CampaignBrowser } from '../public/Pages';

const SERIES = [{ key: 'clicks', label: 'All clicks', color: '#C9CEDD' }, { key: 'qualified', label: 'Qualified clicks', color: '#6C4CF1' }];

export function PromoterDashboard() {
  useSeo('Promoter dashboard', undefined, { noindex: true });
  const q = useQuery({ queryKey: ['promoter', 'dashboard'], queryFn: () => api<any>('/promoter/dashboard') });
  if (q.isLoading) return <Spinner />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const b = q.data.balances, s = q.data.summary;
  return (
    <>
      <PageHeader title="Promoter dashboard" description="Your promotions, clicks and earnings." actions={<LinkButton to="/dashboard/promoter/marketplace">Find campaigns</LinkButton>} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Available for payout" value={money(b.availablePaise)} hint={`Minimum payout ${money(q.data.minimumPayoutPaise)}`} icon={<Wallet className="h-4 w-4" />} />
        <StatCard label="Pending verification" value={money(b.pendingPaise)} hint="Clears after the hold period" icon={<Clock className="h-4 w-4" />} />
        <StatCard label="Paid out" value={money(b.paidPaise)} icon={<Banknote className="h-4 w-4" />} />
        <StatCard label="Qualified clicks" value={count(s.qualifiedClicks)} hint={`${count(s.clicks)} total clicks · ${count(s.conversions)} conversions`} icon={<MousePointerClick className="h-4 w-4" />} />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <Card title="Clicks, last 14 days"><BarChart data={q.data.daily} series={SERIES} labelKey="day" /></Card>
        <Card title="Your promotions">
          <dl className="space-y-3"><div className="flex justify-between"><dt className="text-ink-600">Approved campaigns</dt><dd className="num font-semibold">{s.approvedCampaigns}</dd></div><div className="flex justify-between"><dt className="text-ink-600">Pending applications</dt><dd className="num font-semibold">{s.pendingApplications}</dd></div></dl>
          <div className="mt-5 grid gap-2"><LinkButton to="/dashboard/promoter/campaigns" variant="secondary">My promotions and links</LinkButton><LinkButton to="/dashboard/promoter/earnings" variant="secondary">Earnings and payouts</LinkButton></div>
        </Card>
      </div>
    </>
  );
}

export function PromoterMarketplace() {
  useSeo('Find campaigns', undefined, { noindex: true });
  return <><PageHeader title="Find campaigns" description="Live campaigns you can apply to. Open a campaign to read the brief and apply." /><CampaignBrowser embedded /></>;
}

export function MyPromotions() {
  useSeo('My promotions', undefined, { noindex: true });
  const qc = useQueryClient();
  const toast = useToast();
  const [withdraw, setWithdraw] = useState<any | null>(null);
  const m = useMutation({ mutationFn: (id: string) => api(`/promoter/applications/${id}`, { method: 'DELETE' }), onSuccess: () => { setWithdraw(null); qc.invalidateQueries({ queryKey: ['my-applications'] }); toast('Application withdrawn'); } });
  const share = async (a: any) => {
    track('promotion_shared', { campaignId: a.campaignId, target: 'share' });
    const text = `${a.title} (Ad)`;
    if (navigator.share) { try { await navigator.share({ title: a.title, text, url: a.trackingUrl }); } catch { /* share cancelled */ } }
    else window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${a.trackingUrl}`)}`, '_blank', 'noopener');
  };
  return (
    <>
      <PageHeader title="My promotions" description="Your applications, tracking links and results for each campaign." actions={<LinkButton to="/dashboard/promoter/marketplace">Find campaigns</LinkButton>} />
      <ResourceTable queryKey="my-applications" url="/promoter/applications"
        filters={[{ name: 'status', label: 'Status', options: ['PENDING', 'APPROVED', 'REJECTED', 'REMOVED', 'WITHDRAWN'].map((x) => ({ value: x, label: titleCase(x) })) }]}
        empty={{ kind: 'promotions', title: 'No active promotions', text: 'Apply to a campaign to get your first tracking link.', action: <LinkButton to="/dashboard/promoter/marketplace">Find campaigns</LinkButton> }}
        columns={[
          { header: 'Campaign', primary: true, cell: (a: any) => (
            <div className="max-w-xl">
              <Link to={`/campaigns/${a.campaignId}`} className="font-semibold text-ink-900 hover:text-brand-600">{a.title}</Link>
              <span className="block text-xs text-ink-500">{a.businessName} · {rewardLabel(a.rewardType, a.rewardPaise)} · campaign {titleCase(a.campaignStatus).toLowerCase()}</span>
              {a.status === 'APPROVED' && a.trackingUrl && (
                <div className="mt-3 rounded-xl border border-brand-200 bg-brand-50 p-3">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-brand-700"><Link2 className="h-3.5 w-3.5" aria-hidden />Your tracking link</p>
                  <p className="num mt-1 break-all text-sm text-ink-900">{a.trackingUrl}</p>
                  <div className="mt-2 flex flex-wrap gap-2"><CopyButton text={a.trackingUrl} label="Copy link" onCopied={() => track('promotion_shared', { campaignId: a.campaignId, target: 'copy' })} /><Button size="sm" onClick={() => share(a)}><Share2 className="h-4 w-4" aria-hidden />Share</Button></div>
                  {a.promoInstructions && <p className="mt-3 text-sm text-ink-700"><span className="font-semibold">Instructions: </span>{a.promoInstructions}</p>}
                  <p className="mt-2 text-sm text-ink-700"><span className="font-semibold">Disclosure: </span>{a.disclosureText || 'Label your post as an Ad.'}</p>
                  {a.campaignStatus !== 'ACTIVE' && <p className="mt-2 text-sm font-medium text-warning-700">The campaign is not active, so clicks are not earning right now.</p>}
                </div>
              )}
              {a.decisionNote && a.status !== 'APPROVED' && <span className="mt-1 block text-sm text-ink-600">Note: {a.decisionNote}</span>}
            </div>) },
          { header: 'Status', cell: (a: any) => <StatusBadge status={a.status} /> },
          { header: 'Clicks', className: 'text-right', cell: (a: any) => <span className="num">{count(a.qualifiedClicks)} qualified<span className="block text-xs text-ink-400">{count(a.clicks)} total</span></span> },
          { header: 'Conversions', className: 'text-right', cell: (a: any) => <span className="num">{count(a.conversions)}</span> },
          { header: 'Earned', className: 'text-right', cell: (a: any) => <span className="num font-semibold">{money(a.earnedPaise)}</span> },
          { header: '', cell: (a: any) => ['PENDING', 'APPROVED'].includes(a.status) ? <Button size="sm" variant="ghost" onClick={() => setWithdraw(a)}>Withdraw</Button> : null },
        ]} />
      <ConfirmDialog open={!!withdraw} title="Withdraw from this campaign?" message="Your tracking link will stop working. Earnings already recorded are kept." danger confirmLabel="Withdraw" busy={m.isPending} error={m.isError ? (m.error as Error).message : null} onClose={() => setWithdraw(null)} onConfirm={() => m.mutate(withdraw.id)} />
    </>
  );
}

export function Earnings() {
  useSeo('Earnings and payouts', undefined, { noindex: true });
  const { user } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  const [page, setPage] = useState(0);
  const q = useQuery({ queryKey: ['promoter', 'earnings', page], queryFn: () => api<any>(`/promoter/earnings?page=${page}&size=20`) });
  const dash = useQuery({ queryKey: ['promoter', 'dashboard'], queryFn: () => api<any>('/promoter/dashboard') });
  // One key per attempt: a double click or a retry cannot create two payouts.
  const [key, setKey] = useState(newKey());
  const payout = useMutation({ mutationFn: () => api('/promoter/payouts', { method: 'POST', idempotencyKey: key }), onSuccess: () => { setConfirm(false); setKey(newKey()); qc.invalidateQueries({ queryKey: ['promoter'] }); toast('Payout requested'); } });
  if (q.isLoading) return <Spinner />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const b = q.data.balances, min = dash.data?.minimumPayoutPaise ?? 0, upi = user?.promoterProfile?.upiId;
  const canRequest = b.availablePaise >= min && b.availablePaise > 0 && !!upi && !!user?.emailVerified;
  return (
    <>
      <PageHeader title="Earnings and payouts" description="Commissions are created only for verified, eligible events." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Available for payout" value={money(b.availablePaise)} /><StatCard label="Pending verification" value={money(b.pendingPaise)} /><StatCard label="In payout" value={money(b.inPayoutPaise)} /><StatCard label="Paid out" value={money(b.paidPaise)} />
      </div>
      <Card className="mt-6" title="Request a payout" description={`Minimum ${money(min)}. Paid to your UPI ID after review.`}
        actions={<Button disabled={!canRequest} onClick={() => setConfirm(true)}><Banknote className="h-4 w-4" aria-hidden />Request {money(b.availablePaise)}</Button>}>
        {!upi ? <Alert tone="warning" title="Add your UPI ID" action={<LinkButton size="sm" variant="secondary" to="/dashboard/settings?tab=promoter">Add UPI ID</LinkButton>}>A payout method is needed before you can request a payout.</Alert>
          : !user?.emailVerified ? <Alert tone="warning">Verify your email address to request payouts.</Alert>
          : b.availablePaise < min ? <p className="text-sm text-ink-600">You need {money(min - b.availablePaise)} more in cleared earnings to request a payout to <span className="font-semibold">{upi}</span>.</p>
          : <p className="text-sm text-ink-600">Your full available balance will be sent to <span className="font-semibold">{upi}</span>.</p>}
      </Card>
      <Card title="Payout requests" padded={false} className="mt-6">
        {q.data.payouts.length === 0 ? <EmptyState kind="transactions" title="No payout requests yet" /> : (
          <ul className="divide-y divide-ink-100">{q.data.payouts.map((p: any) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"><div><p className="num font-semibold">{money(p.amountPaise)} <span className="text-sm font-normal text-ink-500">to {p.upiId}</span></p><p className="text-sm text-ink-500">Requested {dateTime(p.createdAt)}{p.paidReference && ` · Ref ${p.paidReference}`}{p.adminNote && ` · ${p.adminNote}`}</p></div><StatusBadge status={p.status} /></li>))}</ul>)}
      </Card>
      <Card title="Earnings history" padded={false} className="mt-6">
        {q.data.commissions.items.length === 0 ? <EmptyState kind="analytics" title="No earnings yet" text="Share a tracking link to earn your first commission." action={<LinkButton to="/dashboard/promoter/campaigns">My promotions<ExternalLink className="h-4 w-4" aria-hidden /></LinkButton>} /> : (
          <ul className="divide-y divide-ink-100">{q.data.commissions.items.map((c: any) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"><div><p className="font-semibold">{c.campaignTitle}</p><p className="text-sm text-ink-500">{c.conversionType === 'LEAD' ? 'Verified lead' : 'Qualified click'} · {dateTime(c.createdAt)}{c.status === 'PENDING' && ` · clears ${date(c.holdUntil)}`}</p></div><div className="flex items-center gap-3"><span className="num font-semibold">{money(c.amountPaise)}</span><StatusBadge status={c.status} /></div></li>))}</ul>)}
        {q.data.commissions.totalPages > 1 && <div className="flex justify-end gap-2 border-t border-ink-200 px-5 py-3"><Button size="sm" variant="secondary" disabled={page === 0} onClick={() => setPage(page - 1)}>Newer</Button><Button size="sm" variant="secondary" disabled={page >= q.data.commissions.totalPages - 1} onClick={() => setPage(page + 1)}>Older</Button></div>}
      </Card>
      <ConfirmDialog open={confirm} title="Request this payout?" message={<>We will review and send <strong>{money(b.availablePaise)}</strong> to <strong>{upi}</strong>.</>} confirmLabel="Request payout" busy={payout.isPending} error={payout.isError ? (payout.error as Error).message : null} onClose={() => setConfirm(false)} onConfirm={() => payout.mutate()} />
    </>
  );
}

// ---------------------------------------------------------------- Routes
export function PromoterRoutes() {
  const { hasRole } = useAuth();
  if (!hasRole('PROMOTER')) return <Navigate to="/dashboard/settings?tab=promoter" replace />;
  return (
    <Routes>
      <Route index element={<PromoterDashboard />} />
      <Route path="marketplace" element={<PromoterMarketplace />} />
      <Route path="campaigns" element={<MyPromotions />} />
      <Route path="applications" element={<Navigate to="/dashboard/promoter/campaigns" replace />} />
      <Route path="earnings" element={<Earnings />} />
      <Route path="*" element={<Navigate to="/dashboard/promoter" replace />} />
    </Routes>
  );
}
