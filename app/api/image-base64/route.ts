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
      console.error("[/api/image-base64] imageUrl 缺失, body:", JSON.stringify(body));
      return NextResponse.json(
        { error: "imageUrl 缺失" },
        { status: 400 }
      );
    }

    // 当前项目仅生成 PlantUML PNG（用环境变量配置允许前缀，避免硬编码泄露）
    const base = getRequiredEnv("PLANTUML_PNG_BASE_URL");
    const allowedPrefix = `${base}/`;
    if (!imageUrl.startsWith(allowedPrefix)) {
      console.error("[/api/image-base64] URL 前缀不符, allowedPrefix:", allowedPrefix, ", imageUrl:", imageUrl);
      return NextResponse.json(
        { error: "仅支持 PlantUML png 地址" },
        { status: 400 }
      );
    }

    const res = await fetch(imageUrl);
    const contentType = res.headers.get("content-type") ?? "image/png";
    const arrayBuffer = await res.arrayBuffer();

    if (!res.ok) {
      const isPng =
        contentType.includes("image/png") &&
        arrayBuffer.byteLength >= 8 &&
        new Uint8Array(arrayBuffer, 0, 4).every(
          (b, i) => b === [0x89, 0x50, 0x4e, 0x47][i]
        );
      if (isPng) {
        const size = arrayBuffer.byteLength;
        if (size > 5_000_000) {
          console.error("[/api/image-base64] PlantUML 400 响应图片过大: size=", size);
          return NextResponse.json(
            { error: "图片过大，无法缓存" },
            { status: 413 }
          );
        }
        const base64 = Buffer.from(arrayBuffer).toString("base64");
        const dataUrl = `data:${contentType.split(";")[0] ?? "image/png"};base64,${base64}`;
        console.warn(
          `[/api/image-base64] PlantUML 返回 ${res.status} 但响应为有效 PNG，已返回 base64`
        );
        return NextResponse.json(
          {
            error: `PlantUML 返回错误状态 ${res.status}，但响应为有效图片`,
            dataUrl,
            size,
            contentType: contentType.split(";")[0] ?? "image/png",
          },
          { status: 400 }
        );
      }
      const bodyPreview = new TextDecoder().decode(arrayBuffer.slice(0, 500));
      console.error(
        `[/api/image-base64] 图片拉取失败: status=${res.status} ${res.statusText}, url=${imageUrl}, contentType=${contentType}, bodyPreview=${bodyPreview}`
      );
      return NextResponse.json(
        { error: `图片拉取失败：${res.status}` },
        { status: 502 }
      );
    }
    const size = arrayBuffer.byteLength;

    // 防止极端大图占用过多内存/传输
    if (size > 5_000_000) {
      console.error("[/api/image-base64] 图片过大: size=", size, "url=", imageUrl);
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
    console.error("[/api/image-base64] 异常:", err instanceof Error ? err.stack : String(err));
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

