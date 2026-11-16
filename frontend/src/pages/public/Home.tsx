import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, BarChart3, CheckCircle2, ChevronDown, Compass, HandCoins, Link2, Megaphone, MousePointerClick, ShieldCheck, Sparkles, Target, Users, Wallet } from 'lucide-react';
import { api, type Page } from '../../lib/api';
import { track } from '../../lib/analytics';
import { compact, money } from '../../lib/format';
import { useSeo } from '../../lib/seo';
import { AppImage, CampaignCard, CategoryIcon } from '../../components/brand';
import { EmptyState, LinkButton, Spinner, cx } from '../../components/ui';

export const FAQS = [
  ['What is Promora?', 'Promora is a promotion marketplace. Businesses and creators publish campaigns, and promoters share them with their audience through unique tracking links. Advertisers pay for verified results.'],
  ['What can I promote?', 'Any legitimate business, product, service, app, website, channel, course, event or community. Gambling, adult content, tobacco, alcohol, unlicensed financial or medical products and fake engagement are not allowed.'],
  ['How do promoters earn?', 'Each approved promoter gets a unique link. You earn the campaign reward for every qualified click or verified lead. Earnings clear after a short hold period and are paid to your UPI ID.'],
  ['What is a qualified click?', 'A real visit from a unique person. Repeat visits on the same day, automated traffic, link previews and clicks from the promoter\'s own network are recorded but never paid.'],
  ['What does it cost to advertise?', 'You set the reward and the budget. Promora adds a platform fee on top of the reward budget, shown in full before you pay. Unspent budget can be refunded when a campaign ends.'],
  ['Do I have to disclose paid promotions?', 'Yes. Posts made for a reward are advertising and must be clearly labelled, for example with "Ad" at the start of the caption. Promoters confirm this before receiving a link.'],
];

const SAMPLE_TESTIMONIALS = [
  ['I could finally test a campaign with a small budget and see exactly which visits were real.', 'Founder of a home-grown products brand'],
  ['My page is small, but the audience trusts me. Getting paid per verified click suits me well.', 'Micro-creator in the lifestyle space'],
  ['The click quality report made the conversation with my client simple.', 'Freelance marketing consultant'],
];

function Section({ eyebrow, title, text, children, className, id }: { eyebrow?: string; title: string; text?: string; children: React.ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={cx('py-16 sm:py-20', className)}>
      <div className="container-page">
        <div className="mx-auto max-w-2xl text-center">
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <h2 className="mt-2 text-3xl font-bold sm:text-4xl">{title}</h2>
          {text && <p className="mt-3 text-lg text-ink-600">{text}</p>}
        </div>
        <div className="mt-10 sm:mt-12">{children}</div>
      </div>
    </section>
  );
}

export function FaqList({ items }: { items: string[][] }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="mx-auto max-w-3xl divide-y divide-ink-200 rounded-2xl border border-ink-200 bg-white">
      {items.map(([q, a], i) => (
        <div key={q}>
          <button className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-base font-semibold text-ink-900" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}>
            {q}<ChevronDown className={cx('h-5 w-5 shrink-0 text-ink-400 transition', open === i && 'rotate-180')} aria-hidden />
          </button>
          {open === i && <p className="px-5 pb-5 leading-relaxed text-ink-600">{a}</p>}
        </div>
      ))}
    </div>
  );
}

