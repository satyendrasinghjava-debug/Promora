import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Menu, X, Megaphone } from 'lucide-react';
import { api } from '../lib/api';
import { isStaff, useAuth } from '../lib/auth';
import { Logo } from '../components/brand';
import { LinkButton, cx } from '../components/ui';

const NAV = [
  { to: '/discover', label: 'Discover' }, { to: '/campaigns', label: 'Campaigns' }, { to: '/creators', label: 'Creators' },
  { to: '/businesses', label: 'Businesses' }, { to: '/how-it-works', label: 'How it works' }, { to: '/pricing', label: 'Pricing' },
];
const FOOTER = [
  { title: 'Platform', links: [['Discover', '/discover'], ['Campaigns', '/campaigns'], ['Categories', '/categories'], ['Creators', '/creators'], ['Businesses', '/businesses']] },
  { title: 'Company', links: [['About', '/about'], ['How it works', '/how-it-works'], ['Pricing', '/pricing'], ['FAQ', '/faq'], ['Contact', '/contact']] },
  { title: 'Legal', links: [['Privacy Policy', '/privacy-policy'], ['Terms of Service', '/terms'], ['Refund Policy', '/refund-policy']] },
];

export default function PublicLayout() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => { setOpen(false); window.scrollTo(0, 0); }, [pathname]);
  const announcements = useQuery({ queryKey: ['announcements'], queryFn: () => api<any[]>('/public/announcements'), staleTime: 300_000 });
  const first = announcements.data?.[0];
  const home = user ? (isStaff(user) ? '/admin' : '/dashboard') : null;

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2">Skip to content</a>
      {first && (
        <div className="bg-ink-900 px-4 py-2 text-center text-sm text-white">
          <Megaphone className="mr-2 inline h-4 w-4 text-brand-300" aria-hidden /><span className="font-semibold">{first.title}</span><span className="text-ink-300"> · {first.body}</span>
        </div>
      )}
      <header className="sticky top-0 z-40 border-b border-ink-200/70 bg-white/90 backdrop-blur">
        <div className="container-page flex h-16 items-center justify-between gap-6">
          <Link to="/" aria-label="Promora home"><Logo /></Link>
          <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} className={({ isActive }) => cx('rounded-lg px-3 py-2 text-sm font-medium transition', isActive ? 'bg-brand-100 text-brand-700' : 'text-ink-600 hover:bg-ink-100 hover:text-ink-900')}>{n.label}</NavLink>
            ))}
          </nav>
          <div className="hidden items-center gap-2 lg:flex">
            {home ? <LinkButton to={home} size="sm">Open dashboard</LinkButton> : <><LinkButton to="/login" variant="ghost" size="sm">Log in</LinkButton><LinkButton to="/register" size="sm">Start Promoting</LinkButton></>}
          </div>
          <button className="rounded-lg p-2 text-ink-700 hover:bg-ink-100 lg:hidden" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={open ? 'Close menu' : 'Open menu'}>
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
        {open && (
          <nav className="border-t border-ink-200 bg-white px-4 pb-5 pt-2 lg:hidden" aria-label="Mobile">
            {NAV.map((n) => <NavLink key={n.to} to={n.to} className={({ isActive }) => cx('block rounded-lg px-3 py-3 text-base font-medium', isActive ? 'bg-brand-100 text-brand-700' : 'text-ink-700')}>{n.label}</NavLink>)}
            <div className="mt-3 grid gap-2">
              {home ? <LinkButton to={home}>Open dashboard</LinkButton> : <><LinkButton to="/register">Start Promoting</LinkButton><LinkButton to="/login" variant="secondary">Log in</LinkButton></>}
            </div>
          </nav>
        )}
      </header>
      <main id="main" className="flex-1"><Outlet /></main>
      <footer className="bg-ink-900 text-ink-300">
        <div className="container-page grid gap-10 py-14 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <Logo white />
            <p className="mt-4 max-w-xs text-sm leading-relaxed">One Platform. Infinite Possibilities. A promotion marketplace for businesses, creators and the audiences they serve.</p>
            <p className="mt-4 text-xs text-ink-400">Made in India. Prices in INR.</p>
          </div>
          {FOOTER.map((col) => (
            <div key={col.title}>
              <h2 className="text-sm font-semibold text-white">{col.title}</h2>
              <ul className="mt-4 space-y-2.5 text-sm">{col.links.map(([label, to]) => <li key={to}><Link to={to} className="hover:text-white">{label}</Link></li>)}</ul>
            </div>
          ))}
        </div>
        <div className="border-t border-white/10"><div className="container-page flex flex-col gap-2 py-5 text-xs text-ink-400 sm:flex-row sm:justify-between">
          <span>© {new Date().getFullYear()} Promora. All rights reserved.</span>
          <span>Paid promotions on Promora must be labelled as advertising.</span>
        </div></div>
      </footer>
    </div>
  );
}
