import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CalendarDays, ExternalLink, Flag, Globe, Instagram, Linkedin, MapPin, Search, SlidersHorizontal, Target, Users, Youtube, CheckCircle2 } from 'lucide-react';
import { api, qs, type Page } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { count, date, money, OBJECTIVES, rewardLabel } from '../../lib/format';
import { useSeo } from '../../lib/seo';
import { AppImage, CampaignCard, CategoryIcon } from '../../components/brand';
import { ProgressBar } from '../../components/charts';
import { Alert, Badge, Button, EmptyState, ErrorState, Input, LinkButton, Modal, Pagination, Select, Spinner, Textarea, VerifiedMark, useToast } from '../../components/ui';
import { FAQS, FaqList, PlanCards } from './Home';

function Hero({ eyebrow, title, text, children }: { eyebrow?: string; title: string; text?: string; children?: ReactNode }) {
  return (
    <section className="border-b border-ink-200 bg-gradient-to-b from-brand-50 to-white">
      <div className="container-page py-12 sm:py-16">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className="mt-2 max-w-3xl text-3xl font-bold sm:text-5xl">{title}</h1>
        {text && <p className="mt-4 max-w-2xl text-lg text-ink-600">{text}</p>}
        {children}
      </div>
    </section>
  );
}

function useCategories() { return useQuery({ queryKey: ['categories'], queryFn: () => api<any[]>('/public/categories'), staleTime: 300_000 }); }

// ---------------------------------------------------------------- Campaign marketplace
export function CampaignBrowser({ embedded }: { embedded?: boolean }) {
  const [params, setParams] = useSearchParams();
  const [showFilters, setShowFilters] = useState(false);
  const [typed, setTyped] = useState(params.get('q') || '');
  const categories = useCategories();
  const filters = { q: params.get('q') || '', category: params.get('category') || '', objective: params.get('objective') || '', rewardType: params.get('rewardType') || '',
    geography: params.get('geography') || '', minReward: params.get('minReward') || '', minBudget: params.get('minBudget') || '', sort: params.get('sort') || '', page: Number(params.get('page') || 0) };
  const set = (patch: Record<string, string | number>) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v === '' || v === 0 ? next.delete(k) : next.set(k, String(v))));
    if (!('page' in patch)) next.delete('page');
    setParams(next, { replace: true });
  };
  const query = useQuery({
    queryKey: ['campaigns', filters],
    queryFn: () => api<Page>('/public/campaigns' + qs({ ...filters, minReward: filters.minReward ? Number(filters.minReward) * 100 : undefined, minBudget: filters.minBudget ? Number(filters.minBudget) * 100 : undefined, size: 12 })),
    placeholderData: keepPreviousData,
  });
  const active = ['category', 'objective', 'rewardType', 'geography', 'minReward', 'minBudget'].filter((k) => (filters as any)[k]).length;
  const filterPanel = (
    <div className="space-y-4">
      <Select label="Category" value={filters.category} onChange={(e) => set({ category: e.target.value })}>
        <option value="">All categories</option>{(categories.data || []).map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
      </Select>
      <Select label="Objective" value={filters.objective} onChange={(e) => set({ objective: e.target.value })}>
        <option value="">Any objective</option>{Object.entries(OBJECTIVES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </Select>
      <Select label="Reward model" value={filters.rewardType} onChange={(e) => set({ rewardType: e.target.value })}>
        <option value="">Any model</option><option value="CPC">Pay per qualified click</option><option value="CPL">Pay per lead</option>
      </Select>
      <Input label="Minimum reward (₹)" type="number" min={0} inputMode="numeric" value={filters.minReward} onChange={(e) => set({ minReward: e.target.value })} placeholder="e.g. 5" />
      <Input label="Minimum budget (₹)" type="number" min={0} inputMode="numeric" value={filters.minBudget} onChange={(e) => set({ minBudget: e.target.value })} placeholder="e.g. 1000" />
      <Input label="Geography" value={filters.geography} onChange={(e) => set({ geography: e.target.value })} placeholder="e.g. India, Pune" />
      {active > 0 && <Button variant="ghost" size="sm" onClick={() => setParams(filters.q ? { q: filters.q } : {}, { replace: true })}>Clear filters</Button>}
    </div>
  );
  return (
    <div className={embedded ? '' : 'container-page py-10'}>
      <div className="flex flex-col gap-3 sm:flex-row">
        <form className="relative flex-1" role="search" onSubmit={(e: FormEvent) => { e.preventDefault(); set({ q: typed.trim() }); }}>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-400" aria-hidden />
          <input className="input pl-11" placeholder="Search campaigns, products or businesses" aria-label="Search campaigns" value={typed} onChange={(e) => setTyped(e.target.value)} />
        </form>
        <select className="input sm:w-52" aria-label="Sort campaigns" value={filters.sort} onChange={(e) => set({ sort: e.target.value })}>
          <option value="">Sort: newest</option><option value="reward">Highest reward</option><option value="budget">Largest budget</option><option value="ending">Ending soon</option>
        </select>
        <Button variant="secondary" className="lg:hidden" onClick={() => setShowFilters(true)}><SlidersHorizontal className="h-4 w-4" aria-hidden />Filters{active > 0 && ` (${active})`}</Button>
      </div>
      <div className="mt-6 grid gap-8 lg:grid-cols-[260px_1fr]">
        <aside className="hidden lg:block"><div className="card sticky top-24 p-5"><h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-ink-500">Filters</h2>{filterPanel}</div></aside>
        <div>
          {query.isLoading ? <Spinner /> : query.isError ? <ErrorState error={query.error} onRetry={() => query.refetch()} />
            : query.data!.items.length === 0 ? <div className="card"><EmptyState kind={filters.q || active ? 'search' : 'campaigns'} title={filters.q || active ? 'No campaigns match your search' : 'No live campaigns yet'} text={filters.q || active ? 'Try fewer filters or a different search term.' : 'New campaigns appear here as soon as they are approved and funded.'} /></div>
            : <><p className="mb-4 text-sm text-ink-500">{query.data!.total} {query.data!.total === 1 ? 'campaign' : 'campaigns'}</p>
                <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">{query.data!.items.map((c) => <CampaignCard key={c.id} c={c} />)}</div>
                <Pagination page={query.data!.page} totalPages={query.data!.totalPages} total={0} onPage={(p) => set({ page: p })} /></>}
        </div>
      </div>
      <Modal open={showFilters} title="Filters" onClose={() => setShowFilters(false)} footer={<Button onClick={() => setShowFilters(false)}>Show results</Button>}>{filterPanel}</Modal>
    </div>
  );
}

export function Campaigns() {
  useSeo('Campaign marketplace', 'Browse live promotional campaigns on Promora. Filter by category, reward and objective, and apply to promote.');
  return <><Hero eyebrow="Marketplace" title="Find a campaign worth sharing" text="Every listing here is approved, funded and live. Apply, get your link and start earning for verified results." /><CampaignBrowser /></>;
}

// ---------------------------------------------------------------- Campaign detail
const leadSchema = z.object({
  name: z.string().trim().min(2, 'Enter your name'), email: z.string().trim().email('Enter a valid email'),
  phone: z.string().trim().regex(/^$|^[+0-9 -]{7,20}$/, 'Enter a valid phone number').optional(),
  consent: z.literal(true, { errorMap: () => ({ message: 'Consent is required' }) }),
});
function LeadForm({ code, business }: { code: string; business: string }) {
  const [done, setDone] = useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting }, setError } = useForm<z.infer<typeof leadSchema>>({ resolver: zodResolver(leadSchema) });
  if (done) return <Alert tone="success" title="Thank you">Your details were sent to {business}. They will contact you directly.</Alert>;
  return (
    <form className="space-y-4" noValidate onSubmit={handleSubmit(async (v) => {
      try { await api('/public/leads', { method: 'POST', body: { ...v, code } }); setDone(true); } catch (e: any) { setError('root', { message: e.message }); }
    })}>
      <Input label="Your name" required autoComplete="name" error={errors.name?.message} {...register('name')} />
      <Input label="Email" type="email" required autoComplete="email" error={errors.email?.message} {...register('email')} />
      <Input label="Phone (optional)" type="tel" autoComplete="tel" error={errors.phone?.message} {...register('phone')} />
      <label className="flex gap-2.5 text-sm text-ink-700"><input type="checkbox" className="mt-1 h-4 w-4 rounded border-ink-300 text-brand-500" {...register('consent')} />
        <span>I agree that Promora may share these details with {business} so they can respond to my enquiry. See the <Link className="link" to="/privacy-policy">Privacy Policy</Link>.</span></label>
      {errors.consent && <p className="text-sm text-danger-600" role="alert">{errors.consent.message}</p>}
      {errors.root && <Alert tone="danger">{errors.root.message}</Alert>}
      <Button type="submit" loading={isSubmitting} className="w-full">Send enquiry</Button>
    </form>
  );
}

