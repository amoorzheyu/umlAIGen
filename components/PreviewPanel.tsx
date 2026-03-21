"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Image as ImageIcon,
  Code,
  Copy,
  Check,
  DownloadSimple,
  ArrowSquareOut,
  Graph,
  MagnifyingGlassPlus,
  Wrench,
} from "@phosphor-icons/react";
import ImagePreviewModal from "./ImagePreviewModal";
import { getUmlAIGenEntry } from "@/lib/umlAIGenIdb";

export type PreviewTab = "image" | "code";

interface PreviewPanelProps {
  umlCode: string;
  imageUrl: string;
  filename: string;
  isGenerating: boolean;
  activeTab: PreviewTab;
  onTabChange: (tab: PreviewTab) => void;
  onUMLFixed?: (result: { umlCode: string; imageUrl: string }) => void;
}

export default function PreviewPanel({
  umlCode,
  imageUrl,
  filename,
  isGenerating,
  activeTab,
  onTabChange,
  onUMLFixed,
}: PreviewPanelProps) {
  const [codeCopied, setCodeCopied] = useState(false);
  const [imageCopied, setImageCopied] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [isFixing, setIsFixing] = useState(false);
  const [fixError, setFixError] = useState<string | null>(null);
  const [showFixConfirm, setShowFixConfirm] = useState(false);

  // 当 imageUrl 被替换（例如从远程切到 IndexedDB dataUrl）时，清除旧错误状态
  useEffect(() => {
    setImgError(false);
  }, [imageUrl]);

  const isEmpty = !umlCode && !isGenerating;
  const shouldShowSkeleton = isGenerating && !umlCode;

  const handleCopy = async () => {
    if (!umlCode) return;
    await navigator.clipboard.writeText(umlCode);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const handleDownloadCode = () => {
    if (!umlCode) return;
    const blob = new Blob([umlCode], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename || `uml_${Date.now()}.wsd`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadImage = () => {
    if (!imageUrl) return;
    const a = document.createElement("a");
    a.href = imageUrl;
    a.download = (filename || "diagram").replace(".wsd", ".png");
    // dataUrl 直接下载更可靠；远程链接再打开新窗口
    if (!imageUrl.startsWith("data:")) a.target = "_blank";
    a.click();
  };

  // data URL 无法用 target="_blank" 直接打开（浏览器安全策略），需写入新窗口
  const handleOpenInNewWindow = () => {
    if (!imageUrl) return;
    if (imageUrl.startsWith("data:")) {
      const w = window.open("", "_blank");
      if (w) {
        const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#18181b"><img src="${imageUrl}" alt="UML diagram" style="max-width:100%;max-height:100vh;object-fit:contain"></body></html>`;
        w.document.write(html);
        w.document.close();
      }
    } else {
      window.open(imageUrl, "_blank", "noopener,noreferrer");
    }
  };

  const handleFixUMLRequest = () => {
    if (!umlCode || !imageUrl || !onUMLFixed || isFixing || isGenerating)
      return;
    setShowFixConfirm(true);
  };

  const performFixUML = async () => {
    if (!umlCode || !imageUrl || !onUMLFixed) return;
    setShowFixConfirm(false);
    setIsFixing(true);
    setFixError(null);

    try {
      let dataUrl = imageUrl;
      if (!imageUrl.startsWith("data:")) {
        // 优先使用 IndexedDB 本地缓存，避免重复拉取
        if (filename) {
          const cached = await getUmlAIGenEntry(filename);
          if (cached?.imageDataUrl) {
            dataUrl = cached.imageDataUrl;
          }
        }
        if (!dataUrl.startsWith("data:")) {
          const base64Res = await fetch("/api/image-base64", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ imageUrl }),
          });
          const payload = (await base64Res.json()) as {
            dataUrl?: string;
            error?: string;
          };
          if (payload?.dataUrl) {
            dataUrl = payload.dataUrl;
          } else if (!base64Res.ok) {
            throw new Error(payload?.error ?? "图片转换失败");
          } else {
            throw new Error("图片数据无效");
          }
        }
      }

      const fixRes = await fetch("/api/fix-uml", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ umlCode, imageDataUrl: dataUrl }),
      });

      if (!fixRes.ok) {
        const err = (await fixRes.json()) as { error?: string };
        throw new Error(err?.error ?? "修复失败，请重试");
      }

      const result = (await fixRes.json()) as {
        umlCode?: string;
        imageUrl?: string;
      };
      if (result?.umlCode && result?.imageUrl) {
        onUMLFixed({ umlCode: result.umlCode, imageUrl: result.imageUrl });
      } else {
        throw new Error("修复结果无效");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "修复失败";
      setFixError(msg);
      setTimeout(() => setFixError(null), 4000);
    } finally {
      setIsFixing(false);
    }
  };

  const handleCopyImage = async () => {
    if (!imageUrl) return;
    try {
      const img = new Image();
      const blob = await new Promise<Blob>((resolve, reject) => {
        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            reject(new Error("Canvas context unavailable"));
            return;
          }
          ctx.drawImage(img, 0, 0);
          canvas.toBlob(
            (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
            "image/png"
          );
        };
        img.onerror = () => reject(new Error("Image load failed"));
        img.crossOrigin = imageUrl.startsWith("data:") ? "" : "anonymous";
        img.src = imageUrl;
      });
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
      setImageCopied(true);
      setTimeout(() => setImageCopied(false), 2000);
    } catch {
      // 复制失败静默忽略
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1], delay: 0.05 }}
      className="h-full min-h-[200px] flex flex-col gap-3"
    >
      {/* Tabs + actions */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-1 p-1 bg-zinc-900 rounded-lg border border-zinc-800">
          {(["image", "code"] as PreviewTab[]).map((t) => (
            <button
              key={t}
              onClick={() => onTabChange(t)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150 ${
                activeTab === t
                  ? "bg-zinc-700 text-zinc-100 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {t === "image" ? <ImageIcon size={13} /> : <Code size={13} />}
              {t === "image" ? "预览" : "PlantUML 代码"}
            </button>
          ))}
        </div>

        {umlCode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-1"
          >
            {activeTab === "code" ? (
              <>
                <ActionButton onClick={handleCopy} title="复制代码" active={codeCopied}>
                  {codeCopied ? (
                    <Check size={14} className="text-green-400" />
                  ) : (
                    <Copy size={14} />
                  )}
                </ActionButton>
                <ActionButton onClick={handleDownloadCode} title="下载 .wsd 文件">
                  <DownloadSimple size={14} />
                </ActionButton>
              </>
            ) : (
              <>
                {onUMLFixed && (
                  <ActionButton
                    onClick={handleFixUMLRequest}
                    title="AI 修复语法"
                    disabled={isFixing}
                  >
                    {isFixing ? (
                      <span className="inline-block size-3.5 animate-spin rounded-full border-2 border-zinc-500 border-t-zinc-200" />
                    ) : (
                      <Wrench size={14} weight="bold" />
                    )}
                  </ActionButton>
                )}
                <ActionButton
                  onClick={() => setPreviewOpen(true)}
                  title="放大预览"
                >
                  <MagnifyingGlassPlus size={14} weight="bold" />
                </ActionButton>
                <ActionButton onClick={handleCopyImage} title="复制图片" active={imageCopied}>
                  {imageCopied ? (
                    <Check size={14} className="text-green-400" />
                  ) : (
                    <Copy size={14} />
                  )}
                </ActionButton>
                <ActionButton onClick={handleDownloadImage} title="下载图片">
                  <DownloadSimple size={14} />
                </ActionButton>
                <ActionButton
                  onClick={handleOpenInNewWindow}
                  title="在新窗口打开"
                >
                  <ArrowSquareOut size={14} />
                </ActionButton>
              </>
            )}
          </motion.div>
        )}
      </div>

      {/* Content area — fills remaining height, scrolls internally; min-h on mobile for visibility */}
      <div className="flex-1 min-h-[160px] lg:min-h-0 bg-zinc-900 border border-zinc-700/60 rounded-xl overflow-hidden relative">
        <AnimatePresence mode="wait">
          {shouldShowSkeleton ? (
            <LoadingSkeleton key="loading" />
          ) : isEmpty ? (
            <EmptyState key="empty" />
          ) : (
            <motion.div
              key={`content-${activeTab}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="absolute inset-0"
            >
              {activeTab === "image" ? (
                <ImageView
                  imageUrl={imageUrl}
                  imgError={imgError}
                  onError={() => setImgError(true)}
                  onLoad={() => setImgError(false)}
                  onPreview={() => setPreviewOpen(true)}
                  onOpenInNewWindow={handleOpenInNewWindow}
                />
              ) : (
                <CodeView umlCode={umlCode} />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {imageUrl && (
        <ImagePreviewModal
          isOpen={previewOpen}
          imageUrl={imageUrl}
          onClose={() => setPreviewOpen(false)}
        />
      )}

      {/* 修复确认弹窗 */}
      <AnimatePresence>
        {showFixConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowFixConfirm(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-xl border border-zinc-700 bg-zinc-900 p-6 shadow-xl shadow-black/50"
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                  <Wrench size={20} className="text-emerald-400" weight="bold" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-zinc-200">
                    AI 修复语法
                  </h4>
                  <p className="mt-2 text-xs text-zinc-500 leading-relaxed">
                    将当前 PlantUML 代码和报错截图发送给模型，仅修复语法错误，尽量不改变原逻辑。确定继续？
                  </p>
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowFixConfirm(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors active:scale-[0.98]"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={() => void performFixUML()}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-500 transition-colors active:scale-[0.98]"
                >
                  确定
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 复制成功 / 修复失败提示 */}
      <AnimatePresence>
        {(codeCopied || imageCopied) && !fixError && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2 rounded-xl bg-zinc-800/95 border border-zinc-600/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] px-4 py-2.5 text-sm text-zinc-200"
          >
            <Check size={16} weight="bold" className="text-emerald-400 flex-shrink-0" />
            <span>已复制到剪贴板</span>
          </motion.div>
        )}
        {fixError && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2 rounded-xl bg-zinc-800/95 border border-red-500/50 px-4 py-2.5 text-sm text-red-300"
          >
            <span>{fixError}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filename badge */}
      {filename && !isGenerating && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex-shrink-0 text-xs text-zinc-600 text-right font-mono"
        >
          {filename}
        </motion.p>
      )}
    </motion.div>
  );
}

/* ── Sub-components ─────────────────────────────────────── */

function ActionButton({
  onClick,
  title,
  children,
  active,
  disabled,
}: {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={`flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-150 active:scale-95 ${
        disabled
          ? "text-zinc-600 cursor-not-allowed"
          : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800" + (active ? " text-green-400" : "")
      }`}
    >
      {children}
    </button>
  );
}

function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-8 text-center"
    >
      <div className="w-16 h-16 rounded-2xl bg-zinc-800/60 border border-zinc-700/40 flex items-center justify-center">
        <Graph size={28} className="text-zinc-600" weight="duotone" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-zinc-400">等待生成</p>
        <p className="text-xs text-zinc-600 max-w-[260px] leading-relaxed">
          在左侧输入描述，点击「生成 UML 图表」按钮，AI 将为你创建 PlantUML
          图表并渲染预览
        </p>
      </div>
    </motion.div>
  );
}

function LoadingSkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 p-6 flex flex-col gap-3"
    >
      <div className="shimmer h-4 w-1/3 rounded-lg" />
      <div className="shimmer h-4 w-2/3 rounded-lg" />
      <div className="shimmer flex-1 rounded-xl mt-2" />
      <div className="shimmer h-4 w-1/2 rounded-lg" />
      <p className="text-xs text-zinc-600 text-center mt-2 animate-pulse">
        AI 正在生成 PlantUML 代码并渲染图表…
      </p>
    </motion.div>
  );
}

function ImageView({
  imageUrl,
  imgError,
  onError,
  onLoad,
  onPreview,
  onOpenInNewWindow,
}: {
  imageUrl: string;
  imgError: boolean;
  onError: () => void;
  onLoad: () => void;
  onPreview: () => void;
  onOpenInNewWindow?: () => void;
}) {
  const isLoading = !imageUrl;

  return (
    <div className="absolute inset-0 overflow-auto overscroll-contain p-4 min-h-0">
      {isLoading ? (
        <div className="flex min-h-full items-center justify-center">
          <div className="text-center space-y-3">
            <span className="inline-block size-6 animate-spin rounded-full border-2 border-zinc-500 border-t-zinc-200" />
            <p className="text-xs text-zinc-500">正在加载图片…</p>
          </div>
        </div>
      ) : imgError ? (
        <div className="flex min-h-full items-center justify-center">
          <div className="text-center space-y-2 px-6">
            <p className="text-sm text-red-400 font-medium">图片加载失败</p>
            <p className="text-xs text-zinc-600 leading-relaxed">
              PlantUML 代码可能存在语法错误，或网络连接受限。
              <br />
              请切换至「PlantUML 代码」标签检查内容。
            </p>
            {imageUrl && onOpenInNewWindow && (
              <button
                type="button"
                onClick={onOpenInNewWindow}
                className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 mt-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 rounded"
              >
                {imageUrl.startsWith("data:")
                  ? "在新窗口打开"
                  : "直接访问 PlantUML 链接"}
                <ArrowSquareOut size={12} />
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex min-h-full min-w-full flex-col items-center justify-center gap-0">
          <motion.button
            type="button"
            onClick={onPreview}
            whileTap={{ scale: 0.98 }}
            transition={{
              type: "spring",
              stiffness: 100,
              damping: 20,
            }}
            className="group relative block rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 shrink-0"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt="UML diagram"
              onError={onError}
              onLoad={onLoad}
              className="max-w-full w-auto h-auto object-contain rounded-lg cursor-zoom-in block"
              style={{ imageRendering: "crisp-edges" }}
              draggable={false}
            />
            <span className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-lg bg-zinc-800/90 px-2.5 py-1.5 text-[11px] text-zinc-400 opacity-0 transition-opacity duration-200 group-hover:opacity-100 border border-zinc-700/50">
              <MagnifyingGlassPlus size={12} weight="bold" />
              点击放大预览
            </span>
          </motion.button>
          {/* 底部留空，确保向下滚动能看到完整图片 */}
          <div className="h-4 shrink-0" aria-hidden="true" />
        </div>
      )}
    </div>
  );
}

function CodeView({ umlCode }: { umlCode: string }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // 代码流式生成时自动滚动到底部，始终显示最新输出
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !umlCode) return;
    el.scrollTop = el.scrollHeight - el.clientHeight;
  }, [umlCode]);

  return (
    <div
      ref={scrollRef}
      className="absolute inset-0 overflow-auto overscroll-contain scrollbar-hide"
    >
      <pre className="p-5 text-xs text-zinc-300 font-mono leading-relaxed whitespace-pre-wrap break-words">
        {umlCode}
      </pre>
    </div>
  );
}
