import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { AuthProvider } from '../lib/auth';
import { ConfirmDialog, DataTable, StatusBadge, ToastProvider } from '../components/ui';
import { BarChart } from '../components/charts';
import { money, rewardLabel, rupeesToPaise, titleCase } from '../lib/format';
import { qs } from '../lib/api';
import { Login, Register, safeNext } from '../pages/auth/Auth';
import { AdminLayout, DashboardLayout } from '../layouts/AppLayouts';

/** Minimal fake of the Promora API: every test declares the responses it needs. */
function mockApi(routes: Record<string, (init?: RequestInit) => { status?: number; body?: unknown }>) {
  const calls: { url: string; init?: RequestInit }[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    const key = Object.keys(routes).find((k) => url.includes(k));
    const r = key ? routes[key](init) : { status: 404, body: { code: 'NOT_FOUND', message: 'Not found' } };
    return new Response(r.body === undefined ? null : JSON.stringify(r.body), { status: r.status ?? 200 });
  }));
  return calls;
}
function wrap(ui: ReactNode, path = '/') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[path]}><AuthProvider><ToastProvider>{ui}</ToastProvider></AuthProvider></MemoryRouter></QueryClientProvider>);
}
const user = (roles: string[], extra = {}) => ({ id: 'u1', email: 'a@b.in', fullName: 'Asha Rao', roles, emailVerified: true, verifiedBadge: false, promoCreditsPaise: 0, profile: {}, advertiserProfile: null, promoterProfile: null, ...extra });

beforeEach(() => { vi.unstubAllGlobals(); });

describe('formatting', () => {
  it('formats paise as rupees', () => {
    expect(money(117700)).toBe('₹1,177');
    expect(money(250)).toBe('₹2.50');
    expect(money(null)).toBe('₹0');
    expect(rupeesToPaise('5.5')).toBe(550);
    expect(rewardLabel('CPL', 6000)).toBe('₹60 per lead');
    expect(titleCase('PENDING_REVIEW')).toBe('Pending review');
  });
  it('builds query strings without empty values', () => {
    expect(qs({ q: 'candle', category: '', page: 0, size: 12, x: undefined })).toBe('?q=candle&page=0&size=12');
    expect(qs({})).toBe('');
  });
  it('only accepts same-site redirect targets', () => {
    expect(safeNext('/campaigns/1', '/dashboard')).toBe('/campaigns/1');
    expect(safeNext('https://evil.example', '/dashboard')).toBe('/dashboard');
    expect(safeNext('//evil.example', '/dashboard')).toBe('/dashboard');
    expect(safeNext(null, '/dashboard')).toBe('/dashboard');
  });
});

describe('components', () => {
  it('renders a status badge with a readable label', () => {
    render(<StatusBadge status="CHANGES_REQUESTED" />);
    expect(screen.getByText('Changes requested')).toBeInTheDocument();
  });
  it('renders table rows and reacts to row clicks', async () => {
    const onRowClick = vi.fn();
    render(<DataTable rows={[{ id: '1', name: 'Kaveri' }]} rowKey={(r) => r.id} onRowClick={onRowClick} columns={[{ header: 'Name', primary: true, cell: (r) => r.name }]} />);
    await userEvent.click(screen.getAllByText('Kaveri')[0]);
    expect(onRowClick).toHaveBeenCalledWith({ id: '1', name: 'Kaveri' });
  });
  it('shows an honest empty message instead of an empty chart', () => {
    render(<BarChart data={[{ day: '2026-11-01', clicks: 0 }]} labelKey="day" series={[{ key: 'clicks', label: 'Clicks', color: '#000' }]} />);
    expect(screen.getByText(/No activity recorded/)).toBeInTheDocument();
  });
  it('requires a reason before a destructive action can be confirmed', async () => {
    const onConfirm = vi.fn();
    render(<ConfirmDialog open title="Suspend this account?" message="Sure?" reason="required" danger confirmLabel="Suspend" onConfirm={onConfirm} onClose={() => undefined} />);
    const confirm = screen.getByRole('button', { name: 'Suspend' });
    expect(confirm).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Reason (required)'), 'Policy breach');
    await userEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledWith('Policy breach');
  });
});

