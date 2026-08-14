import type { APIRoute } from 'astro';

/**
 * robots.txt is generated so the sitemap URL always matches the deploy origin.
 * Note: robots.txt is not a reliable way to keep a URL out of the index —
 * private surfaces additionally carry <meta name="robots" content="noindex">.
 */
export const GET: APIRoute = ({ site }) => {
  const origin = site?.toString().replace(/\/$/, '') ?? '';
  const body = `User-agent: *
Allow: /

# Служебные разделы
Disallow: /review/
Disallow: /spasibo/
Disallow: /admin/

Sitemap: ${origin}/sitemap-index.xml
`;
  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
