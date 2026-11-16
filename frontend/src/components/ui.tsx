import { createContext, forwardRef, useCallback, useContext, useEffect, useId, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, Info, Loader2, X, BadgeCheck } from 'lucide-react';
import { titleCase } from '../lib/format';

export const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ');

// ---------------------------------------------------------------- Button
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'white';
const variants: Record<Variant, string> = {
  primary: 'bg-brand-500 text-white shadow-sm hover:bg-brand-600 active:bg-brand-700',
  secondary: 'border border-ink-300 bg-white text-ink-800 hover:border-ink-400 hover:bg-ink-50',
  ghost: 'text-ink-700 hover:bg-ink-100',
  danger: 'bg-danger-600 text-white hover:bg-danger-700',
  white: 'bg-white text-ink-900 hover:bg-ink-100',
};
const sizes = { sm: 'h-9 px-3 text-sm', md: 'h-11 px-4 text-[15px]', lg: 'h-12 px-6 text-base' };
export const buttonClass = (variant: Variant = 'primary', size: keyof typeof sizes = 'md', extra = '') =>
  cx('inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl font-semibold transition disabled:cursor-not-allowed disabled:opacity-55', variants[variant], sizes[size], extra);

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> { variant?: Variant; size?: keyof typeof sizes; loading?: boolean }
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({ variant = 'primary', size = 'md', loading, className, children, disabled, type = 'button', ...rest }, ref) => (
  <button ref={ref} type={type} className={buttonClass(variant, size, className)} disabled={disabled || loading} {...rest}>
    {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
    {children}
  </button>
));
Button.displayName = 'Button';

export function LinkButton({ to, variant = 'primary', size = 'md', className, children }: { to: string; variant?: Variant; size?: keyof typeof sizes; className?: string; children: ReactNode }) {
  return <Link to={to} className={buttonClass(variant, size, className)}>{children}</Link>;
}

// ---------------------------------------------------------------- Form fields
export function Field({ label, error, hint, children, htmlFor, required }: { label: string; error?: string; hint?: string; children: ReactNode; htmlFor?: string; required?: boolean }) {
  return (
    <div>
      <label className="label" htmlFor={htmlFor}>{label}{required && <span className="text-danger-600"> *</span>}</label>
      {children}
      {error ? <p className="mt-1.5 flex items-center gap-1 text-sm text-danger-600" role="alert"><AlertCircle className="h-3.5 w-3.5" aria-hidden />{error}</p>
        : hint ? <p className="mt-1.5 text-sm text-ink-500">{hint}</p> : null}
    </div>
  );
}
interface InputProps extends InputHTMLAttributes<HTMLInputElement> { label: string; error?: string; hint?: string }
export const Input = forwardRef<HTMLInputElement, InputProps>(({ label, error, hint, id, required, className, ...rest }, ref) => {
  const auto = useId();
  const fid = id || auto;
  return <Field label={label} error={error} hint={hint} htmlFor={fid} required={required}><input ref={ref} id={fid} aria-invalid={!!error} className={cx('input', error && 'border-danger-600', className)} {...rest} /></Field>;
});
Input.displayName = 'Input';
interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> { label: string; error?: string; hint?: string }
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(({ label, error, hint, id, required, rows = 4, ...rest }, ref) => {
  const auto = useId();
  const fid = id || auto;
  return <Field label={label} error={error} hint={hint} htmlFor={fid} required={required}><textarea ref={ref} id={fid} rows={rows} aria-invalid={!!error} className={cx('input', error && 'border-danger-600')} {...rest} /></Field>;
});
Textarea.displayName = 'Textarea';
interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> { label: string; error?: string; hint?: string }
export const Select = forwardRef<HTMLSelectElement, SelectProps>(({ label, error, hint, id, required, children, ...rest }, ref) => {
  const auto = useId();
  const fid = id || auto;
  return <Field label={label} error={error} hint={hint} htmlFor={fid} required={required}><select ref={ref} id={fid} className={cx('input pr-8', error && 'border-danger-600')} {...rest}>{children}</select></Field>;
});
Select.displayName = 'Select';

