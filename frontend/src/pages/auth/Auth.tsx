import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CheckCircle2 } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { getReferralCode, getUtm, track } from '../../lib/analytics';
import { isStaff, useAuth } from '../../lib/auth';
import { useSeo } from '../../lib/seo';
import { Logo } from '../../components/brand';
import { Alert, Button, Input, Spinner } from '../../components/ui';

export const passwordRule = z.string().min(8, 'Use at least 8 characters').max(72).regex(/[A-Za-z]/, 'Include at least one letter').regex(/\d/, 'Include at least one number');
/** Only same-site paths are accepted as a post-login destination. */
export const safeNext = (next: string | null, fallback: string) => (next && next.startsWith('/') && !next.startsWith('//') ? next : fallback);

function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col px-5 py-8 sm:px-10">
        <Link to="/" aria-label="Promora home"><Logo /></Link>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
          <h1 className="text-3xl font-bold">{title}</h1>
          {subtitle && <p className="mt-2 text-ink-600">{subtitle}</p>}
          <div className="mt-8">{children}</div>
          {footer && <div className="mt-6 text-sm text-ink-600">{footer}</div>}
        </div>
      </div>
      <div className="relative hidden overflow-hidden bg-ink-900 lg:block">
        <div className="absolute -left-24 top-10 h-96 w-96 rounded-full bg-brand-500/30 blur-3xl" aria-hidden /><div className="absolute bottom-0 right-[-6rem] h-96 w-96 rounded-full bg-sky-500/25 blur-3xl" aria-hidden />
        <div className="relative flex h-full flex-col justify-center px-14">
          <p className="eyebrow !text-brand-300">One Platform. Infinite Possibilities.</p>
          <p className="mt-4 font-display text-4xl font-bold leading-tight text-white">Promote what you build. Earn from what you share.</p>
          <ul className="mt-8 space-y-3 text-ink-300">{['Pay only for verified clicks and leads', 'Unique tracking link for every promoter', 'Transparent earnings and UPI payouts'].map((t) => <li key={t} className="flex items-center gap-3"><CheckCircle2 className="h-5 w-5 text-brand-300" aria-hidden />{t}</li>)}</ul>
          <img src="/assets/illustrations/marketplace.svg" alt="" className="mt-10 w-full max-w-md opacity-95" width={640} height={480} />
        </div>
      </div>
    </div>
  );
}

const loginSchema = z.object({ email: z.string().trim().email('Enter a valid email'), password: z.string().min(1, 'Enter your password') });
export function Login() {
  useSeo('Log in', undefined, { noindex: true });
  const { user, login } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<z.infer<typeof loginSchema>>({ resolver: zodResolver(loginSchema) });
  if (user) return <Navigate to={safeNext(params.get('next'), isStaff(user) ? '/admin' : '/dashboard')} replace />;
  return (
    <AuthShell title="Welcome back" subtitle="Log in to your Promora account." footer={<>New to Promora? <Link className="link" to="/register">Create an account</Link></>}>
      <form className="space-y-5" noValidate onSubmit={handleSubmit(async (v) => {
        try { const u = await login(v.email, v.password); navigate(safeNext(params.get('next'), isStaff(u) ? '/admin' : '/dashboard'), { replace: true }); }
        catch (e: any) { setError('root', { message: e.message }); }
      })}>
        <Input label="Email" type="email" autoComplete="email" required error={errors.email?.message} {...register('email')} />
        <Input label="Password" type="password" autoComplete="current-password" required error={errors.password?.message} {...register('password')} />
        {errors.root && <Alert tone="danger">{errors.root.message}</Alert>}
        <div className="flex items-center justify-end"><Link className="link text-sm" to="/forgot-password">Forgot password?</Link></div>
        <Button type="submit" className="w-full" loading={isSubmitting}>Log in</Button>
      </form>
    </AuthShell>
  );
}

const registerSchema = z.object({
  fullName: z.string().trim().min(2, 'Enter your full name').max(120), email: z.string().trim().email('Enter a valid email'), password: passwordRule,
  referralCode: z.string().trim().max(16).optional(),
  acceptTerms: z.literal(true, { errorMap: () => ({ message: 'You must accept the Terms and Privacy Policy' }) }), marketingConsent: z.boolean().optional(),
});
export function Register() {
  useSeo('Create your account', 'Join Promora free. Promote your business or earn by promoting campaigns.');
  const { user, register: signUp } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const started = useRef(false);
  const as = params.get('as');
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema), defaultValues: { referralCode: params.get('ref') || getReferralCode() || '', marketingConsent: false },
  });
  if (user && !isSubmitting) return <Navigate to="/dashboard" replace />;
  const after = as === 'advertiser' ? '/dashboard/settings?tab=business&welcome=1' : as === 'promoter' ? '/dashboard/settings?tab=promoter&welcome=1' : '/dashboard?welcome=1';
  return (
    <AuthShell title="Create your account" subtitle="Free to join. One account lets you advertise and promote." footer={<>Already have an account? <Link className="link" to="/login">Log in</Link></>}>
      <form className="space-y-5" noValidate onFocus={() => { if (!started.current) { started.current = true; track('signup_started', { as: as || 'unspecified' }); } }}
        onSubmit={handleSubmit(async (v) => {
          try { await signUp({ ...v, ...getUtm() }); navigate(safeNext(params.get('next'), after), { replace: true }); }
          catch (e: any) {
            if (e instanceof ApiError && e.errors?.length) e.errors.forEach((x) => setError(x.field as any, { message: x.message }));
            else setError(e.code === 'EMAIL_TAKEN' ? 'email' : 'root', { message: e.message });
          }
        })}>
        <Input label="Full name" autoComplete="name" required error={errors.fullName?.message} {...register('fullName')} />
        <Input label="Email" type="email" autoComplete="email" required error={errors.email?.message} {...register('email')} />
        <Input label="Password" type="password" autoComplete="new-password" required hint="At least 8 characters with a letter and a number." error={errors.password?.message} {...register('password')} />
        <Input label="Referral code (optional)" autoCapitalize="characters" error={errors.referralCode?.message} {...register('referralCode')} />
        <div className="space-y-3">
          <label className="flex gap-2.5 text-sm text-ink-700"><input type="checkbox" className="mt-1 h-4 w-4 rounded border-ink-300" {...register('acceptTerms')} /><span>I am 18 or older and agree to the <Link className="link" to="/terms" target="_blank">Terms of Service</Link> and <Link className="link" to="/privacy-policy" target="_blank">Privacy Policy</Link>.</span></label>
          {errors.acceptTerms && <p className="text-sm text-danger-600" role="alert">{errors.acceptTerms.message}</p>}
          <label className="flex gap-2.5 text-sm text-ink-700"><input type="checkbox" className="mt-1 h-4 w-4 rounded border-ink-300" {...register('marketingConsent')} /><span>Send me product updates and tips by email. Optional.</span></label>
        </div>
        {errors.root && <Alert tone="danger">{errors.root.message}</Alert>}
        <Button type="submit" className="w-full" loading={isSubmitting}>Create account</Button>
      </form>
    </AuthShell>
  );
}

