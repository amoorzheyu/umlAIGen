"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Image as ImageIcon,
  Code,
  Copy,
  Check,
  DownloadSimple,
  ArrowSquareOut,
  Graph,
} from "@phosphor-icons/react";

export type PreviewTab = "image" | "code";

interface PreviewPanelProps {
  umlCode: string;
  imageUrl: string;
  filename: string;
  isGenerating: boolean;
  activeTab: PreviewTab;
  onTabChange: (tab: PreviewTab) => void;
}

export default function PreviewPanel({
  umlCode,
  imageUrl,
  filename,
  isGenerating,
  activeTab,
  onTabChange,
}: PreviewPanelProps) {
  const [copied, setCopied] = useState(false);
  const [imgError, setImgError] = useState(false);

  // 当 imageUrl 被替换（例如从远程切到 IndexedDB dataUrl）时，清除旧错误状态
  useEffect(() => {
    setImgError(false);
  }, [imageUrl]);

  const isEmpty = !umlCode && !isGenerating;
  const shouldShowSkeleton = isGenerating && !umlCode;

  const handleCopy = async () => {
    if (!umlCode) return;
    await navigator.clipboard.writeText(umlCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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

  return (
    <motion.div
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1], delay: 0.05 }}
      className="h-full flex flex-col gap-3"
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
                <ActionButton onClick={handleCopy} title="复制代码" active={copied}>
                  {copied ? (
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
                <ActionButton onClick={handleDownloadImage} title="下载图片">
                  <DownloadSimple size={14} />
                </ActionButton>
                <a
                  href={imageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="在新窗口打开"
                  className="flex items-center justify-center w-8 h-8 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-all duration-150"
                >
                  <ArrowSquareOut size={14} />
                </a>
              </>
            )}
          </motion.div>
        )}
      </div>

      {/* Content area — fills remaining height, scrolls internally */}
      <div className="flex-1 min-h-0 bg-zinc-900 border border-zinc-700/60 rounded-xl overflow-hidden relative">
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
                />
              ) : (
                <CodeView umlCode={umlCode} />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

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
}: {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`flex items-center justify-center w-8 h-8 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-all duration-150 active:scale-95 ${
        active ? "text-green-400" : ""
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
}: {
  imageUrl: string;
  imgError: boolean;
  onError: () => void;
  onLoad: () => void;
}) {
  return (
    <div className="absolute inset-0 flex items-center justify-center p-4 overflow-auto">
      {imgError ? (
        <div className="text-center space-y-2 px-6">
          <p className="text-sm text-red-400 font-medium">图片加载失败</p>
          <p className="text-xs text-zinc-600 leading-relaxed">
            PlantUML 代码可能存在语法错误，或网络连接受限。
            <br />
            请切换至「PlantUML 代码」标签检查内容。
          </p>
          <a
            href={imageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 mt-2"
          >
            直接访问 PlantUML 链接
            <ArrowSquareOut size={12} />
          </a>
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt="UML diagram"
          onError={onError}
          onLoad={onLoad}
          className="max-w-full max-h-full object-contain rounded-lg"
          style={{ imageRendering: "crisp-edges" }}
        />
      )}
    </div>
  );
}

function CodeView({ umlCode }: { umlCode: string }) {
  return (
    <div className="absolute inset-0 overflow-auto">
      <pre className="p-5 text-xs text-zinc-300 font-mono leading-relaxed whitespace-pre-wrap break-words">
        {umlCode}
      </pre>
    </div>
  );
}
