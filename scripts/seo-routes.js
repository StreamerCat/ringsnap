export const BASE_URL = 'https://getringsnap.com';

export const INDEXABLE_ROUTES = [
  { path: '/', changefreq: 'weekly', priority: '1.0' },
  { path: '/pricing', changefreq: 'monthly', priority: '0.9' },
  { path: '/difference', changefreq: 'monthly', priority: '0.8' },
  { path: '/plumbers', changefreq: 'monthly', priority: '0.8' },
  { path: '/hvac', changefreq: 'monthly', priority: '0.8' },
  { path: '/electricians', changefreq: 'monthly', priority: '0.8' },
  { path: '/roofing', changefreq: 'monthly', priority: '0.8' },
  { path: '/privacy', changefreq: 'yearly', priority: '0.5' },
  { path: '/terms', changefreq: 'yearly', priority: '0.5' },

  // Resource center + field guides
  { path: '/resources', changefreq: 'weekly', priority: '0.9' },
  { path: '/resources/hvac-dispatcher-script-template', changefreq: 'monthly', priority: '0.8' },
  { path: '/resources/plumbing-dispatcher-script-template', changefreq: 'monthly', priority: '0.8' },
  { path: '/resources/electrician-call-answering-script', changefreq: 'monthly', priority: '0.8' },
  { path: '/resources/hvac-after-hours-answering-script', changefreq: 'monthly', priority: '0.7' },
  { path: '/resources/hvac-price-shopper-phone-script', changefreq: 'monthly', priority: '0.7' },
  { path: '/resources/hvac-emergency-call-triage', changefreq: 'monthly', priority: '0.7' },
  { path: '/resources/burst-pipe-call-script', changefreq: 'monthly', priority: '0.7' },
  { path: '/resources/sewer-backup-call-script', changefreq: 'monthly', priority: '0.7' },
  { path: '/resources/drain-cleaning-upsell-script', changefreq: 'monthly', priority: '0.7' },
  { path: '/resources/electrical-safety-triage-questions', changefreq: 'monthly', priority: '0.7' },
  { path: '/resources/panel-upgrade-booking-script', changefreq: 'monthly', priority: '0.7' },
  { path: '/resources/power-outage-call-script', changefreq: 'monthly', priority: '0.7' },
  { path: '/resources/missed-call-revenue-calculator', changefreq: 'monthly', priority: '0.8' },
  { path: '/resources/after-hours-call-calculator', changefreq: 'monthly', priority: '0.7' },
  { path: '/resources/service-pricing-calculator', changefreq: 'monthly', priority: '0.7' },
  { path: '/resources/increase-average-ticket', changefreq: 'monthly', priority: '0.7' },

  // CRM page
  { path: '/crm', changefreq: 'monthly', priority: '0.9' },

  // Comparison hub + pages
  { path: '/compare', changefreq: 'monthly', priority: '0.8' },
  { path: '/compare/ringsnap-vs-ruby', changefreq: 'monthly', priority: '0.8' },
  { path: '/compare/ringsnap-vs-smith-ai', changefreq: 'monthly', priority: '0.8' },
  { path: '/compare/ringsnap-vs-goodcall', changefreq: 'monthly', priority: '0.8' },
  { path: '/compare/ai-receptionist-vs-live-answering', changefreq: 'monthly', priority: '0.8' },
  { path: '/compare/best-ai-receptionist-home-services', changefreq: 'monthly', priority: '0.9' },
];

export const FIELD_GUIDE_ROUTE_PATHS = INDEXABLE_ROUTES
  .map((route) => route.path)
  .filter((path) => path.startsWith('/resources/'));

export function getSortedIndexableRoutes() {
  const deduped = Array.from(new Map(INDEXABLE_ROUTES.map((route) => [route.path, route])).values());
  return deduped.sort((a, b) => a.path.localeCompare(b.path));
}
