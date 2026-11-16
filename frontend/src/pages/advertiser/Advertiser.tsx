import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { BarChart3, Check, CircleDollarSign, ImagePlus, Megaphone, MousePointerClick, Sparkles, Trash2, UserCheck, Users, Wallet } from 'lucide-react';
import { api, newKey } from '../../lib/api';
import { count, date, dateTime, money, OBJECTIVES, rewardLabel, rupeesToPaise, titleCase } from '../../lib/format';
import { useSeo } from '../../lib/seo';
import { BarChart, ProgressBar } from '../../components/charts';
import { ResourceTable } from '../../components/ResourceTable';
import { Alert, Button, Card, ConfirmDialog, EmptyState, ErrorState, Input, LinkButton, PageHeader, Select, Spinner, StatCard, StatusBadge, Tabs, Textarea, VerifiedMark, useToast, cx } from '../../components/ui';
import { CheckoutModal } from '../dashboard/Account';

const SERIES = [{ key: 'clicks', label: 'All clicks', color: '#C9CEDD' }, { key: 'qualified', label: 'Qualified clicks', color: '#6C4CF1' }];
const CAMPAIGN_STATUSES = ['DRAFT', 'PENDING_REVIEW', 'CHANGES_REQUESTED', 'APPROVED', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED', 'REJECTED', 'TERMINATED'];

export function AdvertiserDashboard() {
  useSeo('Advertiser dashboard', undefined, { noindex: true });
  const q = useQuery({ queryKey: ['advertiser', 'dashboard'], queryFn: () => api<any>('/advertiser/dashboard') });
  if (q.isLoading) return <Spinner />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const s = q.data.summary, p = q.data.performance;
  return (
    <>
      <PageHeader title="Advertiser dashboard" description="Live numbers from your campaigns." actions={<LinkButton to="/dashboard/advertiser/campaigns/new"><Megaphone className="h-4 w-4" aria-hidden />New campaign</LinkButton>} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Campaigns" value={count(s.totalCampaigns)} hint={`${s.activeCampaigns} active`} icon={<Megaphone className="h-4 w-4" />} />
        <StatCard label="Pending approvals" value={count(s.pendingApprovals)} icon={<UserCheck className="h-4 w-4" />} />
        <StatCard label="Total clicks" value={count(p.totalClicks)} hint={`${count(p.qualifiedClicks)} qualified`} icon={<MousePointerClick className="h-4 w-4" />} />
        <StatCard label="Qualified leads" value={count(p.qualifiedLeads)} icon={<Users className="h-4 w-4" />} />
        <StatCard label="Conversions" value={count(p.conversions)} hint="Paid, verified results" icon={<BarChart3 className="h-4 w-4" />} />
        <StatCard label="Campaign expenditure" value={money(s.spentPaise)} hint={`of ${money(s.fundedPaise)} funded`} icon={<Wallet className="h-4 w-4" />} />
      </div>
      <Card title="Clicks, last 14 days" className="mt-6"><BarChart data={q.data.daily} series={SERIES} labelKey="day" /></Card>
      <div className="mt-6"><CampaignList embedded /></div>
    </>
  );
}

export function CampaignList({ embedded }: { embedded?: boolean }) {
  const navigate = useNavigate();
  return (
    <>
      {!embedded && <PageHeader title="My campaigns" actions={<LinkButton to="/dashboard/advertiser/campaigns/new">New campaign</LinkButton>} />}
      <ResourceTable queryKey="advertiser-campaigns" url="/advertiser/campaigns" title={embedded ? 'Your campaigns' : undefined}
        filters={[{ name: 'status', label: 'Status', options: CAMPAIGN_STATUSES.map((s) => ({ value: s, label: titleCase(s) })) }]}
        empty={{ kind: 'campaigns', title: 'No campaigns found', text: 'Create your first campaign to start reaching promoters.', action: <LinkButton to="/dashboard/advertiser/campaigns/new">Create a campaign</LinkButton> }}
        onRowClick={(c: any) => navigate(`/dashboard/advertiser/campaigns/${c.id}`)}
        columns={[
          { header: 'Campaign', primary: true, cell: (c: any) => <><span className="font-semibold text-ink-900">{c.title}</span><span className="block text-xs text-ink-500">{c.categoryName || 'No category'} · {rewardLabel(c.rewardType, c.rewardPaise)}</span></> },
          { header: 'Status', cell: (c: any) => <StatusBadge status={c.status} /> },
          { header: 'Qualified clicks', className: 'text-right', cell: (c: any) => <span className="num">{count(c.qualifiedClicks)}</span> },
          { header: 'Promoters', className: 'text-right', cell: (c: any) => <span className="num">{c.promoters}{c.pendingApplications > 0 && <span className="ml-1 text-warning-700">(+{c.pendingApplications} pending)</span>}</span> },
          { header: 'Spent', className: 'text-right', cell: (c: any) => <span className="num">{money(c.spentPaise)} <span className="text-ink-400">/ {money(c.fundedPaise || c.budgetPaise)}</span></span> },
        ]} />
    </>
  );
}

// ---------------------------------------------------------------- Campaign wizard
const today = () => new Date().toISOString().slice(0, 10);
const wizardSchema = z.object({
  title: z.string().trim().min(5, 'Use at least 5 characters').max(140),
  description: z.string().trim().min(40, 'Describe the campaign in at least 40 characters').max(5000),
  categoryId: z.string().min(1, 'Choose a category'),
  objective: z.string().min(1, 'Choose an objective'),
  targetAudience: z.string().trim().min(10, 'Describe who this is for').max(1000),
  geography: z.string().trim().min(2, 'Enter where this campaign applies').max(300),
  landingUrl: z.string().trim().regex(/^$|^https:\/\/\S{3,490}$/, 'Use a full https:// address'),
  imageUrls: z.array(z.string()).max(6),
  budget: z.coerce.number({ invalid_type_error: 'Enter a budget' }).min(500, 'Minimum budget is ₹500').max(10000000),
  startDate: z.string().optional(), endDate: z.string().optional(),
  rewardType: z.enum(['CPC', 'CPL']),
  reward: z.coerce.number({ invalid_type_error: 'Enter a reward' }).min(1, 'Minimum reward is ₹1').max(10000),
  applicationMode: z.enum(['OPEN', 'APPROVAL']),
  promoInstructions: z.string().trim().max(2000), disclosureText: z.string().trim().max(300),
}).superRefine((v, ctx) => {
  if (v.rewardType === 'CPC' && !v.landingUrl) ctx.addIssue({ code: 'custom', path: ['landingUrl'], message: 'A landing page is required for pay-per-click campaigns' });
  if (v.reward > v.budget) ctx.addIssue({ code: 'custom', path: ['reward'], message: 'Reward cannot be more than the budget' });
  if (v.startDate && v.endDate && v.endDate < v.startDate) ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'End date must be on or after the start date' });
  if (v.endDate && v.endDate < today()) ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'End date is in the past' });
});
type WizardValues = z.infer<typeof wizardSchema>;
const STEPS: { title: string; fields: (keyof WizardValues)[] }[] = [
  { title: 'Campaign details', fields: ['title', 'description'] }, { title: 'Category and objective', fields: ['categoryId', 'objective'] },
  { title: 'Target audience', fields: ['targetAudience'] }, { title: 'Geography', fields: ['geography'] },
  { title: 'Landing page and creatives', fields: ['landingUrl', 'imageUrls'] }, { title: 'Budget and schedule', fields: ['budget', 'startDate', 'endDate'] },
  { title: 'Reward rules', fields: ['rewardType', 'reward', 'applicationMode', 'promoInstructions', 'disclosureText'] }, { title: 'Review and submit', fields: [] },
];