// ---------------------------------------------------------------- Feedback
const tones = {
  info: ['border-sky-500/30 bg-blue-50 text-ink-800', Info], success: ['border-success-600/30 bg-success-50 text-success-700', CheckCircle2],
  warning: ['border-warning-600/30 bg-warning-50 text-warning-700', AlertCircle], danger: ['border-danger-600/30 bg-danger-50 text-danger-700', AlertCircle],
} as const;
export function Alert({ tone = 'info', title, children, action }: { tone?: keyof typeof tones; title?: string; children?: ReactNode; action?: ReactNode }) {
  const [cls, Icon] = tones[tone];
  return (
    <div className={cx('flex items-start gap-3 rounded-xl border px-4 py-3 text-sm', cls)} role={tone === 'danger' ? 'alert' : 'status'}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">{title && <p className="font-semibold">{title}</p>}{children && <div className={cx(title && 'mt-0.5')}>{children}</div>}</div>
      {action}
    </div>
  );
}
export function Spinner({ label = 'Loading' }: { label?: string }) {
  return <div className="flex items-center justify-center gap-2 py-16 text-ink-500" role="status"><Loader2 className="h-5 w-5 animate-spin" aria-hidden /><span>{label}…</span></div>;
}
export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof Error ? error.message : 'Something went wrong.';
  return (
    <div className="card mx-auto max-w-lg p-8 text-center">
      <AlertCircle className="mx-auto h-8 w-8 text-danger-600" aria-hidden />
      <h3 className="mt-3 text-lg font-semibold">We could not load this</h3>
      <p className="mt-1 text-ink-600">{message}</p>
      {onRetry && <Button className="mt-5" variant="secondary" onClick={onRetry}>Try again</Button>}
    </div>
  );
}
type EmptyKind = 'campaigns' | 'promotions' | 'notifications' | 'transactions' | 'referrals' | 'search' | 'analytics';
export function EmptyState({ kind, title, text, action }: { kind: EmptyKind; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <img src={`/assets/illustrations/empty-${kind}.svg`} alt="" width={200} height={150} loading="lazy" className="h-36 w-auto" />
      <h3 className="mt-4 text-lg font-semibold">{title}</h3>
      {text && <p className="mt-1 max-w-md text-ink-600">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

// ---------------------------------------------------------------- Badges
const statusTone: Record<string, string> = {
  ACTIVE: 'bg-success-50 text-success-700', APPROVED: 'bg-success-50 text-success-700', PAID: 'bg-success-50 text-success-700', VERIFIED: 'bg-success-50 text-success-700',
  ACTIVATED: 'bg-success-50 text-success-700', RESOLVED: 'bg-success-50 text-success-700', COMPLETED: 'bg-blue-50 text-sky-600',
  PENDING: 'bg-warning-50 text-warning-700', PENDING_REVIEW: 'bg-warning-50 text-warning-700', PENDING_APPROVAL: 'bg-warning-50 text-warning-700', REQUESTED: 'bg-warning-50 text-warning-700',
  CHANGES_REQUESTED: 'bg-warning-50 text-warning-700', PAUSED: 'bg-warning-50 text-warning-700', OPEN: 'bg-warning-50 text-warning-700', INVESTIGATING: 'bg-blue-50 text-sky-600',
  CREATED: 'bg-ink-100 text-ink-600', DRAFT: 'bg-ink-100 text-ink-600', NONE: 'bg-ink-100 text-ink-600', WITHDRAWN: 'bg-ink-100 text-ink-600', DISMISSED: 'bg-ink-100 text-ink-600', CANCELLED: 'bg-ink-100 text-ink-600',
  REJECTED: 'bg-danger-50 text-danger-700', TERMINATED: 'bg-danger-50 text-danger-700', SUSPENDED: 'bg-danger-50 text-danger-700', FAILED: 'bg-danger-50 text-danger-700',
  REVERSED: 'bg-danger-50 text-danger-700', REMOVED: 'bg-danger-50 text-danger-700', REFUNDED: 'bg-blue-50 text-sky-600', HIGH: 'bg-danger-50 text-danger-700', MEDIUM: 'bg-warning-50 text-warning-700', LOW: 'bg-ink-100 text-ink-600',
};
export function StatusBadge({ status }: { status?: string | null }) {
  if (!status) return null;
  return <span className={cx('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold', statusTone[status] || 'bg-ink-100 text-ink-600')}>{titleCase(status)}</span>;
}
export function Badge({ children, tone = 'brand' }: { children: ReactNode; tone?: 'brand' | 'neutral' | 'dark' }) {
  const c = { brand: 'bg-brand-100 text-brand-700', neutral: 'bg-ink-100 text-ink-700', dark: 'bg-ink-900 text-white' }[tone];
  return <span className={cx('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold', c)}>{children}</span>;
}
export function VerifiedMark({ status }: { status?: string }) {
  return status === 'VERIFIED' ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-sky-600" title="Verified by Promora"><BadgeCheck className="h-4 w-4" aria-hidden />Verified</span> : null;
}

// ---------------------------------------------------------------- Layout pieces
export function PageHeader({ title, description, actions, back }: { title: string; description?: ReactNode; actions?: ReactNode; back?: { to: string; label: string } }) {
  return (
    <div className="mb-6">
      {back && <Link to={back.to} className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-ink-500 hover:text-ink-800"><ChevronLeft className="h-4 w-4" aria-hidden />{back.label}</Link>}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0"><h1 className="text-2xl font-bold sm:text-[28px]">{title}</h1>{description && <p className="mt-1 text-ink-600">{description}</p>}</div>
        {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}
export function Card({ title, description, actions, children, className, padded = true }: { title?: string; description?: string; actions?: ReactNode; children: ReactNode; className?: string; padded?: boolean }) {
  return (
    <section className={cx('card', className)}>
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-200 px-5 py-4">
          <div><h2 className="text-base font-semibold">{title}</h2>{description && <p className="mt-0.5 text-sm text-ink-500">{description}</p>}</div>
          {actions}
        </div>
      )}
      <div className={cx(padded && 'p-5')}>{children}</div>
    </section>
  );
}
export function StatCard({ label, value, hint, icon }: { label: string; value: ReactNode; hint?: string; icon?: ReactNode }) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-ink-500">{label}</p>
        {icon && <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-100 text-brand-600">{icon}</span>}
      </div>
      <p className="num mt-2 font-display text-2xl font-bold text-ink-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-500">{hint}</p>}
    </div>
  );
}
export function Tabs({ tabs, value, onChange }: { tabs: { id: string; label: string; count?: number }[]; value: string; onChange: (id: string) => void }) {
  return (
    <div className="mb-5 flex gap-1 overflow-x-auto border-b border-ink-200" role="tablist">
      {tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={value === t.id} onClick={() => onChange(t.id)}
          className={cx('-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-semibold transition', value === t.id ? 'border-brand-500 text-brand-600' : 'border-transparent text-ink-500 hover:text-ink-800')}>
          {t.label}{t.count !== undefined && t.count > 0 && <span className="ml-2 rounded-full bg-brand-100 px-2 py-0.5 text-xs text-brand-700">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}
export function Pagination({ page, totalPages, total, onPage }: { page: number; totalPages: number; total: number; onPage: (p: number) => void }) {
  if (totalPages <= 1) return total > 0 ? <p className="px-5 py-3 text-sm text-ink-500">{total} {total === 1 ? 'result' : 'results'}</p> : null;
  return (
    <div className="flex items-center justify-between gap-3 px-5 py-3 text-sm text-ink-600">
      <span>Page {page + 1} of {totalPages} · {total} results</span>
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" disabled={page === 0} onClick={() => onPage(page - 1)} aria-label="Previous page"><ChevronLeft className="h-4 w-4" aria-hidden />Prev</Button>
        <Button size="sm" variant="secondary" disabled={page >= totalPages - 1} onClick={() => onPage(page + 1)} aria-label="Next page">Next<ChevronRight className="h-4 w-4" aria-hidden /></Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Modal and confirmation
export function Modal({ open, title, onClose, children, footer, wide }: { open: boolean; title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink-900/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={cx('flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-white shadow-pop sm:rounded-2xl', wide ? 'sm:max-w-3xl' : 'sm:max-w-lg')}>
        <div className="flex items-center justify-between border-b border-ink-200 px-5 py-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-ink-500 hover:bg-ink-100" aria-label="Close"><X className="h-5 w-5" /></button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-ink-200 px-5 py-4">{footer}</div>}
      </div>
    </div>
  );
}
/** Confirmation dialog for sensitive actions. Collects a reason when one is required by the API. */
export function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', danger, reason, onConfirm, onClose, busy, error }: {
  open: boolean; title: string; message: ReactNode; confirmLabel?: string; danger?: boolean; reason?: 'required' | 'optional';
  onConfirm: (reason: string) => void; onClose: () => void; busy?: boolean; error?: string | null;
}) {
  const [text, setText] = useState('');
  useEffect(() => { if (open) setText(''); }, [open]);
  return (
    <Modal open={open} title={title} onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant={danger ? 'danger' : 'primary'} loading={busy} disabled={reason === 'required' && !text.trim()} onClick={() => onConfirm(text.trim())}>{confirmLabel}</Button></>}>
      <div className="space-y-4 text-ink-700">
        <div>{message}</div>
        {reason && <Textarea label={reason === 'required' ? 'Reason (required)' : 'Note (optional)'} value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={500} />}
        {error && <Alert tone="danger">{error}</Alert>}
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- Toasts
interface Toast { id: number; tone: 'success' | 'danger' | 'info'; text: string }
const ToastCtx = createContext<(text: string, tone?: Toast['tone']) => void>(() => undefined);
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((text: string, tone: Toast['tone'] = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, tone, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={cx('pointer-events-auto flex max-w-md items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-pop', t.tone === 'danger' ? 'bg-danger-600' : 'bg-ink-900')}>
            {t.tone === 'danger' ? <AlertCircle className="h-4 w-4" aria-hidden /> : <CheckCircle2 className="h-4 w-4 text-emerald-400" aria-hidden />}{t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

// ---------------------------------------------------------------- Table
export interface Column<T> { header: string; cell: (row: T) => ReactNode; className?: string; primary?: boolean }
/** Table on wide screens; stacked cards with labelled values on phones. */
export function DataTable<T>({ columns, rows, rowKey, onRowClick }: { columns: Column<T>[]; rows: T[]; rowKey: (row: T) => string; onRowClick?: (row: T) => void }) {
  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-left text-sm">
          <thead><tr className="border-b border-ink-200 bg-ink-50 text-xs uppercase tracking-wide text-ink-500">{columns.map((c) => <th key={c.header} scope="col" className={cx('px-5 py-3 font-semibold', c.className)}>{c.header}</th>)}</tr></thead>
          <tbody className="divide-y divide-ink-100">
            {rows.map((r) => (
              <tr key={rowKey(r)} className={cx('align-top', onRowClick && 'cursor-pointer hover:bg-brand-50/60')} onClick={onRowClick ? () => onRowClick(r) : undefined}>
                {columns.map((c) => <td key={c.header} className={cx('px-5 py-3.5', c.className)}>{c.cell(r)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="divide-y divide-ink-100 md:hidden">
        {rows.map((r) => (
          <li key={rowKey(r)} className={cx('space-y-2 px-4 py-4', onRowClick && 'cursor-pointer active:bg-brand-50')} onClick={onRowClick ? () => onRowClick(r) : undefined}>
            {columns.map((c) => c.primary
              ? <div key={c.header} className="font-semibold text-ink-900">{c.cell(r)}</div>
              : <div key={c.header} className="flex items-start justify-between gap-4 text-sm"><span className="shrink-0 text-ink-500">{c.header}</span><span className="min-w-0 text-right">{c.cell(r)}</span></div>)}
          </li>
        ))}
      </ul>
    </>
  );
}