export function ReportButton({ targetType, targetId }: { targetType: 'CAMPAIGN' | 'BUSINESS' | 'CREATOR'; targetId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('MISLEADING');
  const [details, setDetails] = useState('');
  const [email, setEmail] = useState('');
  const { user } = useAuth();
  const toast = useToast();
  const m = useMutation({
    mutationFn: () => api('/public/reports', { method: 'POST', body: { targetType, targetId, reason, details, email: email || undefined } }),
    onSuccess: () => { setOpen(false); setDetails(''); toast('Report received. Our team will review it.'); },
  });
  return (
    <>
      <button className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-danger-600" onClick={() => setOpen(true)}><Flag className="h-4 w-4" aria-hidden />Report this {targetType.toLowerCase()}</button>
      <Modal open={open} title="Report a problem" onClose={() => setOpen(false)} footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button loading={m.isPending} onClick={() => m.mutate()}>Send report</Button></>}>
        <div className="space-y-4">
          <Select label="What is wrong?" value={reason} onChange={(e) => setReason(e.target.value)}>
            <option value="MISLEADING">Misleading or false claims</option><option value="SCAM">Scam or fraud</option><option value="SPAM">Spam</option>
            <option value="ILLEGAL">Illegal or prohibited content</option><option value="COPYRIGHT">Copyright or trademark complaint</option><option value="OTHER">Something else</option>
          </Select>
          <Textarea label="Details" value={details} onChange={(e) => setDetails(e.target.value)} maxLength={2000} hint={reason === 'COPYRIGHT' ? 'Identify the original work, where it appears here, and confirm you are the owner or authorised to act.' : 'Tell us what you saw.'} />
          {!user && <Input label="Your email (optional)" type="email" value={email} onChange={(e) => setEmail(e.target.value)} hint="So we can ask follow-up questions." />}
          {m.isError && <Alert tone="danger">{(m.error as Error).message}</Alert>}
        </div>
      </Modal>
    </>
  );
}

