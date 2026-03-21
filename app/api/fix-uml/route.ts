import { NextRequest, NextResponse } from "next/server";
import { fixUMLFromErrorImage } from "@/lib/qwen";
import { getPlantUMLPngUrl } from "@/lib/plantuml";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const umlCode: unknown = body?.umlCode;
    const imageDataUrl: unknown = body?.imageDataUrl;

    if (typeof umlCode !== "string" || !umlCode.trim()) {
      return NextResponse.json(
        { error: "umlCode 缺失" },
        { status: 400 }
      );
    }

    if (typeof imageDataUrl !== "string" || !imageDataUrl.trim()) {
      return NextResponse.json(
        { error: "imageDataUrl 缺失" },
        { status: 400 }
      );
    }

    if (
      !imageDataUrl.startsWith("data:image/") ||
      !imageDataUrl.includes(";base64,")
    ) {
      return NextResponse.json(
        { error: "imageDataUrl 格式无效，需要 data URL（如 data:image/png;base64,...）" },
        { status: 400 }
      );
    }

    const fixedCode = await fixUMLFromErrorImage({
      umlCode,
      imageDataUrl,
      signal: req.signal,
    });

    const imageUrl = getPlantUMLPngUrl(fixedCode);

    return NextResponse.json({ umlCode: fixedCode, imageUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : "未知错误";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
