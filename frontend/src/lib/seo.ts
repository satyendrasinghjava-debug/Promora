import { useEffect } from 'react';

function setMeta(selector: string, attr: string, key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) { el = document.createElement('meta'); el.setAttribute(attr, key); document.head.appendChild(el); }
  el.setAttribute('content', content);
}

/** Sets the page title, description, canonical URL and Open Graph tags for the current route. */
export function useSeo(title: string, description?: string, opts: { noindex?: boolean } = {}) {
  useEffect(() => {
    const full = title.includes('Promora') ? title : `${title} | Promora`;
    document.title = full;
    setMeta('meta[property="og:title"]', 'property', 'og:title', full);
    if (description) {
      setMeta('meta[name="description"]', 'name', 'description', description);
      setMeta('meta[property="og:description"]', 'property', 'og:description', description);
    }
    setMeta('meta[name="robots"]', 'name', 'robots', opts.noindex ? 'noindex, nofollow' : 'index, follow');
    let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) { link = document.createElement('link'); link.rel = 'canonical'; document.head.appendChild(link); }
    link.href = window.location.origin + window.location.pathname;
  }, [title, description, opts.noindex]);
}
