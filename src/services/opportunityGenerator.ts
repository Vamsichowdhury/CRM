import { DEAL_STAGES, type Opportunity } from "../types/opportunity";

export const OWNERS = [
  "Priya Sharma",
  "Arjun Mehta",
  "Neha Kapoor",
  "Rohan Iyer",
  "Aisha Khan",
  "Vikram Rao",
  "Maya Nair",
];

const companies = [
  "Acme Corporation",
  "Bluebird Health",
  "Cedar & Co",
  "Delta Logistics",
  "Evergreen Labs",
  "Fable Financial",
  "Granite Systems",
  "Harbor Retail",
  "Indigo Networks",
  "Juniper Works",
  "Kite Analytics",
  "Lumen Energy",
  "Maple Education",
  "Northwind Group",
  "Oakridge Foods",
  "Pioneer Mobility",
  "Quartz Media",
  "Riverstone Bank",
  "Summit Travel",
  "Terra Manufacturing",
];
const products = [
  "Enterprise platform",
  "Analytics suite",
  "Team workspace",
  "Cloud migration",
  "Annual licence renewal",
];

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
  const random = seeded(seed);
  const records = new Array<Opportunity>(count);
  for (let index = 0; index < count; index += 1) {
    const createdDaysAgo = Math.floor(random() * 540);
    const activityDaysAgo = Math.floor(random() * 100);
    const created = new Date(now.getTime() - createdDaysAgo * 86_400_000);
    const activity = new Date(now.getTime() - activityDaysAgo * 86_400_000);
    const company = companies[Math.floor(random() * companies.length)];
    const stageIndex = Math.min(
      DEAL_STAGES.length - 1,
      Math.floor(random() * DEAL_STAGES.length),
    );
    records[index] = {
      id: `opp-${String(index + 1).padStart(5, "0")}`,
      companyName: `${company}${index % 4 === 0 ? ` ${Math.floor(index / 4) + 1}` : ""}`,
      opportunityName: products[Math.floor(random() * products.length)],
      dealValue: Math.round((20_000 + random() * 980_000) / 1000) * 1000,
      licenceCount: 5 + Math.floor(random() * 196),
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
  return records;
}
