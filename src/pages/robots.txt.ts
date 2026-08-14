import type { APIRoute } from 'astro';
import { isTemporaryOrigin } from '~/lib/origin';

/**
 * robots.txt is generated so the sitemap URL always matches the deploy origin.
 * Note: robots.txt is not a reliable way to keep a URL out of the index —
 * private surfaces additionally carry <meta name="robots" content="noindex">.
 */
export const GET: APIRoute = ({ site }) => {
  const origin = site?.toString().replace(/\/$/, '') ?? '';

  // На временном адресе закрываем всё и карту сайта не публикуем: незачем
  // приглашать поисковик туда, откуда сайт скоро уедет.
  const body = isTemporaryOrigin(site)
    ? `# Временный адрес: сайт ещё не на своём домене.
User-agent: *
Disallow: /
`
    : `User-agent: *
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