export function CampaignDetail() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const { user, hasRole } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const [applyOpen, setApplyOpen] = useState(false);
  const [pitch, setPitch] = useState('');
  const [accepted, setAccepted] = useState(false);
  const query = useQuery({ queryKey: ['campaign', id, user?.id], queryFn: () => api<any>(`/public/campaigns/${id}`), retry: false });
  const c = query.data;
  useSeo(c ? c.title : 'Campaign', c?.summary);
  const apply = useMutation({
    mutationFn: () => api(`/campaigns/${id}/applications`, { method: 'POST', body: { pitch, disclosureAccepted: accepted } }),
    onSuccess: (res: any) => { setApplyOpen(false); qc.invalidateQueries({ queryKey: ['campaign', id] }); toast(res.status === 'APPROVED' ? 'You are in. Your tracking link is ready.' : 'Application sent to the advertiser.'); },
  });
  if (query.isLoading) return <Spinner />;
  if (query.isError || !c) return <div className="container-page py-16"><div className="card"><EmptyState kind="campaigns" title="This campaign is not available" text="It may have ended, been paused, or the link may be wrong." action={<LinkButton to="/campaigns">Browse live campaigns</LinkButton>} /></div></div>;
  const leadCode = params.get('lead');
  const left = Math.max(0, c.fundedPaise - c.spentPaise);
  const mine = c.myApplication;
  const isOwner = user?.advertiserProfile?.slug === c.businessSlug;
  return (
    <div className="container-page py-8 sm:py-12">
      <nav className="mb-5 text-sm text-ink-500" aria-label="Breadcrumb"><Link to="/campaigns" className="hover:text-ink-800">Campaigns</Link> / <span className="text-ink-800">{c.categoryName}</span></nav>
      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <article>
          <div className="overflow-hidden rounded-2xl bg-brand-100"><AppImage src={c.images?.[0]?.url || c.imageUrl || `/assets/categories/${c.categorySlug}.svg`} alt={c.title} eager width={800} height={450} className="aspect-[16/9] w-full object-cover" /></div>
          {c.images?.length > 1 && <div className="mt-3 grid grid-cols-4 gap-3">{c.images.slice(1, 5).map((im: any) => <AppImage key={im.url} src={im.url} alt="" className="aspect-[4/3] w-full rounded-xl object-cover" width={200} height={150} />)}</div>}
          <div className="mt-6 flex flex-wrap items-center gap-2"><Badge>Sponsored campaign</Badge><Badge tone="neutral"><CategoryIcon name={c.categoryIcon} className="h-3.5 w-3.5" />{c.categoryName}</Badge>{c.featured && <Badge tone="dark">Featured</Badge>}</div>
          <h1 className="mt-3 text-3xl font-bold sm:text-4xl">{c.title}</h1>
          <p className="mt-2 flex flex-wrap items-center gap-2 text-ink-600">by <Link to={`/businesses/${c.businessSlug}`} className="link">{c.businessName}</Link><VerifiedMark status={c.businessVerification} /></p>
          <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[[Target, 'Objective', OBJECTIVES[c.objective] || c.objective], [MapPin, 'Geography', c.geography], [Users, 'Promoters', count(c.promoters)], [CalendarDays, 'Ends', date(c.endDate)]].map(([Icon, k, v]: any) => (
              <div key={k} className="rounded-xl border border-ink-200 p-3"><dt className="flex items-center gap-1.5 text-xs text-ink-500"><Icon className="h-3.5 w-3.5" aria-hidden />{k}</dt><dd className="mt-1 text-sm font-semibold text-ink-900">{v}</dd></div>
            ))}
          </dl>
          <h2 className="mt-8 text-xl font-semibold">About this campaign</h2>
          <p className="mt-3 whitespace-pre-line leading-relaxed text-ink-700">{c.description}</p>
          {c.targetAudience && <><h2 className="mt-8 text-xl font-semibold">Target audience</h2><p className="mt-3 leading-relaxed text-ink-700">{c.targetAudience}</p></>}
          {c.promoInstructions && <><h2 className="mt-8 text-xl font-semibold">Promotion guidelines</h2><p className="mt-3 whitespace-pre-line leading-relaxed text-ink-700">{c.promoInstructions}</p></>}
          <div className="mt-6"><Alert tone="info" title="Disclosure required">{c.disclosureText || 'Promoters must clearly label posts about this campaign as advertising.'}</Alert></div>
          <div className="mt-8"><ReportButton targetType="CAMPAIGN" targetId={c.id} /></div>
        </article>
        <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          {leadCode && c.rewardType === 'CPL' && <div className="card p-6"><h2 className="text-lg font-semibold">Interested? Send an enquiry</h2><p className="mb-4 mt-1 text-sm text-ink-600">{c.businessName} will get back to you.</p><LeadForm code={leadCode} business={c.businessName} /></div>}
          <div className="card p-6">
            <p className="text-sm text-ink-500">Promoter reward</p>
            <p className="num mt-1 font-display text-3xl font-bold text-ink-900">{rewardLabel(c.rewardType, c.rewardPaise)}</p>
            <div className="mt-5"><ProgressBar value={c.spentPaise} max={c.fundedPaise} label={`${money(left)} of ${money(c.fundedPaise)} budget left`} /></div>
            <p className="mt-4 text-sm text-ink-600">{c.applicationMode === 'OPEN' ? 'Open campaign: you get your link immediately.' : 'The advertiser reviews each application.'}</p>
            <div className="mt-5">
              {isOwner ? <LinkButton to="/dashboard/advertiser/campaigns" variant="secondary" className="w-full">Manage in your dashboard</LinkButton>
                : !user ? <><LinkButton to={`/register?as=promoter&next=/campaigns/${c.id}`} className="w-full">Sign up to promote</LinkButton><p className="mt-3 text-center text-sm text-ink-500">Already a member? <Link className="link" to={`/login?next=/campaigns/${c.id}`}>Log in</Link></p></>
                : mine && mine.status !== 'WITHDRAWN' ? <><Alert tone={mine.status === 'APPROVED' ? 'success' : mine.status === 'PENDING' ? 'warning' : 'info'} title={mine.status === 'APPROVED' ? 'You are promoting this campaign' : mine.status === 'PENDING' ? 'Application pending' : `Application ${mine.status.toLowerCase()}`} /><LinkButton to="/dashboard/promoter/campaigns" variant="secondary" className="mt-3 w-full">Open my promotions</LinkButton></>
                : !hasRole('PROMOTER') ? <><LinkButton to={`/dashboard/settings?tab=promoter`} className="w-full">Create a promoter profile</LinkButton><p className="mt-3 text-center text-sm text-ink-500">A short profile is needed before you apply.</p></>
                : <Button className="w-full" onClick={() => setApplyOpen(true)}>Apply to promote</Button>}
            </div>
            {c.landingUrl && <a href={c.landingUrl} target="_blank" rel="noopener noreferrer nofollow sponsored" className="mt-4 flex items-center justify-center gap-1.5 text-sm font-medium text-ink-500 hover:text-brand-600">Visit the advertiser's page<ExternalLink className="h-3.5 w-3.5" aria-hidden /></a>}
          </div>
        </aside>
      </div>
      <Modal open={applyOpen} title="Apply to promote" onClose={() => setApplyOpen(false)}
        footer={<><Button variant="secondary" onClick={() => setApplyOpen(false)}>Cancel</Button><Button loading={apply.isPending} disabled={!accepted} onClick={() => apply.mutate()}>Submit application</Button></>}>
        <div className="space-y-4">
          <Textarea label="Why are you a good fit? (optional)" value={pitch} onChange={(e) => setPitch(e.target.value)} maxLength={1000} placeholder="Tell the advertiser about your audience and how you will share this." />
          <label className="flex gap-2.5 text-sm text-ink-700"><input type="checkbox" className="mt-1 h-4 w-4 rounded border-ink-300" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
            <span>I will clearly label my posts about this campaign as advertising, follow the promotion guidelines, and will not use bots, incentivised clicks or misleading claims.</span></label>
          {apply.isError && <Alert tone="danger">{(apply.error as Error).message}</Alert>}
        </div>
      </Modal>
    </div>
  );
}

