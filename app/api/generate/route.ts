import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { generateUMLCode } from "@/lib/qwen";
import { getPlantUMLPngUrl } from "@/lib/plantuml";

function buildFilename(): string {
  const now = new Date();
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  const date = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const ms = pad(now.getMilliseconds(), 3);
  return `${date}_${time}_${ms}.wsd`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const description: string = body?.description ?? "";

    if (!description.trim()) {
      return NextResponse.json(
        { error: "请输入 UML 描述内容" },
        { status: 400 }
      );
    }

    const umlCode = await generateUMLCode(description.trim());
    const imageUrl = getPlantUMLPngUrl(umlCode);

    // Persist .wsd file to <project-root>/output/
    const outputDir = join(process.cwd(), "output");
    await mkdir(outputDir, { recursive: true });
    const filename = buildFilename();
    await writeFile(join(outputDir, filename), umlCode, "utf-8");

    return NextResponse.json({ umlCode, imageUrl, filename });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "服务器内部错误";
    console.error("[/api/generate]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
