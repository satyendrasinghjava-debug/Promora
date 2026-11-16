import { useState, type ReactNode } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { api, qs, type Page } from '../lib/api';
import { Card, DataTable, EmptyState, ErrorState, Pagination, Spinner, type Column } from './ui';

export interface Filter { name: string; label: string; options: { value: string; label: string }[] }

/** A paged, filterable, searchable list bound to one API endpoint. Used across dashboards and the admin application. */
export function ResourceTable<T extends Record<string, any>>({ queryKey, url, columns, filters = [], searchable, searchPlaceholder = 'Search', empty, onRowClick, initial = {}, title, actions, size = 20 }: {
  queryKey: string; url: string; columns: Column<T>[]; filters?: Filter[]; searchable?: boolean; searchPlaceholder?: string;
  empty: { kind: Parameters<typeof EmptyState>[0]['kind']; title: string; text?: string; action?: ReactNode };
  onRowClick?: (row: T) => void; initial?: Record<string, string>; title?: string; actions?: ReactNode; size?: number;
}) {
  const [page, setPage] = useState(0);
  const [values, setValues] = useState<Record<string, string>>(initial);
  const [q, setQ] = useState('');
  const [typed, setTyped] = useState('');
  const query = useQuery({
    queryKey: [queryKey, url, page, values, q],
    queryFn: () => api<Page<T>>(url + qs({ ...values, q: q || undefined, page, size })),
    placeholderData: keepPreviousData,
  });
  const set = (name: string, value: string) => { setValues((v) => ({ ...v, [name]: value })); setPage(0); };
  return (
    <Card title={title} actions={actions} padded={false}>
      {(filters.length > 0 || searchable) && (
        <div className="flex flex-col gap-3 border-b border-ink-200 p-4 sm:flex-row sm:items-end">
          {searchable && (
            <form className="relative flex-1" onSubmit={(e) => { e.preventDefault(); setQ(typed.trim()); setPage(0); }} role="search">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" aria-hidden />
              <input className="input pl-9" placeholder={searchPlaceholder} aria-label={searchPlaceholder} value={typed} onChange={(e) => setTyped(e.target.value)} />
            </form>
          )}
          {filters.map((f) => (
            <label key={f.name} className="block sm:w-48">
              <span className="sr-only">{f.label}</span>
              <select className="input" aria-label={f.label} value={values[f.name] || ''} onChange={(e) => set(f.name, e.target.value)}>
                <option value="">{f.label}: all</option>
                {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
          ))}
        </div>
      )}
      {query.isLoading ? <Spinner /> : query.isError ? <div className="p-6"><ErrorState error={query.error} onRetry={() => query.refetch()} /></div>
        : query.data!.items.length === 0 ? <EmptyState {...empty} />
        : <DataTable columns={columns} rows={query.data!.items} rowKey={(r) => String(r.id ?? JSON.stringify(r))} onRowClick={onRowClick} />}
      {query.data && <Pagination page={query.data.page} totalPages={query.data.totalPages} total={query.data.total} onPage={setPage} />}
    </Card>
  );
}