function AiAssist({ title, text, task, onUse }: { title: string; text: string; task: string; onUse: (s: string) => void }) {
  const status = useQuery({ queryKey: ['ai-status'], queryFn: () => api<any>('/ai/status'), staleTime: 600_000 });
  const m = useMutation({ mutationFn: () => api<any>('/ai/assist', { method: 'POST', body: { task, title, text } }) });
  if (!status.data) return null;
  if (!status.data.enabled) return <p className="flex items-center gap-2 rounded-xl bg-ink-50 px-3 py-2 text-sm text-ink-500"><Sparkles className="h-4 w-4" aria-hidden />AI writing assistant is not enabled on this server. Write your own copy, or ask the operator to configure an AI provider.</p>;
  return (
    <div className="rounded-xl border border-brand-200 bg-brand-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><p className="flex items-center gap-2 text-sm font-semibold text-brand-700"><Sparkles className="h-4 w-4" aria-hidden />AI assistant</p>
        <Button size="sm" variant="secondary" loading={m.isPending} disabled={title.trim().length < 5} onClick={() => m.mutate()}>{task === 'IMPROVE' ? 'Improve my text' : 'Suggest'}</Button></div>
      {m.isError && <p className="mt-2 text-sm text-danger-600">{(m.error as Error).message}</p>}
      {m.data && <div className="mt-3"><p className="whitespace-pre-line rounded-lg bg-white p-3 text-sm text-ink-800">{m.data.output}</p><div className="mt-2 flex items-center gap-3"><Button size="sm" onClick={() => onUse(m.data.output)}>Use this</Button><span className="text-xs text-ink-500">AI-generated. Check it for accuracy before using.</span></div></div>}
    </div>
  );
}

