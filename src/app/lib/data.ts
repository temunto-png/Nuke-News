import fs from "node:fs";
import path from "node:path";
import type { DailyData } from "../../../scripts/types";

const DATA_DIR = path.join(process.cwd(), "data");

function readDataFile(filePath: string): DailyData | null {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw) as DailyData;
  } catch (error) {
    console.warn(`Failed to read data file: ${filePath}`, error);
    return null;
  }
}

export function loadDailyData(date: string): DailyData | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return null;
  }

  return readDataFile(path.join(DATA_DIR, `${date}.json`));
}

export function listAvailableDates(): string[] {
  if (!fs.existsSync(DATA_DIR)) {
    return [];
  }

  return fs
    .readdirSync(DATA_DIR)
    .filter((file) => /^\d{4}-\d{2}-\d{2}\.json$/.test(file))
    .map((file) => file.replace(/\.json$/, ""))
    .sort((a, b) => b.localeCompare(a));
}

export function loadLatestData(): DailyData | null {
  const latest = readDataFile(path.join(DATA_DIR, "latest.json"));

  if (latest) {
    return latest;
  }

  const newestDate = listAvailableDates()[0];
  return newestDate ? loadDailyData(newestDate) : null;
}