export function PlanCards({ compactView }: { compactView?: boolean }) {
  const plans = useQuery({ queryKey: ['plans'], queryFn: () => api<any[]>('/public/plans'), staleTime: 300_000 });
  if (plans.isLoading) return <Spinner />;
  if (!plans.data?.length) return <p className="text-center text-ink-500">Plans are not available right now.</p>;
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {plans.data.map((p) => (
        <div key={p.id} className={cx('card relative flex flex-col p-6', p.highlighted && 'border-brand-500 shadow-lift ring-1 ring-brand-500')}>
          {p.highlighted && <span className="absolute -top-3 left-6 rounded-full bg-brand-500 px-3 py-1 text-xs font-semibold text-white">Most popular</span>}
          <h3 className="text-lg font-semibold">{p.name}</h3>
          <p className="mt-3"><span className="num font-display text-4xl font-bold text-ink-900">{money(p.pricePaise)}</span><span className="text-ink-500"> / month</span></p>
          <p className="mt-1 text-sm text-ink-500">{(p.platformFeeBps / 100).toFixed(p.platformFeeBps % 100 ? 1 : 0)}% platform fee on rewards</p>
          <ul className="mt-5 flex-1 space-y-2.5 text-sm text-ink-700">
            {String(p.features).split('|').filter(Boolean).map((f: string) => <li key={f} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" aria-hidden />{f}</li>)}
          </ul>
          {!compactView && (
            <Link to={p.pricePaise === 0 ? '/register' : `/dashboard/billing?plan=${p.code}`} onClick={() => track('pricing_plan_clicked', { plan: p.code })}
              className={cx('mt-6 inline-flex h-11 items-center justify-center rounded-xl text-[15px] font-semibold transition', p.highlighted ? 'bg-brand-500 text-white hover:bg-brand-600' : 'border border-ink-300 text-ink-800 hover:bg-ink-50')}>
              {p.pricePaise === 0 ? 'Start free' : `Choose ${p.name}`}
            </Link>
          )}
        </div>
      ))}
    </div>
  );
}

export default function Home() {
  useSeo('Promora | One Platform. Infinite Possibilities.', 'Promote your business, product, app, channel or course, or earn by promoting others. Pay only for verified results.');
  useEffect(() => { track('landing_page_viewed', { page: 'home' }); }, []);
  const featured = useQuery({ queryKey: ['home', 'campaigns'], queryFn: () => api<Page>('/public/campaigns?size=6') });
  const categories = useQuery({ queryKey: ['categories'], queryFn: () => api<any[]>('/public/categories'), staleTime: 300_000 });
  const stats = useQuery({ queryKey: ['stats'], queryFn: () => api<Record<string, number>>('/public/stats') });
  const liveStats = stats.data ? [
    ['Live campaigns', stats.data.activeCampaigns], ['Businesses', stats.data.businesses], ['Creators', stats.data.creators], ['Verified clicks delivered', stats.data.qualifiedClicks],
  ].filter(([, v]) => Number(v) > 0) : [];

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-ink-900">
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <div className="absolute -left-40 top-[-10rem] h-[32rem] w-[32rem] rounded-full bg-brand-500/25 blur-3xl" />
          <div className="absolute right-[-8rem] top-24 h-[28rem] w-[28rem] rounded-full bg-sky-500/20 blur-3xl" />
        </div>
        <div className="container-page relative grid items-center gap-10 py-16 lg:grid-cols-[1.05fr_1fr] lg:py-24">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-sm font-medium text-brand-200"><Sparkles className="h-4 w-4" aria-hidden />One Platform. Infinite Possibilities.</p>
            <h1 className="mt-5 text-4xl font-extrabold leading-[1.08] text-white sm:text-5xl lg:text-6xl">Your Ideas Deserve to Be <span className="bg-gradient-to-r from-brand-300 to-sky-500 bg-clip-text text-transparent">Seen.</span></h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-300">Promora is the universal promotion marketplace. Launch a campaign for your business, product, app, channel or course, and let creators and communities bring you real visitors. You pay only for verified results.</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <LinkButton to="/register" size="lg">Start Promoting<ArrowRight className="h-5 w-5" aria-hidden /></LinkButton>
              <LinkButton to="/campaigns" size="lg" variant="white">Explore Opportunities</LinkButton>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-300">
              {['Free to join', 'Fraud-filtered tracking', 'Payouts by UPI'].map((t) => <li key={t} className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-brand-300" aria-hidden />{t}</li>)}
            </ul>
          </div>
          <div className="relative mx-auto w-full max-w-xl lg:max-w-none">
            <AppImage src="/assets/hero/hero-main.svg" alt="A growth hub connecting businesses, creators and audiences" eager width={960} height={760} className="w-full drop-shadow-2xl" />
          </div>
        </div>
        {liveStats.length > 0 && (
          <div className="relative border-t border-white/10">
            <dl className="container-page grid grid-cols-2 gap-6 py-8 sm:grid-cols-4">
              {liveStats.map(([label, value]) => <div key={label as string}><dd className="num font-display text-3xl font-bold text-white">{compact(Number(value))}</dd><dt className="mt-1 text-sm text-ink-400">{label}</dt></div>)}
            </dl>
          </div>
        )}
      </section>

      {/* How it works */}
      <Section eyebrow="How Promora works" title="From idea to verified results in four steps" text="The same simple flow for a single creator and for a growing brand.">
        <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[[Megaphone, 'Create a campaign', 'Describe what you are promoting, set a reward per result and choose a budget.'],
            [ShieldCheck, 'We review it', 'Every campaign is checked against our content policy before it goes live.'],
            [Link2, 'Promoters share', 'Creators apply, get a unique tracking link and share it with their audience.'],
            [BarChart3, 'Pay for results', 'Only qualified clicks and verified leads are counted, reported and rewarded.']].map(([Icon, t, d]: any, i) => (
            <li key={t} className="card p-6">
              <div className="flex items-center justify-between"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-100 text-brand-600"><Icon className="h-5 w-5" aria-hidden /></span><span className="num font-display text-3xl font-bold text-ink-200">0{i + 1}</span></div>
              <h3 className="mt-4 text-lg font-semibold">{t}</h3><p className="mt-1.5 text-ink-600">{d}</p>
            </li>
          ))}
        </ol>
      </Section>

      {/* Advertisers / creators */}
      <section className="bg-ink-50 py-16 sm:py-20">
        <div className="container-page space-y-16">
          {[{ eyebrow: 'For advertisers', title: 'Reach real people without an agency budget', img: '/assets/illustrations/advertiser.svg', alt: 'A business owner creating a campaign', to: '/register?as=advertiser', cta: 'Create a campaign',
              points: [[Target, 'Set your own reward', 'Decide what a qualified click or a lead is worth to you.'], [MousePointerClick, 'Verified traffic only', 'Duplicates, bots and self-clicks are filtered before you are charged.'], [BarChart3, 'Clear reporting', 'See clicks, quality and spend for every campaign and promoter.']] },
            { eyebrow: 'For creators', title: 'Earn from the audience you already have', img: '/assets/illustrations/creator.svg', alt: 'A creator discovering promotional opportunities', to: '/register?as=promoter', cta: 'Become a promoter', flip: true,
              points: [[Compass, 'Find campaigns that fit', 'Browse by category, reward and objective, then apply in a tap.'], [Link2, 'One link per campaign', 'Share it in a reel, a story, a video description or a community.'], [Wallet, 'Paid to your UPI', 'Track pending and cleared earnings, then request a payout.']] }].map((b) => (
            <div key={b.eyebrow} className="grid items-center gap-10 lg:grid-cols-2">
              <div className={cx(b.flip && 'lg:order-2')}>
                <p className="eyebrow">{b.eyebrow}</p>
                <h2 className="mt-2 text-3xl font-bold sm:text-4xl">{b.title}</h2>
                <ul className="mt-6 space-y-5">
                  {b.points.map(([Icon, t, d]: any) => (
                    <li key={t} className="flex gap-4"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-brand-600 shadow-card"><Icon className="h-5 w-5" aria-hidden /></span><div><h3 className="font-semibold">{t}</h3><p className="text-ink-600">{d}</p></div></li>
                  ))}
                </ul>
                <LinkButton to={b.to} className="mt-8">{b.cta}<ArrowRight className="h-4 w-4" aria-hidden /></LinkButton>
              </div>
              <AppImage src={b.img} alt={b.alt} width={640} height={480} className="mx-auto w-full max-w-lg" />
            </div>
          ))}
        </div>
      </section>

      {/* Featured campaigns */}
      <Section eyebrow="Featured campaigns" title="Opportunities live right now" text="Real campaigns from the marketplace, updated as they are approved.">
        {featured.isLoading ? <Spinner /> : featured.isError ? <p className="text-center text-ink-500">Campaigns could not be loaded. Please refresh the page.</p>
          : featured.data!.items.length === 0 ? <EmptyState kind="campaigns" title="No live campaigns yet" text="Be the first to launch one." action={<LinkButton to="/register">Start Promoting</LinkButton>} />
          : <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{featured.data!.items.map((c) => <CampaignCard key={c.id} c={c} />)}</div>}
        <div className="mt-10 text-center"><LinkButton to="/campaigns" variant="secondary">Browse all campaigns<ArrowRight className="h-4 w-4" aria-hidden /></LinkButton></div>
      </Section>

      {/* Categories */}
      <section className="bg-ink-50 py-16 sm:py-20">
        <div className="container-page">
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
            <div><p className="eyebrow">Popular categories</p><h2 className="mt-2 text-3xl font-bold sm:text-4xl">Promote almost anything legitimate</h2></div>
            <Link to="/categories" className="link inline-flex items-center gap-1">All categories<ArrowRight className="h-4 w-4" aria-hidden /></Link>
          </div>
          <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {(categories.data || []).slice(0, 8).map((c) => (
              <Link key={c.slug} to={`/campaigns?category=${c.slug}`} className="card group flex items-center gap-3 p-4 transition hover:border-brand-300 hover:shadow-lift">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-600"><CategoryIcon name={c.icon} className="h-5 w-5" /></span>
                <span className="min-w-0"><span className="block truncate font-semibold text-ink-900 group-hover:text-brand-600">{c.name}</span><span className="text-xs text-ink-500">{c.activeCampaigns} live</span></span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Why Promora */}
      <Section eyebrow="Why Promora" title="Built for trust on both sides">
        <div className="grid gap-5 md:grid-cols-3">
          {[[ShieldCheck, 'Moderated marketplace', 'Every campaign is reviewed. Reported listings are investigated and removed when they break the rules.'],
            [HandCoins, 'Accountable money', 'Budgets are held against campaigns, rewards are recorded per verified event, and unspent funds are refundable.'],
            [Users, 'One account, two roles', 'Advertise your own work and promote others from the same account, with separate dashboards.']].map(([Icon, t, d]: any) => (
            <div key={t} className="card p-6"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-ink-900 text-white"><Icon className="h-5 w-5" aria-hidden /></span><h3 className="mt-4 text-lg font-semibold">{t}</h3><p className="mt-1.5 text-ink-600">{d}</p></div>
          ))}
        </div>
      </Section>

      {/* Testimonials: sample content */}
      <section className="bg-ink-900 py-16 sm:py-20">
        <div className="container-page">
          <div className="mx-auto max-w-2xl text-center">
            <p className="eyebrow !text-brand-300">What people tell us they want</p>
            <h2 className="mt-2 text-3xl font-bold text-white sm:text-4xl">Illustrative voices</h2>
            <p className="mt-3 text-ink-300"><strong className="text-white">Sample content.</strong> These are illustrative examples, not quotes from real customers. Genuine reviews will replace them as they are collected.</p>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {SAMPLE_TESTIMONIALS.map(([q, who]) => (
              <figure key={who} className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-semibold text-brand-200">Sample</span>
                <blockquote className="mt-4 text-lg leading-relaxed text-white">“{q}”</blockquote>
                <figcaption className="mt-4 text-sm text-ink-400">{who} (illustrative)</figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing preview */}
      <Section eyebrow="Pricing" title="Start free. Upgrade when it pays for itself." text="Introductory pricing. Plans lower your platform fee and raise your campaign limit.">
        <PlanCards compactView />
        <div className="mt-8 text-center"><LinkButton to="/pricing" variant="secondary">Compare plans</LinkButton></div>
      </Section>

      {/* FAQ */}
      <section className="bg-ink-50 py-16 sm:py-20" id="faq">
        <div className="container-page">
          <div className="mx-auto mb-10 max-w-2xl text-center"><p className="eyebrow">FAQ</p><h2 className="mt-2 text-3xl font-bold sm:text-4xl">Questions, answered</h2></div>
          <FaqList items={FAQS} />
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 sm:py-20">
        <div className="container-page">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 via-brand-500 to-sky-500 px-6 py-14 text-center sm:px-12">
            <h2 className="text-3xl font-bold text-white sm:text-4xl">Ready to be seen?</h2>
            <p className="mx-auto mt-3 max-w-xl text-lg text-white/85">Create a free account, launch your first campaign or find one to promote today.</p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row"><LinkButton to="/register" size="lg" variant="white">Start Promoting</LinkButton><LinkButton to="/campaigns" size="lg" className="!bg-ink-900 hover:!bg-ink-800">Explore Opportunities</LinkButton></div>
          </div>
        </div>
      </section>
    </>
  );
}
