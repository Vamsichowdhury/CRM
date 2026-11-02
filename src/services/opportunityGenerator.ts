import { DEAL_STAGES, type Opportunity } from "../types/opportunity";

/** Use the same salesperson names in the sample deals and owner filter. */
export const OWNERS = [
  "Aisha Khan",
  "Priya Sharma",
  "Arjun Mehta",
  "Neha Kapoor",
  "Rohan Iyer",
  "Vikram Rao",
  "Maya Nair",
];

// These are fictional customer businesses; suffixes make repeated names easier to distinguish.
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

// Keep quantities and prices in believable ranges for business furniture orders.
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
 * Make sample choices repeatable. With the same seed, the app and tests get
 * the same opportunities without needing a saved file full of sample data.
 */
function seeded(seed: number) {
  let state = seed >>> 0;
  return () => {
    // Move to the next repeatable number, then return it as a value from 0 to 1.
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

/** Build repeatable sample deals using the chosen count, seed, and reference date. */
export function generateOpportunities(
  count = 50_000,
  seed = 42,
  now = new Date("2026-10-31T00:00:00.000Z"),
): Opportunity[] {
  // Reserve the space once, then fill each position as we create an opportunity.
  const random = seeded(seed);
  const records = new Array<Opportunity>(count);
  for (let index = 0; index < count; index += 1) {
    // Give each deal plausible ages for when it was created and last contacted.
    const createdDaysAgo = Math.floor(random() * 540);
    const activityDaysAgo = Math.floor(random() * 100);
    const created = new Date(now.getTime() - createdDaysAgo * 86_400_000);
    const activity = new Date(now.getTime() - activityDaysAgo * 86_400_000);
    // Pick the business, furniture order, and pipeline stage for this sample deal.
    const company = companies[Math.floor(random() * companies.length)];
    const product = products[Math.floor(random() * products.length)];
    const stageIndex = Math.min(
      DEAL_STAGES.length - 1,
      Math.floor(random() * DEAL_STAGES.length),
    );
    // Work out a bulk quantity and a unit price, then round the deal total.
    const quantity =
      product.minUnits +
      Math.floor(random() * (product.maxUnits - product.minUnits + 1));
    const unitPrice =
      product.minPrice + random() * (product.maxPrice - product.minPrice);
    // Give every record its own stable ID so selection and updates can find it later.
    records[index] = {
      id: `opp-${String(index + 1).padStart(5, "0")}`,
      companyName: `${company}${index % 4 === 0 ? ` ${Math.floor(index / 4) + 1}` : ""}`,
      opportunityName: product.name,
      // Round the total to the nearest thousand so the sample values are easy to scan.
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

  // Keep the requested Indigo Networks example at the top for easy demonstration.
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
