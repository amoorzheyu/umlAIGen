import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { generateUMLCodeStream } from "@/lib/qwen";
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
  const body = await req.json();
  const description: string = body?.description ?? "";

  if (!description.trim()) {
    return NextResponse.json({ error: "请输入 UML 描述内容" }, { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const safeDescription = description.trim();

        controller.enqueue(
          encoder.encode(
            `event: started\ndata: ${JSON.stringify({})}\n\n`
          )
        );

        const umlCode = await generateUMLCodeStream(
          safeDescription,
          (chunk) => {
            controller.enqueue(
              encoder.encode(
                `event: token\ndata: ${JSON.stringify({ chunk })}\n\n`
              )
            );
          },
          req.signal
        );

        const imageUrl = getPlantUMLPngUrl(umlCode);

        // Persist .wsd file to <project-root>/output/
        const outputDir = join(process.cwd(), "output");
        await mkdir(outputDir, { recursive: true });
        const filename = buildFilename();
        await writeFile(join(outputDir, filename), umlCode, "utf-8");

        controller.enqueue(
          encoder.encode(
            `event: done\ndata: ${JSON.stringify({
              umlCode,
              imageUrl,
              filename,
            })}\n\n`
          )
        );
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "服务器内部错误";
        console.error("[/api/generate]", err);
        controller.enqueue(
          encoder.encode(
            `event: error\ndata: ${JSON.stringify({ message })}\n\n`
          )
        );
      } finally {
        controller.close();
      }
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform, max-age=0",
      Connection: "keep-alive",
    },
  });
}
