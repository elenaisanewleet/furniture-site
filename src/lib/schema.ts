import { site, publicContacts } from '~/data/site';
import { isPublic } from '~/lib/facts';

/**
 * schema.org builders.
 *
 * Rule: a field is emitted only when the underlying value is confirmed.
 * We would rather ship a small, true LocalBusiness node than a rich one
 * containing an address that has not been cleared for publication.
 */

const ORG_ID = '#org';

export function orgId(origin: string) {
  return new URL(ORG_ID, origin).toString();
}

export function localBusiness(origin: string) {
  const node: Record<string, unknown> = {
    '@type': ['LocalBusiness', 'HomeAndConstructionBusiness'],
    '@id': orgId(origin),
    name: site.brand.name,
    description: site.positioning,
    url: origin,
  };

  const phones = publicContacts.map((c) => c.phone).filter(Boolean);
  if (phones.length) node.telephone = phones[0];

  // Address: only if the master has cleared it for publication.
  if (isPublic(site.address.status) && site.address.streetAddress) {
    node.address = {
      '@type': 'PostalAddress',
      streetAddress: site.address.streetAddress,
      addressLocality: site.address.locality,
      addressRegion: site.region,
      addressCountry: 'RU',
    };
  } else {
    // Region alone is safe and still geo-qualifies the business.
    node.address = {
      '@type': 'PostalAddress',
      addressRegion: site.region,
      addressCountry: 'RU',
    };
  }

  const areas = site.serviceAreas.filter((a) => isPublic(a.status));
  if (areas.length) {
    node.areaServed = areas.map((a) => ({ '@type': 'Place', name: a.name }));
  }

  if (site.openingHours) node.openingHoursSpecification = site.openingHours;

  return node;
}

export function webSite(origin: string) {
  return {
    '@type': 'WebSite',
    '@id': new URL('#website', origin).toString(),
    url: origin,
    name: site.brand.name,
    inLanguage: 'ru-RU',
    publisher: { '@id': orgId(origin) },
  };
}

export function breadcrumbs(
  origin: string,
  trail: { name: string; href: string }[]
) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((t, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: t.name,
      item: new URL(t.href, origin).toString(),
    })),
  };
}

export function service(
  origin: string,
  s: { name: string; description: string; url: string }
) {
  return {
    '@type': 'Service',
    name: s.name,
    description: s.description,
    url: new URL(s.url, origin).toString(),
    provider: { '@id': orgId(origin) },
    ...(site.serviceAreas.some((a) => isPublic(a.status))
      ? {
          areaServed: site.serviceAreas
            .filter((a) => isPublic(a.status))
            .map((a) => ({ '@type': 'Place', name: a.name })),
        }
      : {}),
  };
}

export function faqPage(items: { q: string; a: string }[]) {
  if (!items.length) return null;
  return {
    '@type': 'FAQPage',
    mainEntity: items.map((i) => ({
      '@type': 'Question',
      name: i.q,
      acceptedAnswer: { '@type': 'Answer', text: i.a },
    })),
  };
}

export function article(
  origin: string,
  a: {
    headline: string;
    description: string;
    url: string;
    datePublished: Date;
    dateModified?: Date;
  }
) {
  return {
    '@type': 'Article',
    headline: a.headline,
    description: a.description,
    mainEntityOfPage: new URL(a.url, origin).toString(),
    datePublished: a.datePublished.toISOString(),
    dateModified: (a.dateModified ?? a.datePublished).toISOString(),
    inLanguage: 'ru-RU',
    publisher: { '@id': orgId(origin) },
    author: { '@id': orgId(origin) },
  };
}

/** Wraps a set of nodes into a single @graph document. */
export function graph(nodes: unknown[]) {
  return JSON.stringify(
    { '@context': 'https://schema.org', '@graph': nodes.filter(Boolean) },
    null,
    0
  );
}