export function CampaignWizard() {
  useSeo('Campaign wizard', undefined, { noindex: true });
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [campaignId, setCampaignId] = useState<string | null>(id || null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const categories = useQuery({ queryKey: ['categories'], queryFn: () => api<any[]>('/public/categories'), staleTime: 300_000 });
  const policy = useQuery({ queryKey: ['policy'], queryFn: () => api<any>('/public/policy'), staleTime: 600_000 });
  const existing = useQuery({ queryKey: ['advertiser', 'campaign', id], queryFn: () => api<any>(`/advertiser/campaigns/${id}`), enabled: !!id });
  const form = useForm<WizardValues>({
    resolver: zodResolver(wizardSchema), mode: 'onTouched',
    defaultValues: { title: '', description: '', categoryId: '', objective: 'WEBSITE_VISITS', targetAudience: '', geography: 'India', landingUrl: '', imageUrls: [], budget: 1000, startDate: '', endDate: '', rewardType: 'CPC', reward: 5, applicationMode: 'APPROVAL', promoInstructions: '', disclosureText: 'Label every post as an Ad at the start of the caption.' },
  });
  const { register, formState: { errors }, watch, setValue, trigger, getValues, reset } = form;
  useEffect(() => {
    if (!existing.data) return;
    const c = existing.data.campaign;
    reset({ title: c.title, description: c.description || '', categoryId: c.categoryId || '', objective: c.objective, targetAudience: c.targetAudience || '', geography: c.geography || 'India', landingUrl: c.landingUrl || '',
      imageUrls: existing.data.imageUrls || [], budget: c.budgetPaise / 100, startDate: c.startDate || '', endDate: c.endDate || '', rewardType: c.rewardType, reward: c.rewardPaise / 100, applicationMode: c.applicationMode,
      promoInstructions: c.promoInstructions || '', disclosureText: c.disclosureText || '' });
  }, [existing.data, reset]);
  const v = watch();

  const payload = () => {
    const x = getValues();
    return { title: x.title, description: x.description, categoryId: x.categoryId || null, objective: x.objective, targetAudience: x.targetAudience, geography: x.geography, landingUrl: x.landingUrl,
      rewardType: x.rewardType, rewardPaise: rupeesToPaise(x.reward), budgetPaise: rupeesToPaise(x.budget), startDate: x.startDate || null, endDate: x.endDate || null, applicationMode: x.applicationMode,
      promoInstructions: x.promoInstructions, disclosureText: x.disclosureText, imageUrls: x.imageUrls };
  };
  const save = useMutation({
    mutationFn: async () => {
      const res = campaignId ? await api<any>(`/advertiser/campaigns/${campaignId}`, { method: 'PUT', body: payload() }) : await api<any>('/advertiser/campaigns', { method: 'POST', body: payload() });
      setCampaignId(res.campaign.id);
      return res.campaign.id as string;
    },
  });
  const submit = useMutation({
    mutationFn: async () => { const cid = await save.mutateAsync(); return api<any>(`/advertiser/campaigns/${cid}/submit`, { method: 'POST' }); },
    onSuccess: (res) => { qc.invalidateQueries({ queryKey: ['advertiser'] }); qc.invalidateQueries({ queryKey: ['advertiser-campaigns'] }); toast('Campaign submitted for review'); navigate(`/dashboard/advertiser/campaigns/${res.campaign.id}`); },
  });
  const next = async () => {
    if (!(await trigger(STEPS[step].fields))) return;
    // Drafts are saved on the server from the first step, so nothing is lost on refresh.
    if (step === 0 || campaignId) { try { await save.mutateAsync(); } catch { return; } }
    setStep((s) => Math.min(s + 1, STEPS.length - 1)); window.scrollTo(0, 0);
  };
  const saveDraft = async () => {
    if (!(await trigger(['title']))) { setStep(0); return; }
    try { const cid = await save.mutateAsync(); qc.invalidateQueries({ queryKey: ['advertiser-campaigns'] }); toast('Draft saved'); navigate(`/dashboard/advertiser/campaigns/${cid}`); } catch { /* shown below */ }
  };
  const upload = async (file: File) => {
    setUploadError(null);
    if (file.size > 5 * 1024 * 1024) { setUploadError('Images must be 5 MB or smaller.'); return; }
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) { setUploadError('Only PNG, JPEG and WebP images are accepted.'); return; }
    setUploading(true);
    try { const fd = new FormData(); fd.append('file', file); const res = await api<{ url: string }>('/uploads/images', { method: 'POST', body: fd }); setValue('imageUrls', [...getValues('imageUrls'), res.url]); }
    catch (e: any) { setUploadError(e.message); } finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  if (id && existing.isLoading) return <Spinner />;
  if (id && existing.isError) return <ErrorState error={existing.error} />;
  if (existing.data && !['DRAFT', 'CHANGES_REQUESTED'].includes(existing.data.campaign.status))
    return <Alert tone="warning" title="This campaign can no longer be edited" action={<LinkButton size="sm" variant="secondary" to={`/dashboard/advertiser/campaigns/${id}`}>Open campaign</LinkButton>}>Only drafts and campaigns with requested changes can be edited.</Alert>;
  const category = categories.data?.find((c) => c.id === v.categoryId);
  const estimate = v.reward > 0 ? Math.floor(Number(v.budget || 0) / Number(v.reward)) : 0;

  return (
    <>
      <PageHeader title={id ? 'Edit campaign' : 'New campaign'} description={`Step ${step + 1} of ${STEPS.length}: ${STEPS[step].title}`} back={{ to: '/dashboard/advertiser/campaigns', label: 'My campaigns' }} />
      {existing.data?.campaign.reviewNote && <div className="mb-5"><Alert tone="warning" title="Changes requested by the review team">{existing.data.campaign.reviewNote}</Alert></div>}
      <ol className="mb-6 flex gap-1.5 overflow-x-auto pb-1" aria-label="Wizard steps">
        {STEPS.map((s, i) => (
          <li key={s.title} className="min-w-[2.75rem] flex-1">
            <button type="button" disabled={i > step} onClick={() => setStep(i)} aria-current={i === step ? 'step' : undefined} className="block w-full text-left disabled:cursor-default">
              <span className={cx('block h-1.5 rounded-full', i < step ? 'bg-brand-500' : i === step ? 'bg-brand-300' : 'bg-ink-200')} />
              <span className={cx('mt-2 hidden text-xs font-medium lg:block', i === step ? 'text-brand-600' : 'text-ink-500')}>{i + 1}. {s.title}</span>
            </button>
          </li>))}
      </ol>
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card title={STEPS[step].title}>
          <form className="space-y-5" noValidate onSubmit={(e) => e.preventDefault()}>
            {step === 0 && <>
              <Input label="Campaign title" required maxLength={140} placeholder="e.g. Festive soy candle collection launch" error={errors.title?.message} {...register('title')} />
              <Textarea label="Description" required rows={7} hint="What are you promoting, and why would an audience care? Be accurate: promoters repeat what you write." error={errors.description?.message} {...register('description')} />
              <AiAssist title={v.title} text={v.description} task={v.description.trim().length >= 40 ? 'IMPROVE' : 'DESCRIPTION'} onUse={(s) => setValue('description', s, { shouldValidate: true })} />
              {policy.data && <Alert tone="info" title="Content policy">{policy.data.campaignPolicy}</Alert>}
            </>}
            {step === 1 && <>
              <Select label="Category" required error={errors.categoryId?.message} {...register('categoryId')}><option value="">Choose a category</option>{(categories.data || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
              <Select label="Objective" required error={errors.objective?.message} {...register('objective')}>{Object.entries(OBJECTIVES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select>
              <AiAssist title={v.title} text={v.description} task="CATEGORY" onUse={() => undefined} />
            </>}
            {step === 2 && <>
              <Textarea label="Target audience" required rows={5} hint="Age range, interests, occupations, languages. This helps the right promoters apply." error={errors.targetAudience?.message} {...register('targetAudience')} />
              <AiAssist title={v.title} text={v.description} task="AUDIENCE" onUse={(s) => setValue('targetAudience', s.slice(0, 1000), { shouldValidate: true })} />
            </>}
            {step === 3 && <Input label="Geography" required hint='Countries, states or cities, for example "India" or "Maharashtra, Karnataka".' error={errors.geography?.message} {...register('geography')} />}
            {step === 4 && <>
              <Input label="Landing page URL" placeholder="https://your-site.in/page" hint="Where promoters send visitors. Required for pay-per-click campaigns; lead campaigns use a Promora enquiry form." error={errors.landingUrl?.message} {...register('landingUrl')} />
              <div>
                <p className="label">Creative images</p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {v.imageUrls.map((u) => (
                    <div key={u} className="group relative overflow-hidden rounded-xl border border-ink-200"><img src={u} alt="Campaign creative" className="aspect-[4/3] w-full object-cover" />
                      <button type="button" className="absolute right-2 top-2 rounded-lg bg-white/90 p-1.5 text-danger-600 shadow" aria-label="Remove image" onClick={() => setValue('imageUrls', v.imageUrls.filter((x) => x !== u))}><Trash2 className="h-4 w-4" /></button></div>))}
                  {v.imageUrls.length < 6 && (
                    <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-ink-300 text-sm font-medium text-ink-500 hover:border-brand-400 hover:text-brand-600">
                      <ImagePlus className="h-6 w-6" aria-hidden />{uploading ? 'Uploading…' : 'Add image'}</button>)}
                </div>
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" aria-label="Upload campaign image" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
                <p className="mt-2 text-sm text-ink-500">PNG, JPEG or WebP, up to 5 MB each, up to 6 images. Without an image, your category artwork is shown.</p>
                {uploadError && <p className="mt-1 text-sm text-danger-600" role="alert">{uploadError}</p>}
              </div>
            </>}
            {step === 5 && <>
              <Input label="Promoter reward budget (₹)" type="number" min={500} step={100} inputMode="numeric" required hint="The total you are willing to pay promoters. The platform fee and GST are added at checkout." error={errors.budget?.message} {...register('budget')} />
              <div className="grid gap-5 sm:grid-cols-2"><Input label="Start date" type="date" min={today()} error={errors.startDate?.message} {...register('startDate')} /><Input label="End date" type="date" min={v.startDate || today()} error={errors.endDate?.message} {...register('endDate')} /></div>
              <p className="text-sm text-ink-500">Leave dates empty to run from approval until the budget is used or you end the campaign.</p>
            </>}
            {step === 6 && <>
              <Select label="What do you pay for?" required {...register('rewardType')}><option value="CPC">Each qualified click to my landing page</option><option value="CPL">Each verified lead (enquiry form on Promora)</option></Select>
              <Input label={`Reward per ${v.rewardType === 'CPL' ? 'lead' : 'qualified click'} (₹)`} type="number" min={1} step={0.5} inputMode="decimal" required error={errors.reward?.message} hint={estimate > 0 ? `Your budget covers about ${count(estimate)} ${v.rewardType === 'CPL' ? 'leads' : 'qualified clicks'}.` : undefined} {...register('reward')} />
              <Select label="Who can promote?" {...register('applicationMode')}><option value="APPROVAL">I approve each promoter</option><option value="OPEN">Any eligible promoter can join immediately</option></Select>
              <Textarea label="Promotion instructions" rows={4} hint="What promoters should say or avoid. Do not ask promoters to hide that the post is paid." error={errors.promoInstructions?.message} {...register('promoInstructions')} />
              <Input label="Disclosure promoters must use" error={errors.disclosureText?.message} {...register('disclosureText')} />
              <AiAssist title={v.title} text={v.description} task="STRATEGY" onUse={(s) => setValue('promoInstructions', s.slice(0, 2000))} />
            </>}
            {step === 7 && <>
              <dl className="divide-y divide-ink-100 rounded-xl border border-ink-200 text-sm">
                {[['Title', v.title], ['Category', category?.name || '—'], ['Objective', OBJECTIVES[v.objective]], ['Audience', v.targetAudience], ['Geography', v.geography], ['Landing page', v.landingUrl || 'Promora enquiry form'],
                  ['Images', `${v.imageUrls.length} uploaded`], ['Reward', rewardLabel(v.rewardType, rupeesToPaise(v.reward))], ['Reward budget', money(rupeesToPaise(v.budget))],
                  ['Schedule', `${v.startDate ? date(v.startDate) : 'On approval'} to ${v.endDate ? date(v.endDate) : 'until budget is used'}`], ['Promoters', v.applicationMode === 'OPEN' ? 'Open to all eligible promoters' : 'Approved by you']].map(([k, val]) => (
                  <div key={k} className="grid grid-cols-[8rem_1fr] gap-3 px-4 py-3"><dt className="text-ink-500">{k}</dt><dd className="min-w-0 break-words font-medium text-ink-900">{val}</dd></div>))}
              </dl>
              <Alert tone="info" title="What happens next">Your campaign is reviewed against the content policy. Once approved, you fund it and it goes live. The exact fee and GST are shown before you pay.</Alert>
            </>}
            {(save.isError || submit.isError) && <Alert tone="danger">{((submit.error || save.error) as Error).message}</Alert>}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-200 pt-5">
              <Button variant="ghost" onClick={saveDraft} loading={save.isPending && !submit.isPending}>Save draft and exit</Button>
              <div className="flex gap-2">
                {step > 0 && <Button variant="secondary" onClick={() => setStep(step - 1)}>Back</Button>}
                {step < STEPS.length - 1 ? <Button onClick={next} loading={save.isPending}>Continue</Button> : <Button onClick={form.handleSubmit(() => submit.mutate(), () => toast('Some steps need attention. Check the highlighted fields.', 'danger'))} loading={submit.isPending}><Check className="h-4 w-4" aria-hidden />Submit for review</Button>}
              </div>
            </div>
          </form>
        </Card>
        <aside className="hidden lg:block">
          <div className="card sticky top-24 overflow-hidden">
            <img src={v.imageUrls[0] || `/assets/categories/${category?.slug || 'businesses-startups'}.svg`} alt="" className="aspect-[16/9] w-full object-cover" />
            <div className="p-5"><p className="text-xs text-ink-500">Marketplace preview</p><h3 className="mt-1 font-semibold">{v.title || 'Your campaign title'}</h3><p className="mt-2 line-clamp-3 text-sm text-ink-600">{v.description || 'Your description appears here.'}</p>
              <p className="num mt-3 inline-block rounded-lg bg-brand-100 px-2.5 py-1 text-sm font-semibold text-brand-700">{rewardLabel(v.rewardType, rupeesToPaise(v.reward || 0))}</p></div>
          </div>
        </aside>
      </div>
    </>
  );
}

// ---------------------------------------------------------------- Campaign management
export function CampaignManage() {
  useSeo('Manage campaign', undefined, { noindex: true });
  const { id } = useParams();
  const qc = useQueryClient();
  const toast = useToast();
  const [tab, setTab] = useState('overview');
  const [confirm, setConfirm] = useState<null | { action: string; title: string; message: string; danger?: boolean }>(null);
  const [order, setOrder] = useState<any | null>(null);
  const q = useQuery({ queryKey: ['advertiser', 'campaign', id], queryFn: () => api<any>(`/advertiser/campaigns/${id}`) });
  const refresh = () => { qc.invalidateQueries({ queryKey: ['advertiser'] }); qc.invalidateQueries({ queryKey: ['advertiser-campaigns'] }); qc.invalidateQueries({ queryKey: ['campaign-applications'] }); };
  const act = useMutation({ mutationFn: (action: string) => api(`/advertiser/campaigns/${id}/${action}`, { method: 'POST' }), onSuccess: (_d, action) => { setConfirm(null); refresh(); toast(`Campaign ${action === 'submit' ? 'submitted for review' : action + 'd'}`.replace('canceld', 'cancelled').replace('resumed', 'resumed')); } });
  const fund = useMutation({ mutationFn: () => api(`/payments/campaigns/${id}/order`, { method: 'POST', idempotencyKey: newKey() }), onSuccess: setOrder, onError: (e: any) => toast(e.message, 'danger') });
  const decide = useMutation({ mutationFn: ({ appId, decision }: { appId: string; decision: string }) => api(`/advertiser/applications/${appId}/${decision}`, { method: 'POST', body: {} }), onSuccess: () => { refresh(); toast('Updated'); }, onError: (e: any) => toast(e.message, 'danger') });
  if (q.isLoading) return <Spinner />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const c = q.data.campaign, s = q.data.stats;
  const editable = ['DRAFT', 'CHANGES_REQUESTED'].includes(c.status);
  const fundable = ['APPROVED', 'ACTIVE', 'PAUSED'].includes(c.status) && c.fundedPaise < c.budgetPaise;
  return (
    <>
      <PageHeader title={c.title} back={{ to: '/dashboard/advertiser/campaigns', label: 'My campaigns' }}
        description={<span className="flex flex-wrap items-center gap-2"><StatusBadge status={c.status} /><span>{rewardLabel(c.rewardType, c.rewardPaise)}</span><span>· Created {date(c.createdAt)}</span></span>}
        actions={<>
          {editable && <LinkButton variant="secondary" to={`/dashboard/advertiser/campaigns/${c.id}/edit`}>Edit</LinkButton>}
          {editable && <Button loading={act.isPending && act.variables === 'submit'} onClick={() => act.mutate('submit')}>Submit for review</Button>}
          {fundable && <Button loading={fund.isPending} onClick={() => fund.mutate()}><CircleDollarSign className="h-4 w-4" aria-hidden />Fund campaign</Button>}
          {c.status === 'ACTIVE' && <Button variant="secondary" onClick={() => setConfirm({ action: 'pause', title: 'Pause this campaign?', message: 'Tracking links stop earning while the campaign is paused. You can resume at any time.' })}>Pause</Button>}
          {c.status === 'PAUSED' && <Button onClick={() => act.mutate('resume')} loading={act.isPending}>Resume</Button>}
          {['ACTIVE', 'PAUSED'].includes(c.status) && <Button variant="secondary" onClick={() => setConfirm({ action: 'complete', title: 'End this campaign?', message: 'The campaign is marked completed and stops accepting clicks. This cannot be undone. Unspent budget can be refunded by our team.', danger: true })}>End campaign</Button>}
          {['DRAFT', 'PENDING_REVIEW', 'CHANGES_REQUESTED', 'APPROVED'].includes(c.status) && <Button variant="ghost" onClick={() => setConfirm({ action: 'cancel', title: 'Cancel this campaign?', message: 'A cancelled campaign cannot be reopened.', danger: true })}>Cancel</Button>}
        </>} />
      {act.isError && !confirm && <div className="mb-5"><Alert tone="danger">{(act.error as Error).message}</Alert></div>}
      {c.reviewNote && <div className="mb-5"><Alert tone={c.status === 'CHANGES_REQUESTED' ? 'warning' : 'danger'} title={c.status === 'CHANGES_REQUESTED' ? 'Changes requested' : 'Note from the review team'}>{c.reviewNote}</Alert></div>}
      {c.status === 'PENDING_REVIEW' && <div className="mb-5"><Alert tone="info" title="In review">Our team is checking this campaign. You will be notified of the decision.</Alert></div>}
      {c.status === 'APPROVED' && <div className="mb-5"><Alert tone="success" title="Approved. Fund the campaign to go live." action={<Button size="sm" loading={fund.isPending} onClick={() => fund.mutate()}>Fund now</Button>}>It appears in the marketplace as soon as payment is confirmed.</Alert></div>}
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'overview', label: 'Performance' }, { id: 'promoters', label: 'Applications and promoters' }, ...(c.rewardType === 'CPL' ? [{ id: 'leads', label: 'Leads', count: q.data.leads.length }] : []), { id: 'transactions', label: 'Transactions' }, { id: 'details', label: 'Details' }]} />
      {tab === 'overview' && <>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="All clicks" value={count(s.clicks)} /><StatCard label="Qualified clicks" value={count(s.qualifiedClicks)} /><StatCard label="Verified leads" value={count(s.leads)} /><StatCard label="Active promoters" value={count(s.promoters)} />
        </div>
        <div className="mt-6 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          <Card title="Clicks, last 14 days"><BarChart data={q.data.daily} series={SERIES} labelKey="day" /></Card>
          <div className="space-y-6">
            <Card title="Budget"><p className="num font-display text-2xl font-bold">{money(c.spentPaise)} <span className="text-base font-medium text-ink-500">of {money(c.fundedPaise)} funded</span></p><div className="mt-3"><ProgressBar value={c.spentPaise} max={c.fundedPaise} /></div><p className="mt-3 text-sm text-ink-500">Planned budget {money(c.budgetPaise)}.</p></Card>
            <Card title="Click quality" description="Why clicks were or were not counted">
              {q.data.rejections.length === 0 ? <p className="text-sm text-ink-500">No clicks recorded yet.</p> : <ul className="space-y-2 text-sm">{q.data.rejections.map((r: any) => <li key={r.reason} className="flex justify-between"><span>{r.reason === 'QUALIFIED' ? 'Qualified (paid)' : titleCase(r.reason)}</span><span className="num font-semibold">{count(r.clicks)}</span></li>)}</ul>}
            </Card>
          </div>
        </div>
      </>}
      {tab === 'promoters' && (
        <ResourceTable queryKey="campaign-applications" url={`/advertiser/campaigns/${id}/applications`}
          filters={[{ name: 'status', label: 'Status', options: ['PENDING', 'APPROVED', 'REJECTED', 'REMOVED', 'WITHDRAWN'].map((x) => ({ value: x, label: titleCase(x) })) }]}
          empty={{ kind: 'promotions', title: 'No applications yet', text: c.status === 'ACTIVE' ? 'Promoters can find this campaign in the marketplace.' : 'Promoters can apply once the campaign is live.' }}
          columns={[
            { header: 'Promoter', primary: true, cell: (a: any) => <><Link to={`/creators/${a.promoterSlug}`} className="font-semibold text-ink-900 hover:text-brand-600">{a.displayName}</Link> <VerifiedMark status={a.verificationStatus} /><span className="num block text-xs text-ink-500">{count(a.audienceSize)} audience · applied {date(a.createdAt)}</span>{a.pitch && <span className="mt-1 block max-w-md text-sm text-ink-600">“{a.pitch}”</span>}</> },
            { header: 'Status', cell: (a: any) => <StatusBadge status={a.status} /> },
            { header: 'Clicks', className: 'text-right', cell: (a: any) => <span className="num">{count(a.qualifiedClicks)} <span className="text-ink-400">/ {count(a.clicks)}</span></span> },
            { header: 'Actions', cell: (a: any) => a.status === 'PENDING' ? <div className="flex gap-2"><Button size="sm" onClick={() => decide.mutate({ appId: a.id, decision: 'approve' })}>Approve</Button><Button size="sm" variant="secondary" onClick={() => decide.mutate({ appId: a.id, decision: 'reject' })}>Reject</Button></div>
              : a.status === 'APPROVED' ? <Button size="sm" variant="ghost" onClick={() => decide.mutate({ appId: a.id, decision: 'remove' })}>Remove</Button> : <span className="text-ink-400">—</span> },
          ]} />
      )}
      {tab === 'leads' && <Card padded={false}>{q.data.leads.length === 0 ? <EmptyState kind="analytics" title="No leads yet" /> : (
        <ul className="divide-y divide-ink-100">{q.data.leads.map((l: any) => <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-4"><div><p className="font-semibold">{l.leadName}</p><p className="text-sm text-ink-600">{l.leadEmail}{l.leadPhone && ` · ${l.leadPhone}`}</p></div><div className="flex items-center gap-3 text-sm text-ink-500"><StatusBadge status={l.status} />{dateTime(l.createdAt)}</div></li>)}</ul>)}
        <p className="border-t border-ink-200 px-5 py-3 text-xs text-ink-500">These people consented to be contacted about this campaign only.</p></Card>}
      {tab === 'transactions' && <Card padded={false}>{q.data.transactions.length === 0 ? <EmptyState kind="transactions" title="No transactions for this campaign" /> : (
        <ul className="divide-y divide-ink-100">{q.data.transactions.map((t: any) => <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-4"><div><p className="font-semibold">{titleCase(t.type)}</p><p className="text-sm text-ink-500">{dateTime(t.createdAt)} · {t.provider}</p></div><div className="flex items-center gap-3"><span className="num font-semibold">{money(t.amountPaise)}</span><StatusBadge status={t.status} /></div></li>)}</ul>)}</Card>}
      {tab === 'details' && <Card><dl className="grid gap-4 sm:grid-cols-2">{[['Objective', OBJECTIVES[c.objective]], ['Geography', c.geography], ['Landing page', c.landingUrl || 'Promora enquiry form'], ['Schedule', `${date(c.startDate)} to ${date(c.endDate)}`], ['Promoter access', c.applicationMode === 'OPEN' ? 'Open' : 'Approval required'], ['Disclosure', c.disclosureText || '—']].map(([k, val]) => <div key={k}><dt className="text-xs text-ink-500">{k}</dt><dd className="mt-0.5 break-words font-medium">{val}</dd></div>)}</dl>
        <h3 className="mt-6 text-sm font-semibold">Description</h3><p className="mt-1 whitespace-pre-line text-ink-700">{c.description}</p>
        {c.status === 'ACTIVE' && <p className="mt-6"><Link className="link" to={`/campaigns/${c.id}`}>View public page</Link></p>}</Card>}
      <ConfirmDialog open={!!confirm} title={confirm?.title || ''} message={confirm?.message} danger={confirm?.danger} confirmLabel="Confirm" busy={act.isPending} error={act.isError ? (act.error as Error).message : null} onClose={() => { setConfirm(null); act.reset(); }} onConfirm={() => confirm && act.mutate(confirm.action)} />
      <CheckoutModal order={order} onClose={() => setOrder(null)} onPaid={() => { setOrder(null); refresh(); toast('Payment confirmed. Your campaign is funded.'); }} />
    </>
  );
}

// ---------------------------------------------------------------- Routes
function NeedsBusinessProfile({ children }: { children: ReactNode }) {
  const { hasRole } = useAuth();
  if (!hasRole('ADVERTISER')) return <Navigate to="/dashboard/settings?tab=business" replace />;
  return <>{children}</>;
}
export function AdvertiserRoutes() {
  return (
    <NeedsBusinessProfile>
      <Routes>
        <Route index element={<AdvertiserDashboard />} />
        <Route path="campaigns" element={<CampaignList />} />
        <Route path="campaigns/new" element={<CampaignWizard />} />
        <Route path="campaigns/:id" element={<CampaignManage />} />
        <Route path="campaigns/:id/edit" element={<CampaignWizard />} />
        <Route path="*" element={<Navigate to="/dashboard/advertiser" replace />} />
      </Routes>
    </NeedsBusinessProfile>
  );
}
