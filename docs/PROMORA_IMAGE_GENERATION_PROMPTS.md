# Promora image-generation prompts

**Status.** No AI image generator was available in the build environment, so **no raster image has been generated**.
What ships instead are original vector (SVG) assets, written by `scripts/generate-assets.mjs` and listed in
`frontend/public/assets/asset-manifest.json`. They are real, finished assets, not placeholders, but they are flat vector
artwork rather than the "3D editorial" renders described below.

**To upgrade to generated artwork:** generate the image with the prompt, export it in the stated format, and save it
at the same path and file name as the current asset (keep the name, change only the extension if you also update the
one reference noted in the table). No other application code changes are needed.

| Asset | Current file (in `frontend/public/assets/`) | Used in | Target format |
|---|---|---|---|
| A. Primary logo, horizontal (dark text) | `brand/logo-horizontal.svg` | Header, auth pages | SVG |
| A. Logo for dark backgrounds | `brand/logo-horizontal-white.svg` | Footer, admin sidebar | SVG |
| A. Monochrome logo | `brand/logo-mono.svg` | Print, invoices | SVG |
| A/B. Standalone brand icon | `brand/logo-icon.svg` | App icon | SVG |
| A. Favicon | `brand/favicon.svg` | `index.html` | SVG |
| Open Graph default | `brand/og-default.svg` | Link previews (`index.html`, `SeoController`) | PNG 1200x630 recommended: some platforms do not render SVG previews |
| C. Homepage hero | `hero/hero-main.svg` | `pages/public/Home.tsx` | WebP or AVIF, 1600x900 |
| D. Advertiser illustration | `illustrations/advertiser.svg` | Home, How it works | WebP or SVG |
| E. Creator illustration | `illustrations/creator.svg` | Home, How it works | WebP or SVG |
| F. Marketplace illustration | `illustrations/marketplace.svg` | Auth side panel | WebP or SVG |
| G. Empty states (7) | `illustrations/empty-{campaigns,promotions,notifications,transactions,referrals,search,analytics}.svg` | `EmptyState` component | SVG |
| Category artwork (9) | `categories/{slug}.svg` | Category pages, default campaign image | WebP or SVG |
| H. Social templates (6) | `social/*.svg` | Not bundled in pages; open in a vector editor, edit the text, export PNG | PNG 1080x1350 |

## A. Primary Promora logo

> Design a premium minimalist technology company logo for a global SaaS platform named PROMORA. Create a distinctive abstract symbol combining the concepts of upward growth, promotion, connectivity, reach and discovery. The icon should feel modern, memorable, geometric and suitable for a billion-dollar technology company. Use a sophisticated electric violet and deep navy colour palette. Create a clean vector-style logo on a transparent background. Include a refined wordmark reading PROMORA with carefully balanced typography. No mockups, no 3D rendering, no unnecessary decorations, no watermark.

Generate: full horizontal logo, standalone brand icon, white logo for dark backgrounds, dark logo for light backgrounds, monochrome version, favicon.

## B. Brand icon

> Create an original geometric app icon for PROMORA, a universal digital promotion marketplace. The symbol should communicate growth, discovery, connection and visibility. Use a distinctive abstract upward movement motif integrated with a connected network concept. Minimalist, recognisable at 32x32 pixels, balanced geometry, electric violet and deep navy, professional SaaS branding, transparent background, no text, no watermark.

## C. Homepage hero illustration

> Create a premium modern 3D editorial illustration for a global SaaS promotion marketplace. Show a central digital growth hub connecting businesses, creators, online stores, mobile applications, marketing campaigns and audiences through elegant flowing connection paths. Include floating abstract campaign cards, analytics visualisations, creator profile elements and upward growth indicators. Sophisticated violet, blue and white palette, soft studio lighting, high-end product illustration, clean composition with ample negative space on the left for website headline text. No readable text, no logos, no watermark. Wide 16:9 composition.

## D. Advertiser illustration

> Premium SaaS editorial illustration showing a small business owner creating a marketing campaign using a modern laptop, with campaign analytics, audience reach and growth indicators floating around the workspace. Modern minimal 3D illustration, sophisticated violet and blue palette, white background, professional commercial design.

## E. Creator illustration

> Premium editorial 3D illustration showing a digital content creator collaborating with businesses and discovering paid promotional opportunities. Include a smartphone, creator profile cards, content analytics and subtle reward indicators. Sophisticated violet, blue and white palette. Modern global SaaS brand aesthetic.

## F. Campaign marketplace illustration

> Create a premium visual illustration of a digital marketplace displaying multiple promotional opportunities across business categories. Floating campaign cards, product discovery, creator collaborations and connection lines. Modern 3D editorial SaaS aesthetic, clean white background, electric violet and blue accents.

## G. Empty-state illustrations

Separate simple illustrations for: no campaigns found, no active promotions, no notifications, no transactions, no referrals, no search results, no analytics available. Minimal, consistent vector illustrations.

> Minimal flat vector spot illustration for an empty state in a SaaS dashboard: [subject]. Single soft lavender circle background, electric violet line icon, two or three small accent dots, generous white space, no text, no watermark.

## H. Social media creatives

Templates for: Promora launch announcement, advertiser acquisition, creator recruitment, business promotion, referral programme, product feature announcements.

> Editable social media template, 1080x1350, for PROMORA, a promotion marketplace. Deep navy or soft lavender background with large soft violet and blue circles, Promora logo top left, short uppercase kicker, three-line bold headline, one supporting line, violet pill call-to-action button. Clean, premium SaaS aesthetic. Keep text as live, editable layers. No stock photos, no watermark.

## Rules for any generated asset

- Original work only: no third-party logos, no watermarks, no real people's likenesses.
- Check the generator's licence allows commercial use; record the tool and prompt in the asset manifest.
- Keep hero images under about 250 KB; provide width and height; write meaningful alt text.
- The logo should be finalised as vector by a designer before trademark use.
