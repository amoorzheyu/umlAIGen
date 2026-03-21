import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import {
  extractContextFromFileText,
  extractContextFromImage,
  generateUMLCodeStream,
} from "@/lib/qwen";
import { getPlantUMLPngUrl } from "@/lib/plantuml";
import mammoth from "mammoth";
import { extractText } from "unpdf";

function shouldStoreOutput(): boolean {
  const v = process.env.UMLAIGEN_STORE_OUTPUT;
  if (!v) return false;
  const normalized = v.trim().toLowerCase();
  return ["true", "1", "yes", "on"].includes(normalized);
}

function buildFilename(): string {
  const now = new Date();
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  const date = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const ms = pad(now.getMilliseconds(), 3);
  return `${date}_${time}_${ms}.wsd`;
}

export async function POST(req: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const contentType = req.headers.get("content-type") ?? "";

        let description = "";
        let graphHint = "auto";
        let referenceContextText = "";

        let referenceImages: File[] = [];
        let referenceFiles: File[] = [];
        let referenceUploads: File[] = [];

        const isProbablyImage = (file: File) => {
          if (file.type?.startsWith("image/")) return true;
          const lower = file.name.toLowerCase();
          return /\.(png|jpe?g|gif|webp|bmp|svg|tiff?)$/.test(lower);
        };

        const guessImageMimeTypeFromName = (file: File) => {
          if (file.type?.startsWith("image/")) return file.type;
          const lower = file.name.toLowerCase();
          if (lower.endsWith(".png")) return "image/png";
          if (lower.endsWith(".jpg") || lower.endsWith(".jpeg"))
            return "image/jpeg";
          if (lower.endsWith(".gif")) return "image/gif";
          if (lower.endsWith(".webp")) return "image/webp";
          if (lower.endsWith(".bmp")) return "image/bmp";
          if (lower.endsWith(".svg")) return "image/svg+xml";
          if (lower.endsWith(".tif") || lower.endsWith(".tiff"))
            return "image/tiff";
          return "image/*";
        };

        // 兼容旧 JSON：只支持 description，不做参考抽取
        if (contentType.includes("application/json")) {
          const body = await req.json();
          description = body?.description ?? "";
          graphHint = body?.hint ?? "auto";
          referenceContextText = body?.referenceContextText ?? "";
        } else {
          const formData = await req.formData();

          const isUploadFile = (v: unknown): v is File => {
            const vv = v as any;
            return (
              vv &&
              typeof vv.arrayBuffer === "function" &&
              typeof vv.name === "string" &&
              typeof vv.size === "number"
            );
          };

          const d = formData.get("description");
          description = typeof d === "string" ? d : "";

          const h = formData.get("hint");
          graphHint = typeof h === "string" && h.trim() ? h : "auto";

          const ctx = formData.get("referenceContextText");
          referenceContextText = typeof ctx === "string" ? ctx : "";

          referenceUploads = formData
            .getAll("referenceUploads")
            .filter(isUploadFile);

          // 新版：统一字段 referenceUploads，由后端按后缀/类型分流。
          // 旧版：仍兼容 referenceImages / referenceFiles 两字段。
          if (referenceUploads.length > 0) {
            referenceImages = referenceUploads.filter(isProbablyImage);
            referenceFiles = referenceUploads.filter((f) => !isProbablyImage(f));
          } else {
            referenceImages = formData
              .getAll("referenceImages")
              .filter(isUploadFile);

            referenceFiles = formData
              .getAll("referenceFiles")
              .filter(isUploadFile);
          }
        }

        if (!description.trim()) {
          controller.enqueue(
            encoder.encode(
              `event: error\ndata: ${JSON.stringify({
                message: "请输入 UML 描述内容",
              })}\n\n`
            )
          );
          return;
        }

        controller.enqueue(
          encoder.encode(`event: started\ndata: ${JSON.stringify({})}\n\n`)
        );

        const safeDescription = description.trim();

        const buildReferenceBlock = async () => {
          // 若前端已提供抽取上下文（例如历史复用），直接跳过抽取
          if (referenceContextText.trim()) return referenceContextText.trim();

          const IMAGE_MAX_BYTES = 5_000_000;
          const FILE_MAX_BYTES = 5_000_000;
          const TOTAL_MAX_BYTES = 10_000_000;
          const MAX_ITEMS = 20;

          const totalBytes =
            referenceImages.reduce((s, i) => s + i.size, 0) +
            referenceFiles.reduce((s, f) => s + f.size, 0);

          if (totalBytes > TOTAL_MAX_BYTES) {
            throw new Error("参考资料总大小超过 10MB 限制。");
          }
          if (referenceImages.length + referenceFiles.length > MAX_ITEMS) {
            throw new Error("参考资料数量过多，请减少文件数。");
          }

          async function mapWithConcurrency<T, R>(
            items: T[],
            concurrency: number,
            worker: (item: T, idx: number) => Promise<R>
          ): Promise<R[]> {
            const results: R[] = new Array(items.length);
            let cursor = 0;

            const runners = Array.from({ length: concurrency }).map(async () => {
              while (cursor < items.length) {
                const idx = cursor++;
                results[idx] = await worker(items[idx], idx);
              }
            });

            await Promise.all(runners);
            return results;
          }

          async function fileToText(file: File): Promise<string> {
            const arrayBuffer = await file.arrayBuffer();
            const mimeType = file.type || "";
            const lowerName = file.name.toLowerCase();

            const tryDecodeAsText = () => {
              const decoded = new TextDecoder("utf-8", { fatal: false }).decode(
                arrayBuffer
              );
              return decoded.trim();
            };

            const isLikelyText =
              mimeType.startsWith("text/") ||
              /\.(txt|md|json|csv|log|yaml|yml|xml|html|css|js|ts|py|java|c|cpp|go|rb|php|sh|bat)$/i.test(
                lowerName
              );

            if (isLikelyText) {
              return tryDecodeAsText();
            }

            if (mimeType === "application/pdf" || lowerName.endsWith(".pdf")) {
              const { text } = await extractText(new Uint8Array(arrayBuffer), {
                mergePages: true,
              });
              return typeof text === "string" ? text.trim() : "";
            }

            if (
              mimeType.includes("wordprocessingml") ||
              lowerName.endsWith(".docx")
            ) {
              const parsed = await mammoth.extractRawText({
                buffer: Buffer.from(arrayBuffer),
              });
              return parsed.value?.trim() ?? "";
            }

            // best-effort：尝试当作文本解码（若失败则返回空串交由上层处理）
            return tryDecodeAsText();
          }

          const imageExtractions = await mapWithConcurrency(
            referenceImages,
            3,
            async (img) => {
              if (img.size > IMAGE_MAX_BYTES) {
                throw new Error(`图片 ${img.name} 超过 5MB 限制。`);
              }
              const arrayBuffer = await img.arrayBuffer();
              const base64 = Buffer.from(arrayBuffer).toString("base64");
              const mimeType = guessImageMimeTypeFromName(img);
              const dataUrl = `data:${mimeType};base64,${base64}`;
              return extractContextFromImage({
                dataUrl,
                hint: graphHint,
                description: safeDescription,
                signal: req.signal,
              });
            }
          );

          const fileExtractions = await mapWithConcurrency(
            referenceFiles,
            3,
            async (file) => {
              if (file.size > FILE_MAX_BYTES) {
                throw new Error(`文件 ${file.name} 超过 5MB 限制。`);
              }

              const fileText = await fileToText(file);
              const MAX_FILE_CHARS = 25_000;
              const normalized = fileText.replace(/\u0000/g, " ").trim();
              const truncated =
                normalized.length > MAX_FILE_CHARS
                  ? normalized.slice(0, MAX_FILE_CHARS)
                  : normalized;

              const extracted =
                truncated.length > 0
                  ? await extractContextFromFileText({
                      fileText: truncated,
                      filename: file.name,
                      hint: graphHint,
                      description: safeDescription,
                      signal: req.signal,
                    })
                  : `文件名：${file.name}\n- 实体/角色：\n- 关系/流程：\n- 状态/条件（如有）：\n- 关键约束/术语：\n（未能从文档中提取可用文本）`;

              return extracted;
            }
          );

          const ctxParts: string[] = [];
          if (imageExtractions.length > 0) {
            ctxParts.push("【图片参考提取结果】");
            ctxParts.push(
              imageExtractions
                .map((t, i) => `- 图片${i + 1}：\n${t}`)
                .join("\n")
            );
          }
          if (fileExtractions.length > 0) {
            ctxParts.push("【文档参考提取结果】");
            ctxParts.push(
              fileExtractions
                .map((t, i) => `- 文件${i + 1}：\n${t}`)
                .join("\n")
            );
          }

          const built =
            ctxParts.length > 0
              ? ctxParts.join("\n") + "\n\n"
              : "";
          return built;
        };

        const referenceBlock = await buildReferenceBlock();
        const combinedDescription = `${referenceBlock}${safeDescription}`;

        const umlCode = await generateUMLCodeStream(
          combinedDescription,
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

        const filename = buildFilename();
        const storeOutput = shouldStoreOutput();

        // Persist .wsd file to <project-root>/output/ (server-side optional)
        if (storeOutput) {
          const outputDir = join(process.cwd(), "output");
          await mkdir(outputDir, { recursive: true });
          await writeFile(join(outputDir, filename), umlCode, "utf-8");
        }

        controller.enqueue(
          encoder.encode(
            `event: done\ndata: ${JSON.stringify({
              umlCode,
              imageUrl,
              filename,
              referenceContextText: referenceBlock,
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
