import path from "node:path";
import { generateDailyData, getJstDateString, persistDailyData, readStatus } from "./batch";

function last14Days(anchor = getJstDateString()): string[] {
  const dates: string[] = [];
  const anchorDate = new Date(`${anchor}T00:00:00+09:00`);
  for (let i = 13; i >= 0; i--) {
    const d = new Date(anchorDate);
    d.setDate(d.getDate() - i);
    dates.push(
      new Intl.DateTimeFormat("sv-SE", {
        timeZone: "Asia/Tokyo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(d),
    );
  }
  return dates;
}

export async function seed(anchorDate?: string): Promise<void> {
  const dates = last14Days(anchorDate);
  const status = await readStatus();

  console.log(`Seeding ${dates.length} dates: ${dates[0]} → ${dates[dates.length - 1]}`);

  for (const date of dates) {
    if (status[date]?.persisted) {
      console.log(`  [SKIP] ${date} already persisted`);
      continue;
    }
    console.log(`  [GEN]  ${date} generating...`);
    const data = await generateDailyData(date);
    await persistDailyData(date, data, { updateLatest: false });
    console.log(`  [DONE] ${date} persisted`);
  }

  console.log("Seed complete.");
}

export { last14Days };

const isDirectExecution =
  process.argv[1] && path.resolve(process.argv[1]).endsWith(path.join("scripts", "seed.ts"));

if (isDirectExecution) {
  const anchorArg = process.argv[2];
  seed(anchorArg)
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
