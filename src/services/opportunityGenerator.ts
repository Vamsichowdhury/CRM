import { DEAL_STAGES, type Opportunity } from "../types/opportunity";

/** Salespeople used consistently by generated records and the owner filter. */
export const OWNERS = [
  "Aisha Khan",
  "Priya Sharma",
  "Arjun Mehta",
  "Neha Kapoor",
  "Rohan Iyer",
  "Vikram Rao",
  "Maya Nair",
];

// Fictional business customers; numeric suffixes make the 50k-company list feel less repetitive.
const companies = [
  "Indigo Networks",
  "BluePeak Logistics",
  "Cedarstone Hotels",
  "DeltaWorks Engineering",
  "Evergreen Learning Group",
  "Fable & Finch Consulting",
  "Granite Bay Construction",
  "Harborview Clinics",
  "Juniper Retail Group",
  "Kiteway Technologies",
  "LumenPath Finance",
  "Mapleline Education",
  "Pinecrest Property Group",
  "Oakridge Foods India",
  "Pioneer Mobility Group",
  "QuartzPoint Media",
  "Riverstone Legal Associates",
  "Summit Travel Services",
  "TerraNova Manufacturing",
  "Willow Creek Architects",
];

// Quantity and price bounds keep generated deal values plausible for bulk office furniture orders.
const products = [
  {
    name: "Office chairs",
    minUnits: 20,
    maxUnits: 240,
    minPrice: 900,
    maxPrice: 2_600,
  },
  {
    name: "Office desks",
    minUnits: 10,
    maxUnits: 100,
    minPrice: 4_000,
    maxPrice: 12_000,
  },
  {
    name: "Conference tables",
    minUnits: 2,
    maxUnits: 35,
    minPrice: 22_000,
    maxPrice: 75_000,
  },
  {
    name: "Storage cabinets",
    minUnits: 5,
    maxUnits: 120,
    minPrice: 5_000,
    maxPrice: 19_000,
  },
  {
    name: "Reception desks",
    minUnits: 1,
    maxUnits: 15,
    minPrice: 28_000,
    maxPrice: 95_000,
  },
];

/**
 * A tiny deterministic pseudo-random generator. A fixed seed makes screenshots,
 * tests, and assignment review repeatable without storing 50,000 records.
 */
function seeded(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

export function generateOpportunities(
  count = 50_000,
  seed = 42,
  now = new Date("2026-10-31T00:00:00.000Z"),
): Opportunity[] {
  // Build once in a preallocated array to avoid repeated allocations for the demo dataset.
  const random = seeded(seed);
  const records = new Array<Opportunity>(count);
  for (let index = 0; index < count; index += 1) {
    const createdDaysAgo = Math.floor(random() * 540);
    const activityDaysAgo = Math.floor(random() * 100);
    const created = new Date(now.getTime() - createdDaysAgo * 86_400_000);
    const activity = new Date(now.getTime() - activityDaysAgo * 86_400_000);
    const company = companies[Math.floor(random() * companies.length)];
    const product = products[Math.floor(random() * products.length)];
    const stageIndex = Math.min(
      DEAL_STAGES.length - 1,
      Math.floor(random() * DEAL_STAGES.length),
    );
    const quantity =
      product.minUnits +
      Math.floor(random() * (product.maxUnits - product.minUnits + 1));
    const unitPrice =
      product.minPrice + random() * (product.maxPrice - product.minPrice);
    records[index] = {
      id: `opp-${String(index + 1).padStart(5, "0")}`,
      companyName: `${company}${index % 4 === 0 ? ` ${Math.floor(index / 4) + 1}` : ""}`,
      opportunityName: product.name,
      dealValue: Math.round((quantity * unitPrice) / 1000) * 1000,
      licenceCount: quantity,
      owner: OWNERS[Math.floor(random() * OWNERS.length)],
      stage: DEAL_STAGES[stageIndex],
      lastActivityAt: activity.toISOString(),
      createdAt: created.toISOString(),
      updatedAt: new Date(
        created.getTime() +
          Math.floor(random() * Math.max(1, now.getTime() - created.getTime())),
      ).toISOString(),
      version: 1,
    };
  }

  // Keep the brief's example available at a predictable position for reviewers.
  if (count > 0) {
    records[0] = {
      ...records[0],
      companyName: "Indigo Networks",
      opportunityName: "Office chairs",
      dealValue: 122_000,
      licenceCount: 115,
      owner: "Aisha Khan",
      stage: "New Lead",
      updatedAt: now.toISOString(),
    };
  }

  return records;
}
