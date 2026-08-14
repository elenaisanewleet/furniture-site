import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/* =========================================================================
   Content model
   -------------------------------------------------------------------------
   Five content types, each editable as a markdown file with front-matter.
   Adding a service, project, article or FAQ entry requires no developer:
   drop a file in the right folder (or use /admin/, see public/admin/).
   ========================================================================= */

const factStatus = z
  .enum(['fact', 'hypothesis', 'needs-confirmation'])
  .default('needs-confirmation');

/** A named image slot. Real photo or generated placeholder — same contract. */
const imageSlot = z.object({
  /** Stable asset name, e.g. "service-repair". Extension is added by <Photo>. */
  name: z.string(),
  alt: z.string(),
  /** Free-form note for whoever shoots or generates the real photo. */
  brief: z.string().optional(),
  ratio: z.enum(['16/9', '4/3', '3/2', '1/1', '4/5', '3/4']).default('3/2'),
});

const qa = z.object({
  q: z.string(),
  a: z.string(),
  status: factStatus,
});

const step = z.object({
  title: z.string(),
  text: z.string(),
});

/* ---------------------------------------------------------------- services */
/**
 * Commercial landing pages. One file = one indexable URL.
 * `group` drives navigation and internal linking; `parent` builds the
 * breadcrumb trail and the hub → spoke relationship.
 */
const services = defineCollection({
  loader: glob({ base: './src/content/services', pattern: '**/*.md' }),
  schema: z.object({
    title: z.string(),
    /** On-page H1. Usually differs from <title>. */
    h1: z.string(),
    seoTitle: z.string(),
    seoDescription: z.string(),

    group: z.enum(['mebel', 'remont', 'furnitura', 'detali']),
    /** Slug of the parent service, for hub pages leave empty. */
    parent: z.string().optional(),
    /** Lower sorts first within a group. */
    order: z.number().default(50),
    /** Shown on hubs and in navigation. */
    short: z.string(),

    /** The sentence the visitor would use to describe why they're here. */
    intent: z.string(),
    /** Client-voice phrasings of the problem — never industry terms. */
    problems: z.array(z.string()).default([]),
    /** Concrete things that can be done. Each carries its own status. */
    examples: z
      .array(z.object({ title: z.string(), text: z.string(), status: factStatus }))
      .default([]),
    /** Overrides the default 5-step process when this service differs. */
    process: z.array(step).default([]),

    hero: imageSlot.optional(),
    gallery: z.array(imageSlot).default([]),

    faq: z.array(qa).default([]),
    /** Slugs of sibling/related services. Drives internal linking. */
    related: z.array(z.string()).default([]),
    /** Slugs of journal articles that support this page. */
    reading: z.array(z.string()).default([]),

    /** Contextual wording of the recurring "show your task" CTA. */
    cta: z.object({
      title: z.string(),
      text: z.string(),
      button: z.string().default('Показать задачу'),
      /** Pre-selects step 1 of the request flow. */
      preset: z
        .enum(['new', 'remake', 'repair', 'part', 'custom-part', 'unknown'])
        .optional(),
    }),

    status: factStatus,
    noindex: z.boolean().default(false),
    updated: z.coerce.date().optional(),
  }),
});

/* ---------------------------------------------------------------- projects */
/**
 * Every completed job becomes a permanent SEO asset. Until real jobs are
 * photographed, `placeholder: true` entries demonstrate the template — they
 * are labelled on-page, excluded from the sitemap and set to noindex, so no
 * demo work is ever presented as the master's real portfolio.
 */
const projects = defineCollection({
  loader: glob({ base: './src/content/projects', pattern: '**/*.md' }),
  schema: z.object({
    title: z.string(),
    h1: z.string(),
    seoTitle: z.string(),
    seoDescription: z.string(),

    /** MUST stay true until a real, photographed job replaces it. */
    placeholder: z.boolean().default(true),

    summary: z.string(),
    /** Which service page this job belongs under. */
    serviceSlug: z.string().optional(),
    kind: z.string(),

    /** Facts panel — every field optional, nothing invented to fill it. */
    facts: z
      .object({
        district: z.string().optional(),
        dimensions: z.string().optional(),
        materials: z.string().optional(),
        hardware: z.string().optional(),
        duration: z.string().optional(),
        price: z.string().optional(),
      })
      .default({}),

    task: z.string(),
    situation: z.string(),
    constraints: z.array(z.string()).default([]),
    solution: z.string(),
    result: z.string(),

    beforeAfter: z
      .object({ before: imageSlot, after: imageSlot })
      .optional(),
    hero: imageSlot.optional(),
    gallery: z.array(imageSlot).default([]),

    related: z.array(z.string()).default([]),
    date: z.coerce.date().optional(),
    order: z.number().default(50),
  }),
});

/* ----------------------------------------------------------------- journal */
/** Long-tail informational content. Every article ends in the same CTA. */
const journal = defineCollection({
  loader: glob({ base: './src/content/journal', pattern: '**/*.md' }),
  schema: z.object({
    title: z.string(),
    h1: z.string(),
    seoTitle: z.string(),
    seoDescription: z.string(),
    /** One-line answer shown in listings and used for the FAQPage snippet. */
    answer: z.string(),
    /** The search phrasing this article exists to serve. */
    query: z.string(),
    topic: z.enum(['furnitura', 'remont', 'zamer', 'vybor', 'process']),
    hero: imageSlot.optional(),
    related: z.array(z.string()).default([]),
    services: z.array(z.string()).default([]),
    cta: z
      .object({
        title: z.string(),
        text: z.string(),
        preset: z
          .enum(['new', 'remake', 'repair', 'part', 'custom-part', 'unknown'])
          .optional(),
      })
      .optional(),
    date: z.coerce.date(),
    updated: z.coerce.date().optional(),
    status: factStatus,
    noindex: z.boolean().default(false),
  }),
});

/* --------------------------------------------------------------------- faq */
/** Site-wide FAQ. Also feeds FAQPage structured data on /faq/. */
const faq = defineCollection({
  loader: glob({ base: './src/content/faq', pattern: '**/*.md' }),
  schema: z.object({
    q: z.string(),
    /** Short answer used for structured data; body markdown may expand it. */
    a: z.string(),
    group: z.enum(['zayavka', 'rabota', 'remont', 'furnitura', 'dengi']),
    order: z.number().default(50),
    services: z.array(z.string()).default([]),
    status: factStatus,
  }),
});

/* ---------------------------------------------------------------- district */
/** Service areas. Published only once geography is confirmed. */
const areas = defineCollection({
  loader: glob({ base: './src/content/areas', pattern: '**/*.md' }),
  schema: z.object({
    name: z.string(),
    kind: z.enum(['city', 'district', 'settlement']),
    order: z.number().default(50),
    status: factStatus,
  }),
});

export const collections = { services, projects, journal, faq, areas };
