import { NextRequest, NextResponse } from "next/server";

function getRequiredEnv(key: string): string {
  const v = process.env[key];
  if (!v || !v.trim()) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return v.trim().replace(/\/+$/, "");
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const imageUrl: unknown = body?.imageUrl;

    if (typeof imageUrl !== "string" || !imageUrl.trim()) {
      return NextResponse.json(
        { error: "imageUrl 缺失" },
        { status: 400 }
      );
    }

    // 当前项目仅生成 PlantUML PNG（用环境变量配置允许前缀，避免硬编码泄露）
    const base = getRequiredEnv("PLANTUML_PNG_BASE_URL");
    const allowedPrefix = `${base}/`;
    if (!imageUrl.startsWith(allowedPrefix)) {
      return NextResponse.json(
        { error: "仅支持 PlantUML png 地址" },
        { status: 400 }
      );
    }

    const res = await fetch(imageUrl);
    if (!res.ok) {
      return NextResponse.json(
        { error: `图片拉取失败：${res.status}` },
        { status: 502 }
      );
    }

    const contentType = res.headers.get("content-type") ?? "image/png";
    const arrayBuffer = await res.arrayBuffer();
    const size = arrayBuffer.byteLength;

    // 防止极端大图占用过多内存/传输
    if (size > 5_000_000) {
      return NextResponse.json(
        { error: "图片过大，无法缓存" },
        { status: 413 }
      );
    }

    const base64 = Buffer.from(arrayBuffer).toString("base64");
    const dataUrl = `data:${contentType};base64,${base64}`;

    return NextResponse.json({ dataUrl, size, contentType });
  } catch (err) {
    const message = err instanceof Error ? err.message : "未知错误";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