describe('registration form validation', () => {
  it('blocks submission and explains each problem', async () => {
    const calls = mockApi({ '/auth/refresh': () => ({ status: 401, body: {} }), '/public/events': () => ({ status: 202 }) });
    wrap(<Register />, '/register');
    await userEvent.type(await screen.findByLabelText(/Full name/), 'A');
    await userEvent.type(screen.getByLabelText(/^Email/), 'not-an-email');
    await userEvent.type(screen.getByLabelText(/^Password/), 'short');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByText('Enter your full name')).toBeInTheDocument();
    expect(screen.getByText('Enter a valid email')).toBeInTheDocument();
    expect(screen.getByText('Use at least 8 characters')).toBeInTheDocument();
    expect(screen.getByText('You must accept the Terms and Privacy Policy')).toBeInTheDocument();
    expect(calls.some((c) => c.url.includes('/auth/register'))).toBe(false);
  });
  it('sends the form to the API and shows a server-side duplicate email error', async () => {
    const calls = mockApi({ '/auth/refresh': () => ({ status: 401, body: {} }), '/public/events': () => ({ status: 202 }),
      '/auth/register': () => ({ status: 409, body: { code: 'EMAIL_TAKEN', message: 'An account with this email already exists' } }) });
    wrap(<Register />, '/register?ref=ABCD1234');
    expect(await screen.findByLabelText(/Referral code/)).toHaveValue('ABCD1234');
    await userEvent.type(screen.getByLabelText(/Full name/), 'Asha Rao');
    await userEvent.type(screen.getByLabelText(/^Email/), 'asha@example.com');
    await userEvent.type(screen.getByLabelText(/^Password/), 'Passw0rd-123');
    await userEvent.click(screen.getByLabelText(/I am 18 or older/));
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByText('An account with this email already exists')).toBeInTheDocument();
    const sent = JSON.parse(String(calls.find((c) => c.url.includes('/auth/register'))!.init!.body));
    expect(sent).toMatchObject({ email: 'asha@example.com', fullName: 'Asha Rao', acceptTerms: true, referralCode: 'ABCD1234' });
  });
});

describe('login', () => {
  it('shows the API error for wrong credentials', async () => {
    mockApi({ '/auth/refresh': () => ({ status: 401, body: {} }), '/auth/login': () => ({ status: 401, body: { code: 'INVALID_CREDENTIALS', message: 'Email or password is incorrect' } }) });
    wrap(<Login />, '/login');
    await userEvent.type(await screen.findByLabelText(/^Email/), 'a@b.in');
    await userEvent.type(screen.getByLabelText(/^Password/), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));
    expect(await screen.findByText('Email or password is incorrect')).toBeInTheDocument();
  });
});

describe('route protection', () => {
  const tree = (
    <Routes>
      <Route path="/login" element={<p>Login page</p>} />
      <Route path="/dashboard" element={<DashboardLayout />}><Route index element={<p>Workspace home</p>} /></Route>
      <Route path="/admin" element={<AdminLayout />}><Route index element={<p>Admin home</p>} /></Route>
    </Routes>
  );
  it('sends signed-out visitors to the login page', async () => {
    mockApi({ '/auth/refresh': () => ({ status: 401, body: {} }) });
    wrap(tree, '/dashboard');
    expect(await screen.findByText('Login page')).toBeInTheDocument();
  });
  it('keeps non-staff users out of the admin console', async () => {
    mockApi({ '/auth/refresh': () => ({ body: { accessToken: 't' } }), '/me/notifications': () => ({ body: { unread: 0, page: { items: [] } } }), '/me': () => ({ body: user(['USER', 'ADVERTISER']) }) });
    wrap(tree, '/admin');
    expect(await screen.findByText('Workspace home')).toBeInTheDocument();
    expect(screen.queryByText('Admin home')).not.toBeInTheDocument();
  });
  it('shows staff only the admin modules their permissions allow', async () => {
    mockApi({ '/auth/refresh': () => ({ body: { accessToken: 't' } }), '/me/notifications': () => ({ body: { unread: 3, page: { items: [] } } }),
      '/me': () => ({ body: user(['USER', 'ADMIN'], { permissions: ['admin.access', 'user.view', 'campaign.moderate'] }) }) });
    wrap(tree, '/admin');
    expect(await screen.findByText('Admin home')).toBeInTheDocument();
    expect(screen.getAllByText('Users').length).toBeGreaterThan(0);
    expect(screen.queryByText('Audit log')).not.toBeInTheDocument();
    expect(screen.queryByText('Payments and finance')).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText('Notifications, 3 unread')).toBeInTheDocument());
  });
});
