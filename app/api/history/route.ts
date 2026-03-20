import { NextResponse } from "next/server";
import { readdir, readFile, stat } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import { getPlantUMLPngUrl } from "@/lib/plantuml";

export interface HistoryItem {
  filename: string;
  createdAt: string;
  umlCode: string;
  imageUrl: string;
  size: number;
}

function parseFilenameDate(filename: string): string {
  // Format: YYYYMMDD_HHMMSS_mmm.wsd
  const base = filename.replace(".wsd", "");
  const parts = base.split("_");
  if (parts.length < 2) return filename;
  const [datePart, timePart] = parts;
  const y = datePart.slice(0, 4);
  const mo = datePart.slice(4, 6);
  const d = datePart.slice(6, 8);
  const h = timePart.slice(0, 2);
  const mi = timePart.slice(2, 4);
  const s = timePart.slice(4, 6);
  return `${y}-${mo}-${d} ${h}:${mi}:${s}`;
}

export async function GET() {
  try {
    const outputDir = join(process.cwd(), "output");

    if (!existsSync(outputDir)) {
      return NextResponse.json({ items: [] });
    }

    const all = await readdir(outputDir);
    const wsdFiles = all
      .filter((f) => f.endsWith(".wsd"))
      .sort()
      .reverse()
      .slice(0, 30);

    const items: HistoryItem[] = await Promise.all(
      wsdFiles.map(async (filename) => {
        const filePath = join(outputDir, filename);
        const [umlCode, fileStat] = await Promise.all([
          readFile(filePath, "utf-8"),
          stat(filePath),
        ]);
        return {
          filename,
          createdAt: parseFilenameDate(filename),
          umlCode,
          imageUrl: getPlantUMLPngUrl(umlCode),
          size: fileStat.size,
        };
      })
    );

    return NextResponse.json({ items });
  } catch (err) {
    console.error("[/api/history]", err);
    return NextResponse.json({ items: [] });
  }
}