// ---------------------------------------------------------------- Directories
function Directory({ kind }: { kind: 'businesses' | 'creators' }) {
  const [q, setQ] = useState('');
  const [typed, setTyped] = useState('');
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState('');
  const query = useQuery({ queryKey: [kind, q, page, sort], queryFn: () => api<Page>(`/public/${kind}` + qs({ q, page, size: 12, sort })), placeholderData: keepPreviousData });
  return (
    <div className="container-page py-10">
      <div className="flex flex-col gap-3 sm:flex-row">
        <form className="relative flex-1" role="search" onSubmit={(e) => { e.preventDefault(); setQ(typed.trim()); setPage(0); }}>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-400" aria-hidden />
          <input className="input pl-11" placeholder={`Search ${kind}`} aria-label={`Search ${kind}`} value={typed} onChange={(e) => setTyped(e.target.value)} />
        </form>
        {kind === 'creators' && <select className="input sm:w-52" aria-label="Sort creators" value={sort} onChange={(e) => setSort(e.target.value)}><option value="">Sort: newest</option><option value="audience">Largest audience</option></select>}
      </div>
      <div className="mt-6">
        {query.isLoading ? <Spinner /> : query.isError ? <ErrorState error={query.error} onRetry={() => query.refetch()} />
          : query.data!.items.length === 0 ? <div className="card"><EmptyState kind="search" title={q ? `No ${kind} match "${q}"` : `No ${kind} listed yet`} text={q ? 'Try a different search.' : 'Profiles appear here as members join.'} /></div>
          : <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {query.data!.items.map((r) => kind === 'businesses' ? (
                <Link key={r.id} to={`/businesses/${r.slug}`} className="card flex gap-4 p-5 transition hover:border-brand-300 hover:shadow-lift">
                  <Avatar name={r.businessName} src={r.logoUrl} />
                  <div className="min-w-0"><h2 className="truncate text-base font-semibold">{r.businessName}</h2><p className="flex flex-wrap items-center gap-2 text-xs text-ink-500">{r.categoryName}{r.city && ` · ${r.city}`}<VerifiedMark status={r.verificationStatus} /></p>
                    <p className="mt-2 line-clamp-2 text-sm text-ink-600">{r.summary}</p><p className="mt-2 text-xs font-semibold text-brand-600">{r.activeCampaigns} live {r.activeCampaigns === 1 ? 'campaign' : 'campaigns'}</p></div>
                </Link>
              ) : (
                <Link key={r.id} to={`/creators/${r.slug}`} className="card flex gap-4 p-5 transition hover:border-brand-300 hover:shadow-lift">
                  <Avatar name={r.displayName} round />
                  <div className="min-w-0"><h2 className="truncate text-base font-semibold">{r.displayName}</h2><p className="flex flex-wrap items-center gap-2 text-xs text-ink-500"><span className="num">{count(r.audienceSize)} audience</span><VerifiedMark status={r.verificationStatus} /></p>
                    <p className="mt-2 line-clamp-2 text-sm text-ink-600">{r.summary}</p>{r.interests && <p className="mt-2 truncate text-xs text-ink-500">{r.interests}</p>}</div>
                </Link>
              ))}
            </div>}
        {query.data && <Pagination page={query.data.page} totalPages={query.data.totalPages} total={0} onPage={setPage} />}
      </div>
    </div>
  );
}
export function Avatar({ name, src, round }: { name: string; src?: string; round?: boolean }) {
  const shape = round ? 'rounded-full' : 'rounded-xl';
  return src ? <AppImage src={src} alt="" className={`h-14 w-14 shrink-0 object-cover ${shape}`} width={56} height={56} />
    : <span className={`flex h-14 w-14 shrink-0 items-center justify-center bg-gradient-to-br from-brand-500 to-sky-500 font-display text-xl font-bold text-white ${shape}`} aria-hidden>{(name || '?').trim().charAt(0).toUpperCase()}</span>;
}
export function Businesses() {
  useSeo('Businesses on Promora', 'Discover businesses, startups and brands running promotional campaigns on Promora.');
  return <><Hero eyebrow="Directory" title="Businesses on Promora" text="Brands, startups and local businesses that run campaigns here." /><Directory kind="businesses" /></>;
}
export function Creators() {
  useSeo('Creators on Promora', 'Discover creators, publishers and community owners who promote campaigns on Promora.');
  return <><Hero eyebrow="Directory" title="Creators and promoters" text="People and channels that help campaigns reach the right audience." /><Directory kind="creators" /></>;
}

