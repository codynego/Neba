# Neba search setup

## What is implemented

The public homepage, local-help guide and information pages are server-rendered and have individual titles, descriptions, canonical URLs and social preview metadata. The English content is marked `en-NG`. The generated social image describes local help and paid tasks in Nigeria. The homepage contains matching Organization and WebSite JSON-LD; the guide has breadcrumb structured data. No fake address, ratings, availability, review count or LocalBusiness location is declared.

The homepage and footer link to `/local-help`, a useful guide to categories, choosing a city/neighborhood, writing a task, rewards, skill offers, verification and private coordination. City names are examples rather than claims of active coverage. City-specific landing pages should be added only after confirming launch locations and providing useful, distinct local content.

`/sitemap.xml` lists only the seven public informational URLs. `/robots.txt` points to that sitemap in production. Dashboard, messages, profiles, task/offer listings, authentication, verification and safety routes carry `noindex, nofollow` metadata and HTTP headers. These routes are not in the sitemap. Authentication and participant access controls remain in place; robots directives are not security controls. Private routes are crawlable so crawlers can read their noindex directives.

## Domain and environments

The requested canonical origin defaults to `https://neba.com`. `NEXT_PUBLIC_SITE_URL` can change it and must be an HTTPS origin without a path. This configures links and metadata; it does not register the domain, prove ownership, connect DNS or publish the app.

Production builds enable indexing on public pages by default. Development and Vercel preview builds use noindex, a disallow-all robots file and an empty sitemap. Set `SEO_INDEXABLE=false` before building any other publicly hosted staging environment. Rebuild after changing the canonical domain, verification token or indexing configuration; metadata routes are generated at build time.

Use `frontend/.env.example` as the deployment configuration reference. Set `GOOGLE_SITE_VERIFICATION` only if using the Search Console HTML-tag method; a domain property instead uses DNS verification.

## Remaining launch work

1. Verify ownership and deploy the application on the intended HTTPS domain. Redirect alternate hosts to the chosen canonical host using the hosting platform.
2. Verify the property in Google Search Console, inspect the homepage and guide, and submit `https://neba.com/sitemap.xml` after deployment. Test structured data on the live URLs.
3. Confirm the first launch cities before adding genuinely useful city-specific content. Avoid duplicate city pages made only by swapping place names.
4. Measure the deployed mobile experience with PageSpeed Insights and Search Console. Current code keeps public content server-rendered and the hero image optimized, but no live Core Web Vitals or ranking result is claimed.
5. Publish accurate pilot/availability information and grow real local participation and mentions. SEO foundations support discovery; they do not guarantee rankings or a Google Maps listing.

References: [Google Search Essentials](https://developers.google.com/search/docs/essentials), [Organization markup](https://developers.google.com/search/docs/appearance/structured-data/organization), [noindex](https://developers.google.com/search/docs/crawling-indexing/block-indexing), [sitemap guidance](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap), [doorway abuse](https://developers.google.com/search/docs/essentials/spam-policies#doorway-abuse).
