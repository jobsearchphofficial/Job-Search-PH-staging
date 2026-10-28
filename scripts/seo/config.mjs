// Shared settings for the static SEO pages (job pages, category/location pages, trust pages).
// No dependencies. Categories and cities mirror CATEGORIES and CITIES in assets/app.js.

export const SITE = (process.env.SITE_URL || "https://jobsearchph.com").replace(/\/+$/, "");
export const BRAND = "Job Search PH";
export const PAGE_SIZE = 20;           // jobs per listing page
export const MIN_INDEX_JOBS = 2;       // a non-core listing page is indexed only with at least this many live jobs
export const MIN_DESC_CHARS = 80;      // a job with a shorter description is not indexed
export const LISTING_DAYS = 30;        // keep in sync with assets/firebase-config.js
export const OG_IMAGE = "/assets/img/og-default.png";
export const OG_IMAGE_SIZE = [1200, 630];
export const FACEBOOK_PAGE = "https://www.facebook.com/thejobsearchph/";

export const slugify = (s) =>
  String(s || "")
    .normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

// `core` pages are always indexed: they are the platform's main focus and carry their own guidance text.
// Every other category page is indexed once it has MIN_INDEX_JOBS live jobs.
export const CATEGORIES = [
  { name: "Kasambahay / Househelper", slug: "kasambahay", label: "Kasambahay", title: "Kasambahay Jobs", core: true, household: true },
  { name: "Yaya / Nanny", slug: "yaya", label: "Yaya and nanny", title: "Yaya and Nanny Jobs", core: true, household: true },
  { name: "Caregiver", slug: "caregiver", label: "Caregiver", title: "Caregiver Jobs", household: true },
  { name: "Cook", slug: "cook", label: "Cook", title: "Cook Jobs", household: true },
  { name: "Driver", slug: "driver", label: "Driver", title: "Driver Jobs", household: true },
  { name: "Laundry", slug: "laundry", label: "Laundry", title: "Laundry Jobs" },
  { name: "Gardener / Maintenance", slug: "gardener-maintenance", label: "Gardener and maintenance", title: "Gardener and Maintenance Jobs" },
  { name: "Food service", slug: "food-service", label: "Food service", title: "Food Service Jobs" },
  { name: "Sales / Retail", slug: "sales-retail", label: "Sales and retail", title: "Sales and Retail Jobs" },
  { name: "Delivery / Rider", slug: "delivery-rider", label: "Delivery and rider", title: "Delivery Rider Jobs" },
  { name: "Construction / Skilled trade", slug: "construction-skilled-trade", label: "Construction and skilled trade", title: "Construction and Skilled Trade Jobs" },
  { name: "Security", slug: "security", label: "Security", title: "Security Jobs" },
  { name: "Office / Admin", slug: "office-admin", label: "Office and admin", title: "Office and Admin Jobs" },
].map((c) => ({ ...c, path: `/jobs/${c.slug}/` }));

const CITY_NAMES = [
  "Bacolod City", "Talisay City", "Silay City", "Bago City", "Victorias City", "Cadiz City",
  "Sagay City", "La Carlota City", "Kabankalan City", "San Carlos City", "Escalante City",
  "Himamaylan City", "Sipalay City",
  "Binalbagan", "Calatrava", "Candoni", "Cauayan", "E.B. Magalona", "Hinigaran", "Hinoba-an",
  "Ilog", "Isabela", "La Castellana", "Manapla", "Moises Padilla", "Murcia", "Pontevedra",
  "Pulupandan", "Salvador Benedicto", "San Enrique", "Toboso", "Valladolid",
];
// Metro Bacolod keeps a page even with no jobs (it is noindex until it has MIN_INDEX_JOBS, except Bacolod City itself).
const METRO = ["Bacolod City", "Talisay City", "Silay City", "Bago City"];
export const BARANGAYS = {
  "Bacolod City": ["Alangilan", "Alijis", "Banago", "Bata", "Cabug", "Estefania", "Felisa", "Granada", "Handumanan", "Mandalagan",
    "Mansilingan", "Montevista", "Pahanocoy", "Punta Taytay", "Singcang-Airport", "Sum-ag", "Taculing", "Tangub", "Villamonte", "Vista Alegre"],
  "Talisay City": ["Bubog", "Cabatangan", "Concepcion", "Dos Hermanas", "Efigenio Lizares", "Katilingban", "Matab-ang", "San Fernando"],
  "Silay City": ["Bagtic", "Balaring", "E. Lopez", "Guimbala-on", "Guinhalaran", "Hawaiian", "Kapitan Ramon", "Lantad", "Mambulac", "Patag", "Rizal"],
};
export const CITIES = CITY_NAMES.map((name) => ({
  name, slug: slugify(name), metro: METRO.includes(name), core: name === "Bacolod City", path: `/jobs/in/${slugify(name)}/`,
}));
export const PROVINCE = { name: "Negros Occidental", slug: "negros-occidental", path: "/jobs/in/negros-occidental/" };

export const catByName = (n) => CATEGORIES.find((c) => c.name === n);
export const cityByName = (n) => CITIES.find((c) => c.name === n);

// Pages written once by scripts/build-static-pages.mjs and committed (they don't change when jobs change).
export const TRUST_PAGES = [
  { path: "/about/", title: "About Job Search PH", name: "About" },
  { path: "/how-it-works/", title: "How Job Search PH works", name: "How it works" },
  { path: "/employers/", title: "Post a Job for Free in Bacolod and Negros Occidental", name: "For employers" },
  { path: "/safety/", title: "Jobseeker and Employer Safety Tips", name: "Safety tips" },
  { path: "/faq/", title: "Frequently Asked Questions", name: "FAQ" },
  { path: "/contact/", title: "Contact Job Search PH", name: "Contact" },
  { path: "/terms/", title: "Terms of Use", name: "Terms" },
  { path: "/privacy/", title: "Privacy Policy", name: "Privacy" },
];