export function BusinessDetail() {
  const { slug } = useParams();
  const q = useQuery({ queryKey: ['business', slug], queryFn: () => api<any>(`/public/businesses/${slug}`), retry: false });
  useSeo(q.data ? q.data.businessName : 'Business', q.data?.description?.slice(0, 160));
  if (q.isLoading) return <Spinner />;
  if (q.isError) return <div className="container-page py-16"><div className="card"><EmptyState kind="search" title="Business not found" action={<LinkButton to="/businesses">Browse businesses</LinkButton>} /></div></div>;
  const b = q.data;
  return (
    <div className="container-page py-10">
      <div className="card flex flex-col gap-5 p-6 sm:flex-row sm:items-center">
        <Avatar name={b.businessName} src={b.logoUrl} />
        <div className="min-w-0 flex-1"><h1 className="text-2xl font-bold sm:text-3xl">{b.businessName}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-3 text-sm text-ink-500">{b.categoryName && <span>{b.categoryName}</span>}{b.city && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" aria-hidden />{b.city}</span>}<VerifiedMark status={b.verificationStatus} /><span>Member since {date(b.createdAt)}</span></p></div>
        {b.website && <a href={b.website} target="_blank" rel="noopener noreferrer nofollow" className="link inline-flex items-center gap-1.5"><Globe className="h-4 w-4" aria-hidden />Website</a>}
      </div>
      {b.description && <p className="mt-6 max-w-3xl whitespace-pre-line leading-relaxed text-ink-700">{b.description}</p>}
      <h2 className="mt-10 text-xl font-semibold">Live campaigns</h2>
      {b.campaigns.length === 0 ? <div className="card mt-4"><EmptyState kind="campaigns" title="No live campaigns right now" /></div>
        : <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{b.campaigns.map((c: any) => <CampaignCard key={c.id} c={c} />)}</div>}
      <div className="mt-10"><ReportButton targetType="BUSINESS" targetId={b.id} /></div>
    </div>
  );
}
export function CreatorDetail() {
  const { slug } = useParams();
  const q = useQuery({ queryKey: ['creator', slug], queryFn: () => api<any>(`/public/creators/${slug}`), retry: false });
  useSeo(q.data ? q.data.displayName : 'Creator', q.data?.bio?.slice(0, 160));
  if (q.isLoading) return <Spinner />;
  if (q.isError) return <div className="container-page py-16"><div className="card"><EmptyState kind="search" title="Creator not found" action={<LinkButton to="/creators">Browse creators</LinkButton>} /></div></div>;
  const c = q.data;
  const links = [[Instagram, 'Instagram', c.instagramUrl], [Youtube, 'YouTube', c.youtubeUrl], [Linkedin, 'LinkedIn', c.linkedinUrl], [Globe, 'Website', c.websiteUrl]].filter(([, , u]) => u);
  return (
    <div className="container-page max-w-4xl py-10">
      <div className="card p-6 sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center"><Avatar name={c.displayName} round />
          <div><h1 className="text-2xl font-bold sm:text-3xl">{c.displayName}</h1><p className="mt-1 flex flex-wrap items-center gap-3 text-sm text-ink-500"><VerifiedMark status={c.verificationStatus} /><span>Member since {date(c.createdAt)}</span></p></div></div>
        <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div className="rounded-xl bg-ink-50 p-4"><dt className="text-xs text-ink-500">Audience</dt><dd className="num mt-1 font-display text-2xl font-bold">{count(c.audienceSize)}</dd></div>
          <div className="rounded-xl bg-ink-50 p-4"><dt className="text-xs text-ink-500">Campaigns joined</dt><dd className="num mt-1 font-display text-2xl font-bold">{count(c.campaignsJoined)}</dd></div>
          <div className="col-span-2 rounded-xl bg-ink-50 p-4 sm:col-span-1"><dt className="text-xs text-ink-500">Languages</dt><dd className="mt-1 font-semibold">{c.languages || 'Not specified'}</dd></div>
        </dl>
        {c.bio && <><h2 className="mt-8 text-lg font-semibold">About</h2><p className="mt-2 whitespace-pre-line leading-relaxed text-ink-700">{c.bio}</p></>}
        {c.audienceDescription && <><h2 className="mt-6 text-lg font-semibold">Audience</h2><p className="mt-2 leading-relaxed text-ink-700">{c.audienceDescription}</p></>}
        {c.interests && <><h2 className="mt-6 text-lg font-semibold">Interests</h2><div className="mt-2 flex flex-wrap gap-2">{String(c.interests).split(',').map((i: string) => <Badge key={i} tone="neutral">{i.trim()}</Badge>)}</div></>}
        {links.length > 0 && <><h2 className="mt-6 text-lg font-semibold">Channels</h2><div className="mt-2 flex flex-wrap gap-3">{links.map(([Icon, label, url]: any) => <a key={label} href={url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-2 rounded-xl border border-ink-200 px-3 py-2 text-sm font-medium hover:border-brand-300"><Icon className="h-4 w-4" aria-hidden />{label}</a>)}</div></>}
        <div className="mt-8"><ReportButton targetType="CREATOR" targetId={c.id} /></div>
      </div>
    </div>
  );
}

export function Categories() {
  useSeo('Categories', 'Browse Promora campaign categories: businesses, products, apps, creators, courses, events, local services and more.');
  const cats = useCategories();
  return (
    <><Hero eyebrow="Categories" title="Browse by what is being promoted" />
      <div className="container-page py-10">
        {cats.isLoading ? <Spinner /> : cats.isError ? <ErrorState error={cats.error} onRetry={() => cats.refetch()} /> : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {cats.data!.map((c) => (
              <Link key={c.slug} to={`/campaigns?category=${c.slug}`} className="card group overflow-hidden transition hover:border-brand-300 hover:shadow-lift">
                <AppImage src={`/assets/categories/${c.slug}.svg`} alt="" className="aspect-[16/8] w-full object-cover" width={400} height={200} />
                <div className="p-5"><h2 className="flex items-center gap-2 text-lg font-semibold group-hover:text-brand-600"><CategoryIcon name={c.icon} className="h-5 w-5 text-brand-500" />{c.name}</h2>
                  <p className="mt-1 text-sm text-ink-600">{c.description}</p><p className="mt-3 text-xs font-semibold text-brand-600">{c.activeCampaigns} live {c.activeCampaigns === 1 ? 'campaign' : 'campaigns'}</p></div>
              </Link>
            ))}
          </div>
        )}
      </div></>
  );
}

export function Discover() {
  useSeo('Discover', 'Search campaigns, businesses, creators and categories across Promora.');
  const [params, setParams] = useSearchParams();
  const q = params.get('q') || '';
  const [typed, setTyped] = useState(q);
  const search = useQuery({ queryKey: ['search', q], queryFn: () => api<any>('/public/search' + qs({ q })), enabled: q.length > 0 });
  const featured = useQuery({ queryKey: ['discover', 'featured'], queryFn: () => api<Page>('/public/campaigns?size=6'), enabled: !q });
  const cats = useCategories();
  const none = search.data && !search.data.campaigns.length && !search.data.businesses.length && !search.data.creators.length && !search.data.categories.length;
  return (
    <><Hero eyebrow="Discover" title="Search everything on Promora" text="Campaigns, businesses, creators and categories in one place.">
        <form className="relative mt-6 max-w-2xl" role="search" onSubmit={(e) => { e.preventDefault(); setParams(typed.trim() ? { q: typed.trim() } : {}); }}>
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-400" aria-hidden />
          <input className="input h-14 pl-12 pr-28 text-base shadow-card" placeholder="Try “candles”, “design course” or a creator name" aria-label="Search Promora" value={typed} onChange={(e) => setTyped(e.target.value)} />
          <Button type="submit" className="absolute right-1.5 top-1.5">Search</Button>
        </form>
      </Hero>
      <div className="container-page space-y-10 py-10">
        {q ? search.isLoading ? <Spinner label="Searching" /> : search.isError ? <ErrorState error={search.error} onRetry={() => search.refetch()} />
          : none ? <div className="card"><EmptyState kind="search" title={`No results for "${q}"`} text="Check the spelling or try a broader term." /></div> : (
            <>
              {search.data.categories.length > 0 && <div><h2 className="text-xl font-semibold">Categories</h2><div className="mt-3 flex flex-wrap gap-2">{search.data.categories.map((c: any) => <Link key={c.slug} to={`/campaigns?category=${c.slug}`} className="inline-flex items-center gap-2 rounded-full border border-ink-200 bg-white px-4 py-2 text-sm font-medium hover:border-brand-300"><CategoryIcon name={c.icon} className="h-4 w-4 text-brand-500" />{c.name}</Link>)}</div></div>}
              {search.data.campaigns.length > 0 && <div><h2 className="text-xl font-semibold">Campaigns</h2><div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{search.data.campaigns.map((c: any) => <CampaignCard key={c.id} c={c} />)}</div></div>}
              {search.data.businesses.length > 0 && <div><h2 className="text-xl font-semibold">Businesses</h2><ul className="mt-3 grid gap-3 sm:grid-cols-2">{search.data.businesses.map((b: any) => <li key={b.id}><Link to={`/businesses/${b.slug}`} className="card flex items-center gap-3 p-4 hover:border-brand-300"><Avatar name={b.businessName} src={b.logoUrl} /><span><span className="block font-semibold">{b.businessName}</span><span className="text-sm text-ink-500">{b.categoryName}</span></span></Link></li>)}</ul></div>}
              {search.data.creators.length > 0 && <div><h2 className="text-xl font-semibold">Creators</h2><ul className="mt-3 grid gap-3 sm:grid-cols-2">{search.data.creators.map((c: any) => <li key={c.id}><Link to={`/creators/${c.slug}`} className="card flex items-center gap-3 p-4 hover:border-brand-300"><Avatar name={c.displayName} round /><span><span className="block font-semibold">{c.displayName}</span><span className="num text-sm text-ink-500">{count(c.audienceSize)} audience</span></span></Link></li>)}</ul></div>}
            </>
          ) : (
            <>
              <div><h2 className="text-xl font-semibold">Browse categories</h2><div className="mt-3 flex flex-wrap gap-2">{(cats.data || []).map((c) => <Link key={c.slug} to={`/campaigns?category=${c.slug}`} className="inline-flex items-center gap-2 rounded-full border border-ink-200 bg-white px-4 py-2 text-sm font-medium hover:border-brand-300"><CategoryIcon name={c.icon} className="h-4 w-4 text-brand-500" />{c.name}</Link>)}</div></div>
              <div><h2 className="text-xl font-semibold">Live campaigns</h2>{featured.isLoading ? <Spinner /> : featured.data?.items.length ? <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{featured.data.items.map((c) => <CampaignCard key={c.id} c={c} />)}</div> : <div className="card mt-4"><EmptyState kind="campaigns" title="No live campaigns yet" /></div>}</div>
            </>
          )}
      </div></>
  );
}

// ---------------------------------------------------------------- Static pages
export function About() {
  useSeo('About Promora', 'Promora is building a universal promotion marketplace, starting in India.');
  return (
    <><Hero eyebrow="About" title="Visibility should not depend on the size of your budget" text="Promora connects people and organisations that want to be seen with the people and channels who can make that happen." />
      <div className="container-page grid gap-10 py-12 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-5 text-lg leading-relaxed text-ink-700">
          <p>Small businesses, independent creators and new products often have something worth talking about and no affordable way to reach an audience. At the same time, millions of creators and community owners have trusted audiences and few ways to earn from them.</p>
          <p>Promora brings the two together in one marketplace. Advertisers describe what they are promoting and what a result is worth. Promoters choose what fits their audience. Promora tracks each result, filters out fraud, and keeps the money accountable.</p>
          <p>We are starting in India, in rupees, with two simple models: pay per qualified click and pay per verified lead. The platform is built to grow into more categories, more models and more countries.</p>
        </div>
        <div className="space-y-4">
          {[['Honest measurement', 'We record every click and only count the ones that pass verification.'], ['Clear rules', 'Every campaign is reviewed, and paid promotion must be disclosed.'], ['Fair to both sides', 'Advertisers pay for results; promoters are paid for the results they create.']].map(([t, d]) => (
            <div key={t} className="card flex gap-3 p-5"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-brand-500" aria-hidden /><div><h2 className="font-semibold">{t}</h2><p className="text-ink-600">{d}</p></div></div>
          ))}
        </div>
      </div></>
  );
}

export function HowItWorks() {
  useSeo('How Promora works', 'How advertisers launch campaigns and how promoters earn on Promora, step by step.');
  const flows = [
    { title: 'For advertisers', img: '/assets/illustrations/advertiser.svg', steps: ['Create a free account and a business profile.', 'Build a campaign: what you are promoting, your audience, a reward per result and a budget.', 'Submit it for review. We check it against the content policy, usually within a day.', 'Fund the approved campaign. It goes live in the marketplace.', 'Approve promoters, or let anyone eligible join.', 'Watch qualified clicks, leads and spend. Pause, resume or end at any time; unspent budget is refundable.'] },
    { title: 'For promoters', img: '/assets/illustrations/creator.svg', steps: ['Create a free account and a promoter profile with your channels and audience.', 'Browse the marketplace and apply to campaigns that suit your audience.', 'Receive a unique tracking link and the promotion guidelines.', 'Share the link, clearly labelled as advertising.', 'Earn the reward for each qualified click or verified lead.', 'Earnings clear after the hold period. Request a payout to your UPI ID.'] },
  ];
  return (
    <><Hero eyebrow="How it works" title="A simple, accountable way to promote and earn" />
      <div className="container-page space-y-14 py-12">
        {flows.map((f, i) => (
          <div key={f.title} className="grid items-center gap-10 lg:grid-cols-2">
            <div className={i % 2 ? 'lg:order-2' : ''}><h2 className="text-2xl font-bold sm:text-3xl">{f.title}</h2>
              <ol className="mt-6 space-y-4">{f.steps.map((s, n) => <li key={s} className="flex gap-4"><span className="num flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-500 text-sm font-bold text-white">{n + 1}</span><p className="pt-1 text-ink-700">{s}</p></li>)}</ol></div>
            <AppImage src={f.img} alt="" width={640} height={480} className="mx-auto w-full max-w-lg" />
          </div>
        ))}
        <div className="card p-6 sm:p-8"><h2 className="text-xl font-semibold">How a click is verified</h2>
          <p className="mt-2 text-ink-600">Every visit through a tracking link is recorded. It becomes a qualified click only when all of these are true:</p>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">{['The campaign is live, in its schedule, and has budget left.', 'The visit does not come from a bot, crawler or link-preview service.', 'It is the first visit from that visitor to that campaign that day.', 'It does not come from the promoter\'s own network.', 'The source is not sending an abnormal burst of clicks.'].map((r) => <li key={r} className="flex gap-2 text-ink-700"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success-600" aria-hidden />{r}</li>)}</ul></div>
        <div className="text-center"><LinkButton to="/register" size="lg">Create your free account</LinkButton></div>
      </div></>
  );
}

export function Pricing() {
  useSeo('Pricing', 'Promora pricing: start free, pay a platform fee only on promoter rewards, and upgrade for lower fees and higher limits.');
  const config = useQuery({ queryKey: ['payment-config-public'], queryFn: () => api<any[]>('/public/plans') });
  return (
    <><Hero eyebrow="Pricing" title="Simple pricing that follows your results" text="Joining is free. Advertisers pay a platform fee on top of promoter rewards. Paid plans lower that fee and raise limits. Prices are introductory and exclude GST." />
      <div className="container-page py-12">
        <PlanCards />
        <div className="mx-auto mt-12 max-w-3xl">
          <h2 className="text-2xl font-bold">How a campaign is priced</h2>
          <div className="card mt-4 overflow-hidden">
            <table className="w-full text-left text-sm"><tbody className="divide-y divide-ink-100">
              {[['Promoter reward budget', 'You choose it', '₹1,000.00'], ['Platform fee on the Free plan', '15% of the reward budget', '₹150.00'], ['GST on the platform fee', '18% of the fee', '₹27.00'], ['You pay', '', '₹1,177.00']].map(([a, b, c], i) => (
                <tr key={a} className={i === 3 ? 'bg-brand-50 font-semibold' : ''}><th scope="row" className="px-5 py-3 font-medium">{a}</th><td className="px-5 py-3 text-ink-500">{b}</td><td className="num px-5 py-3 text-right">{c}</td></tr>
              ))}
            </tbody></table>
          </div>
          <p className="mt-3 text-sm text-ink-500">Worked example. The exact breakdown is calculated by the server and shown before every payment. Promoters join and earn for free.</p>
          {config.isError && <p className="mt-2 text-sm text-danger-600">Plans could not be loaded.</p>}
        </div>
        <div className="mt-14"><h2 className="mb-6 text-center text-2xl font-bold">Pricing questions</h2><FaqList items={FAQS.slice(4).concat([['Can I get a refund?', 'Unspent campaign budget is refundable when a campaign ends, is cancelled or is not approved. Rewards already earned by promoters for verified results are not refundable. See the Refund Policy.'], ['Is there a contract?', 'No. Plans are monthly and you can stop at any time.']])} /></div>
      </div></>
  );
}

export function Faq() {
  useSeo('Frequently asked questions', 'Answers to common questions about advertising and promoting on Promora.');
  return <><Hero eyebrow="FAQ" title="Frequently asked questions" /><div className="container-page py-12"><FaqList items={FAQS.concat([
    ['When do earnings become available?', 'Each commission is pending for a hold period while it can be verified or disputed, then becomes available for payout.'],
    ['How do I report a campaign or profile?', 'Use the "Report" link on any campaign, business or creator page. Copyright complaints can be filed the same way.'],
    ['Can one account advertise and promote?', 'Yes. Add a business profile to advertise and a promoter profile to promote. You cannot promote your own campaigns.'],
    ['Is there an AI assistant?', 'The campaign wizard includes an optional AI writing assistant. It is only available when the platform operator has configured an AI provider.']])} />
    <p className="mt-8 text-center text-ink-600">Still stuck? <Link to="/contact" className="link">Contact us</Link>.</p></div></>;
}

const contactSchema = z.object({ name: z.string().trim().min(2, 'Enter your name'), email: z.string().trim().email('Enter a valid email'), subject: z.string().trim().min(3, 'Add a subject').max(200), message: z.string().trim().min(10, 'Write at least 10 characters').max(4000) });
export function Contact() {
  useSeo('Contact Promora', 'Get in touch with the Promora team.');
  const [sent, setSent] = useState(false);
  const { register, handleSubmit, reset, setError, formState: { errors, isSubmitting } } = useForm<z.infer<typeof contactSchema>>({ resolver: zodResolver(contactSchema) });
  return (
    <><Hero eyebrow="Contact" title="Talk to us" text="Questions, partnerships, complaints or feedback. We read every message." />
      <div className="container-page grid gap-10 py-12 lg:grid-cols-[1fr_360px]">
        <div className="card p-6 sm:p-8">
          {sent ? <Alert tone="success" title="Message received">Thank you. We will reply to the email address you gave.</Alert> : (
            <form className="space-y-5" noValidate onSubmit={handleSubmit(async (v) => { try { await api('/public/contact', { method: 'POST', body: v }); reset(); setSent(true); } catch (e: any) { setError('root', { message: e.message }); } })}>
              <div className="grid gap-5 sm:grid-cols-2"><Input label="Name" required autoComplete="name" error={errors.name?.message} {...register('name')} /><Input label="Email" type="email" required autoComplete="email" error={errors.email?.message} {...register('email')} /></div>
              <Input label="Subject" required error={errors.subject?.message} {...register('subject')} />
              <Textarea label="Message" required rows={6} error={errors.message?.message} {...register('message')} />
              {errors.root && <Alert tone="danger">{errors.root.message}</Alert>}
              <Button type="submit" loading={isSubmitting}>Send message</Button>
            </form>
          )}
        </div>
        <aside className="space-y-4 text-ink-700">
          <div className="card p-5"><h2 className="font-semibold">Report content</h2><p className="mt-1 text-sm text-ink-600">Use the Report link on any campaign or profile so the report reaches our moderation queue with the right context.</p></div>
          <div className="card p-5"><h2 className="font-semibold">Grievances and privacy requests</h2><p className="mt-1 text-sm text-ink-600">Use this form with the subject "Grievance" or "Privacy request". The operator's grievance contact must be published here before launch.</p></div>
        </aside>
      </div></>
  );
}

const LEGAL: Record<string, { title: string; sections: [string, string[]][] }> = {
  'privacy-policy': { title: 'Privacy Policy', sections: [
    ['What we collect', ['Account details you give us: name, email, password (stored only as a one-way hash), and optional phone, city and profile information.', 'Business and promoter profile details you choose to publish.', 'Payment records. Card and bank details are handled by the payment provider and never stored by Promora.', 'Tracking data for campaign links: a salted hash of the IP address and browser, the time, and the referring page. We do not set advertising cookies.', 'Lead details that a visitor submits to an advertiser through a campaign form, with consent.']],
    ['How we use it', ['To run your account, campaigns, tracking, earnings and payouts.', 'To detect and prevent fraud and abuse.', 'To send service messages. Marketing messages are sent only if you opted in, and you can withdraw that consent in Settings.']],
    ['Sharing', ['Leads are shared with the advertiser whose campaign collected them.', 'Service providers that process data for us, such as payment and email providers.', 'Authorities, where the law requires it.']],
    ['Your choices', ['You can view and correct your profile in Settings, download a copy of your data, and ask for your account to be deleted by contacting us.', 'Some records, such as financial transactions, are kept for as long as the law requires.']],
    ['Contact', ['Use the contact page with the subject "Privacy request".']],
  ] },
  terms: { title: 'Terms of Service', sections: [
    ['Who can use Promora', ['You must be 18 or older and able to enter a contract. One person or organisation per account.']],
    ['Advertisers', ['You are responsible for your campaign content and for holding the rights to everything in it.', 'Campaigns must follow the content policy. Promora may reject, pause or terminate campaigns that break it.', 'You pay the reward budget, the platform fee and applicable taxes shown at checkout.']],
    ['Promoters', ['You must disclose paid promotions clearly and follow the rules of the platforms you post on.', 'You must not generate artificial clicks or leads. Commissions from invalid activity can be reversed and accounts suspended.', 'Earnings become payable after the hold period and are paid to the payout method you provide. You are responsible for your own taxes.']],
    ['Prohibited content', ['Illegal products or services, gambling and betting, adult content, tobacco and alcohol, unlicensed financial or medical products, multi-level marketing, hate or harassment, and fake engagement services.']],
    ['Accounts and termination', ['We may suspend accounts that break these terms or put other users at risk. You may stop using Promora at any time.']],
  ] },
  'refund-policy': { title: 'Refund and Cancellation Policy', sections: [
    ['Campaign budgets', ['Unspent reward budget is refundable when a campaign ends, is cancelled, is terminated or is not approved. The platform fee and tax on the unspent portion are refunded in the same proportion where the payment provider allows it.', 'Rewards already earned by promoters for verified results are not refundable, unless the activity is found to be fraudulent.']],
    ['Subscriptions', ['Plans are billed monthly in advance. You can cancel at any time; the plan stays active until the end of the paid period.']],
    ['How refunds are paid', ['Refunds go back to the original payment method through the payment provider. Timing depends on the provider and your bank.']],
    ['Disputes', ['If you believe clicks or leads were invalid, contact us within the hold period with the campaign name. We will review the tracking records.']],
  ] },
};
export function Legal({ doc }: { doc: keyof typeof LEGAL }) {
  const d = LEGAL[doc];
  useSeo(d.title, `${d.title} for the Promora promotion marketplace.`);
  useEffect(() => { window.scrollTo(0, 0); }, [doc]);
  return (
    <div className="container-page max-w-3xl py-12">
      <h1 className="text-3xl font-bold sm:text-4xl">{d.title}</h1>
      <div className="mt-5"><Alert tone="warning" title="Template text pending legal review">This document describes how the product works. It has not been reviewed by a lawyer and is not a statement of legal compliance. The operator must have it reviewed and add its registered name, address and grievance contact before launch.</Alert></div>
      <div className="prose-legal">{d.sections.map(([h, items]) => <section key={h}><h2>{h}</h2><ul>{items.map((t) => <li key={t}>{t}</li>)}</ul></section>)}</div>
    </div>
  );
}

export function NotFound() {
  useSeo('Page not found', undefined, { noindex: true });
  return <div className="container-page py-20"><div className="card"><EmptyState kind="search" title="Page not found" text="The page you are looking for does not exist or has moved." action={<LinkButton to="/">Go to the homepage</LinkButton>} /></div></div>;
}