export function VerifyEmail() {
  useSeo('Verify your email', undefined, { noindex: true });
  const [params] = useSearchParams();
  const { user, reload } = useAuth();
  const [state, setState] = useState<'working' | 'done' | 'error'>('working');
  const [message, setMessage] = useState('');
  const ran = useRef(false);
  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const token = params.get('token');
    if (!token) { setState('error'); setMessage('This verification link is incomplete.'); return; }
    api('/auth/verify-email', { method: 'POST', body: { token } })
      .then(async () => { setState('done'); try { await reload(); } catch { /* not signed in on this device */ } })
      .catch((e) => { setState('error'); setMessage(e.message); });
  }, [params, reload]);
  return (
    <AuthShell title="Email verification">
      {state === 'working' ? <Spinner label="Verifying" /> : state === 'done'
        ? <><Alert tone="success" title="Your email is verified">You can now submit campaigns, apply to campaigns and request payouts.</Alert><Link to={user ? '/dashboard' : '/login'} className="link mt-6 inline-block">{user ? 'Go to your dashboard' : 'Log in'}</Link></>
        : <><Alert tone="danger" title="We could not verify this link">{message}</Alert><p className="mt-6 text-sm text-ink-600">Log in and use "Resend email" on your dashboard to get a new link.</p><Link to="/login" className="link mt-2 inline-block">Log in</Link></>}
    </AuthShell>
  );
}

const emailSchema = z.object({ email: z.string().trim().email('Enter a valid email') });
export function ForgotPassword() {
  useSeo('Reset your password', undefined, { noindex: true });
  const [result, setResult] = useState<{ message: string; devResetToken?: string } | null>(null);
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<z.infer<typeof emailSchema>>({ resolver: zodResolver(emailSchema) });
  return (
    <AuthShell title="Forgot your password?" subtitle="Enter your email and we will send a reset link." footer={<Link className="link" to="/login">Back to log in</Link>}>
      {result ? <Alert tone="success" title="Check your inbox">{result.message}{result.devResetToken && <span className="mt-1 block">Development mode: <Link className="link" to={`/reset-password?token=${result.devResetToken}`}>open the reset link</Link> (no mail server is configured).</span>}</Alert> : (
        <form className="space-y-5" noValidate onSubmit={handleSubmit(async (v) => { try { setResult(await api('/auth/forgot-password', { method: 'POST', body: v })); } catch (e: any) { setError('root', { message: e.message }); } })}>
          <Input label="Email" type="email" autoComplete="email" required error={errors.email?.message} {...register('email')} />
          {errors.root && <Alert tone="danger">{errors.root.message}</Alert>}
          <Button type="submit" className="w-full" loading={isSubmitting}>Send reset link</Button>
        </form>
      )}
    </AuthShell>
  );
}

const resetSchema = z.object({ password: passwordRule, confirm: z.string() }).refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Passwords do not match' });
export function ResetPassword() {
  useSeo('Choose a new password', undefined, { noindex: true });
  const [params] = useSearchParams();
  const [done, setDone] = useState(false);
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<z.infer<typeof resetSchema>>({ resolver: zodResolver(resetSchema) });
  const token = params.get('token');
  return (
    <AuthShell title="Choose a new password">
      {!token ? <Alert tone="danger">This reset link is incomplete. Request a new one.</Alert> : done
        ? <><Alert tone="success" title="Password updated">You have been signed out everywhere. Log in with your new password.</Alert><Link to="/login" className="link mt-6 inline-block">Log in</Link></> : (
        <form className="space-y-5" noValidate onSubmit={handleSubmit(async (v) => { try { await api('/auth/reset-password', { method: 'POST', body: { token, password: v.password } }); setDone(true); } catch (e: any) { setError('root', { message: e.message }); } })}>
          <Input label="New password" type="password" autoComplete="new-password" required error={errors.password?.message} {...register('password')} />
          <Input label="Confirm new password" type="password" autoComplete="new-password" required error={errors.confirm?.message} {...register('confirm')} />
          {errors.root && <Alert tone="danger">{errors.root.message}</Alert>}
          <Button type="submit" className="w-full" loading={isSubmitting}>Update password</Button>
        </form>
      )}
    </AuthShell>
  );
}
