import { Link } from 'react-router-dom';
import { ArrowUpRight, Briefcase, Building2, CalendarDays, GraduationCap, Link2, MapPin, ShoppingBag, Smartphone, Tag, Users, Video, Megaphone, Sparkles, Store, Heart, type LucideIcon } from 'lucide-react';
import { rewardLabel, money } from '../lib/format';
import { Badge, VerifiedMark, cx } from './ui';
import { ProgressBar } from './charts';

export function Logo({ white, className }: { white?: boolean; className?: string }) {
  return <img src={white ? '/assets/brand/logo-horizontal-white.svg' : '/assets/brand/logo-horizontal.svg'} alt="Promora" width={146} height={36} className={cx('h-9 w-auto', className)} />;
}

export const CATEGORY_ICONS: Record<string, LucideIcon> = { Briefcase, Building2, CalendarDays, GraduationCap, Link2, MapPin, ShoppingBag, Smartphone, Tag, Video, Megaphone, Sparkles, Store, Heart, Users };

/** Renders a Lucide icon by the name stored with a category. Falls back to a tag icon for unknown names. */
export function CategoryIcon({ name, className }: { name?: string; className?: string }) {
  const Cmp = CATEGORY_ICONS[name || 'Tag'] || Tag;
  return <Cmp className={className} aria-hidden />;
}

/** Responsive image with reserved space, lazy loading and a required text alternative. */
export function AppImage({ src, alt, className, eager, width, height }: { src: string; alt: string; className?: string; eager?: boolean; width?: number; height?: number }) {
  return <img src={src} alt={alt} width={width} height={height} loading={eager ? 'eager' : 'lazy'} decoding="async" className={className} />;
}

export function CampaignCard({ c }: { c: any }) {
  const left = Math.max(0, Number(c.fundedPaise) - Number(c.spentPaise));
  return (
    <Link to={`/campaigns/${c.id}`} className="card group flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-lift">
      <div className="relative aspect-[16/9] overflow-hidden bg-brand-100">
        <AppImage src={c.imageUrl || `/assets/categories/${c.categorySlug || 'businesses-startups'}.svg`} alt="" className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" width={400} height={225} />
        {c.featured && <span className="absolute left-3 top-3"><Badge tone="dark">Featured</Badge></span>}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-center justify-between gap-2 text-xs text-ink-500">
          <span className="inline-flex items-center gap-1.5 truncate"><CategoryIcon name={c.categoryIcon} className="h-3.5 w-3.5" />{c.categoryName || 'General'}</span>
          <VerifiedMark status={c.businessVerification} />
        </div>
        <h3 className="mt-2 line-clamp-2 text-[17px] font-semibold leading-snug group-hover:text-brand-600">{c.title}</h3>
        <p className="mt-1 text-sm text-ink-500">by {c.businessName}</p>
        <p className="mt-3 line-clamp-2 flex-1 text-sm text-ink-600">{c.summary}</p>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <span className="num whitespace-nowrap rounded-lg bg-brand-100 px-2.5 py-1 text-sm font-semibold text-brand-700">{rewardLabel(c.rewardType, c.rewardPaise)}</span>
          <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs text-ink-500"><Users className="h-3.5 w-3.5" aria-hidden />{c.promoters} promoting</span>
        </div>
        <div className="mt-4"><ProgressBar value={Number(c.spentPaise)} max={Number(c.fundedPaise)} label={`${money(left)} budget left`} /></div>
        <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand-600">View opportunity<ArrowUpRight className="h-4 w-4" aria-hidden /></span>
      </div>
    </Link>
  );
}
