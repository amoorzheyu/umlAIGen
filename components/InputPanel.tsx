"use client";

import { useRef, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Lightning,
  Spinner,
  Plus,
  ArrowRight,
  Graph,
  TreeStructure,
  ArrowsLeftRight,
  CirclesThree,
  Stack,
  X,
  FileText,
} from "@phosphor-icons/react";

export type UmlHint =
  | "auto"
  | "sequence"
  | "class"
  | "activity"
  | "usecase"
  | "state";

export type ReferenceImagePreview = {
  id: string;
  filename: string;
  size: number;
  mimeType: string;
  dataUrl: string; // For thumbnail preview + replay
  file?: File; // Present only for newly selected uploads
};

export type ReferenceFilePreview = {
  id: string;
  filename: string;
  size: number;
  mimeType: string;
  file?: File; // Present only for newly selected uploads
};

const HINT_OPTIONS: { value: UmlHint; label: string; icon: React.ReactNode }[] =
  [
    { value: "auto", label: "自动判断", icon: <Lightning size={14} /> },
    { value: "sequence", label: "时序图", icon: <ArrowsLeftRight size={14} /> },
    { value: "class", label: "类图", icon: <TreeStructure size={14} /> },
    { value: "activity", label: "活动图", icon: <ArrowRight size={14} /> },
    { value: "usecase", label: "用例图", icon: <CirclesThree size={14} /> },
    { value: "state", label: "状态图", icon: <Stack size={14} /> },
  ];

const HINT_DESCRIPTION: Record<UmlHint, string> = {
  auto: "AI 根据描述自动选择最合适的图类型",
  sequence: "描述对象之间按时间顺序的交互",
  class: "描述类、属性、方法及类之间的关系",
  activity: "描述业务流程或算法的控制流",
  usecase: "描述系统功能与用户角色的关系",
  state: "描述对象在不同条件下的状态转换",
};

interface InputPanelProps {
  description: string;
  hint: UmlHint;
  isGenerating: boolean;
  error: string | null;
  onChange: (v: string) => void;
  onHintChange: (v: UmlHint) => void;
  onGenerate: () => void;

  referenceImages: ReferenceImagePreview[];
  referenceFiles: ReferenceFilePreview[];
  referenceContextText: string;
  onReferenceChange: (
    images: ReferenceImagePreview[],
    files: ReferenceFilePreview[]
  ) => void;
  onClearReferenceContext: () => void;
}

export default function InputPanel({
  description,
  hint,
  isGenerating,
  error,
  onChange,
  onHintChange,
  onGenerate,
  referenceImages,
  referenceFiles,
  referenceContextText,
  onReferenceChange,
  onClearReferenceContext,
}: InputPanelProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const referenceScrollRef = useRef<HTMLDivElement>(null);
  const referenceAreaRef = useRef<HTMLDivElement>(null);
  const [referenceError, setReferenceError] = useState<string | null>(null);

  useEffect(() => {
    const area = referenceAreaRef.current;
    const scrollEl = referenceScrollRef.current;
    if (!area || !scrollEl) return;
    const handler = (e: WheelEvent) => {
      const delta = Math.abs(e.deltaX) > 0 ? e.deltaX : e.deltaY;
      if (Math.abs(delta) < 1) return;
      const maxScroll = scrollEl.scrollWidth - scrollEl.clientWidth;
      if (maxScroll <= 0) return;
      e.preventDefault();
      e.stopPropagation();
      scrollEl.scrollLeft += delta;
    };
    area.addEventListener("wheel", handler, {
      passive: false,
      capture: true,
    });
    return () => area.removeEventListener("wheel", handler, { capture: true });
  }, []);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(el.scrollHeight, 160)}px`;
  }, [description]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      onGenerate();
    }
  };

  const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (isGenerating) return;
    const items = e.clipboardData?.items;
    if (!items) return;

    const imageFiles: File[] = [];
    const docFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind !== "file") continue;
      const file = item.getAsFile();
      if (!file) continue;
      if (item.type.startsWith("image/") || isProbablyImage(file)) {
        imageFiles.push(file);
      } else {
        docFiles.push(file);
      }
    }

    const allFiles = imageFiles.length + docFiles.length;
    if (allFiles === 0) return;

    e.preventDefault();
    setReferenceError(null);

    const existingIds = new Set([
      ...referenceImages.map((i) => i.id),
      ...referenceFiles.map((f) => f.id),
    ]);
    const seenIds = new Set<string>();
    let hasDuplicate = false;

    const nextImages: ReferenceImagePreview[] = [...referenceImages];
    const nextFiles: ReferenceFilePreview[] = [...referenceFiles];
    let nextTotal = currentTotalBytes;
    const MAX_ITEMS = 20;
    let nextCount =
      referenceImages.filter((i) => Boolean(i.file)).length +
      referenceFiles.filter((f) => Boolean(f.file)).length;

    for (const f of imageFiles) {
      const id = makeId(f);
      if (existingIds.has(id) || seenIds.has(id)) {
        hasDuplicate = true;
        continue;
      }
      seenIds.add(id);
      if (nextTotal + f.size > TOTAL_MAX_BYTES) {
        setReferenceError("参考资料总大小超过 10MB 限制。");
        continue;
      }
      if (f.size > IMAGE_MAX_BYTES) {
        setReferenceError(`图片 ${f.name} 超过 5MB 限制。`);
        continue;
      }
      if (nextCount + 1 > MAX_ITEMS) {
        setReferenceError("参考资料数量过多，请减少文件数。");
        continue;
      }
      nextTotal += f.size;
      nextCount += 1;
      const dataUrl = await fileToDataUrl(f);
      existingIds.add(id);
      nextImages.push({
        id,
        filename: f.name,
        size: f.size,
        mimeType: guessImageMimeType(f.name, f.type),
        dataUrl,
        file: f,
      });
    }

    for (const f of docFiles) {
      const id = makeId(f);
      if (existingIds.has(id) || seenIds.has(id)) {
        hasDuplicate = true;
        continue;
      }
      seenIds.add(id);
      if (nextTotal + f.size > TOTAL_MAX_BYTES) {
        setReferenceError("参考资料总大小超过 10MB 限制。");
        continue;
      }
      if (f.size > FILE_MAX_BYTES) {
        setReferenceError(`文件 ${f.name} 超过 5MB 限制。`);
        continue;
      }
      if (nextCount + 1 > MAX_ITEMS) {
        setReferenceError("参考资料数量过多，请减少文件数。");
        continue;
      }
      nextTotal += f.size;
      nextCount += 1;
      existingIds.add(id);
      nextFiles.push({
        id,
        filename: f.name,
        size: f.size,
        mimeType: f.type || "application/octet-stream",
        file: f,
      });
    }

    if (hasDuplicate) {
      setReferenceError("已上传，请勿重复上传");
    }
    if (
      nextImages.length > referenceImages.length ||
      nextFiles.length > referenceFiles.length
    ) {
      onReferenceChange(nextImages, nextFiles);
    }
  };

  const canSubmit = description.trim().length > 0 && !isGenerating;

  const IMAGE_MAX_BYTES = 5_000_000;
  const FILE_MAX_BYTES = 5_000_000;
  const TOTAL_MAX_BYTES = 10_000_000;

  const currentTotalBytes =
    referenceImages
      .filter((i) => Boolean(i.file))
      .reduce((s, i) => s + i.size, 0) +
    referenceFiles
      .filter((f) => Boolean(f.file))
      .reduce((s, f) => s + f.size, 0);

  const fileToDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error ?? new Error("读取失败"));
      reader.readAsDataURL(file);
    });

  const makeId = (file: File) =>
    `${file.name}_${file.size}_${file.lastModified}`;

  const guessImageMimeType = (fileName: string, type: string) => {
    if (type?.startsWith("image/")) return type;
    const lower = fileName.toLowerCase();
    if (lower.endsWith(".png")) return "image/png";
    if (lower.endsWith(".jpg") || lower.endsWith(".jpeg"))
      return "image/jpeg";
    if (lower.endsWith(".gif")) return "image/gif";
    if (lower.endsWith(".webp")) return "image/webp";
    if (lower.endsWith(".bmp")) return "image/bmp";
    if (lower.endsWith(".svg")) return "image/svg+xml";
    if (lower.endsWith(".tif") || lower.endsWith(".tiff")) return "image/tiff";
    return "image/*";
  };

  const isProbablyImage = (file: File) => {
    if (file.type?.startsWith("image/")) return true;
    return /\.(png|jpe?g|gif|webp|bmp|svg|tiff?)$/i.test(
      file.name.toLowerCase()
    );
  };

  const handleAddUploads = async (files: FileList | null) => {
    setReferenceError(null);
    if (!files || files.length === 0) return;

    const picked = Array.from(files);
    const nextImages: ReferenceImagePreview[] = [...referenceImages];
    const nextFiles: ReferenceFilePreview[] = [...referenceFiles];
    let nextTotal = currentTotalBytes;
    const MAX_ITEMS = 20;
    let nextCount =
      referenceImages.filter((i) => Boolean(i.file)).length +
      referenceFiles.filter((f) => Boolean(f.file)).length;

    for (const f of picked) {
      if (nextTotal + f.size > TOTAL_MAX_BYTES) {
        setReferenceError("参考资料总大小超过 10MB 限制。");
        continue;
      }

      const isImage = isProbablyImage(f);
      const perItemMaxBytes = isImage ? IMAGE_MAX_BYTES : FILE_MAX_BYTES;
      if (f.size > perItemMaxBytes) {
        setReferenceError(
          `${isImage ? "图片" : "文件"} ${f.name} 超过 5MB 限制。`
        );
        continue;
      }

      if (nextCount + 1 > MAX_ITEMS) {
        setReferenceError("参考资料数量过多，请减少文件数。");
        continue;
      }

      nextTotal += f.size;
      nextCount += 1;

      if (isImage) {
        const dataUrl = await fileToDataUrl(f);
        nextImages.push({
          id: makeId(f),
          filename: f.name,
          size: f.size,
          mimeType: guessImageMimeType(f.name, f.type),
          dataUrl,
          file: f,
        });
      } else {
        nextFiles.push({
          id: makeId(f),
          filename: f.name,
          size: f.size,
          mimeType: f.type || "application/octet-stream",
          file: f,
        });
      }
    }

    onReferenceChange(nextImages, nextFiles);
  };

  const handleRemoveImage = (id: string) => {
    setReferenceError(null);
    onReferenceChange(referenceImages.filter((i) => i.id !== id), referenceFiles);
  };

  const handleRemoveFile = (id: string) => {
    setReferenceError(null);
    onReferenceChange(
      referenceImages,
      referenceFiles.filter((f) => f.id !== id)
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col gap-4"
    >
      {/* Panel header */}
      <div className="flex items-center gap-2">
        <Graph size={18} className="text-blue-400" weight="duotone" />
        <h2 className="text-sm font-semibold text-zinc-300 tracking-tight">
          描述你的图表
        </h2>
      </div>

      {/* Textarea */}
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={description}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          disabled={isGenerating}
          placeholder={`用自然语言描述 UML 图表的内容…\n\n• 引用资源（图片、文档）可在此处直接粘贴\n• 例如：用户登录时序图、电商订单状态机、微服务架构类图\n• 支持 Ctrl+Enter 快捷生成`}
          className="w-full min-h-[160px] bg-zinc-900 border border-zinc-700/60 rounded-xl px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500/50 transition-all duration-200 font-sans resize-y disabled:opacity-50 disabled:cursor-not-allowed leading-relaxed"
          style={{ minHeight: 160 }}
        />
        <div className="absolute bottom-3 right-3 text-xs text-zinc-600 font-mono select-none">
          {description.length}
        </div>
      </div>

      {/* Hint type selector */}
      <div className="space-y-2">
        <p className="text-xs text-zinc-500 font-medium">图类型</p>
        <div className="flex flex-wrap gap-2">
          {HINT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onHintChange(opt.value)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 border active:scale-[0.97] ${
                hint === opt.value
                  ? "bg-blue-500/15 border-blue-500/50 text-blue-300"
                  : "bg-zinc-900 border-zinc-700/50 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300"
              }`}
            >
              {opt.icon}
              {opt.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-zinc-600 leading-relaxed">
          {HINT_DESCRIPTION[hint]}
        </p>
      </div>

      {/* Error display */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-2 px-3 py-2.5 bg-red-500/10 border border-red-500/30 rounded-lg"
        >
          <span className="text-red-400 text-xs mt-0.5 flex-shrink-0">!</span>
          <p className="text-xs text-red-300 leading-relaxed">{error}</p>
        </motion.div>
      )}

      {/* Generate button */}
      <motion.button
        onClick={onGenerate}
        disabled={!canSubmit}
        whileTap={canSubmit ? { scale: 0.98 } : {}}
        className={`relative flex items-center justify-center gap-2 w-full py-3 rounded-xl font-semibold text-sm transition-all duration-200 overflow-hidden ${
          canSubmit
            ? "bg-blue-500 hover:bg-blue-400 text-white shadow-lg shadow-blue-500/20 active:-translate-y-[1px]"
            : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
        }`}
      >
        {isGenerating ? (
          <>
            <Spinner size={16} className="animate-spin" />
            AI 正在生成…
          </>
        ) : (
          <>
            <Lightning size={16} weight="fill" />
            生成 UML 图表
            <span className="ml-1 text-xs opacity-60 font-normal">
              Ctrl+Enter
            </span>
          </>
        )}
      </motion.button>

      {/* Reference uploader */}
      <div ref={referenceAreaRef} className="flex flex-col gap-3 pt-1">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-zinc-400" />
            <p className="text-xs text-zinc-500 font-medium">参考资料（可选）</p>
          </div>
          <p className="text-[11px] text-zinc-600 font-mono">
            总大小：{Math.round((currentTotalBytes / 1024 / 1024) * 10) / 10}MB /{" "}
            {Math.round(TOTAL_MAX_BYTES / 1024 / 1024 * 10) / 10}MB
          </p>
        </div>

        {referenceContextText.trim() ? (
          <div className="flex items-start justify-between gap-3 px-3 py-2 rounded-lg border border-blue-500/30 bg-blue-500/10">
            <p className="text-[11px] text-blue-200 leading-relaxed">
              已加载参考资料的抽取上下文，可直接复用生成。
            </p>
            <button
              type="button"
              onClick={onClearReferenceContext}
              className="shrink-0 px-2 py-1 rounded-md text-[11px] text-blue-200 border border-blue-500/30 hover:bg-blue-500/15 transition-all duration-150 active:scale-[0.98]"
            >
              清空上下文
            </button>
          </div>
        ) : null}

        {/* Mixed uploader */}
        <div className="flex flex-col gap-2">
          <p className="text-[11px] text-zinc-600 font-medium">
            图片/文件参考（后端按后缀自动识别）
          </p>
          <input
            ref={uploadInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => void handleAddUploads(e.target.files)}
          />

          <div
            ref={referenceScrollRef}
            className="flex gap-2 overflow-x-scroll overflow-y-hidden pb-1 min-w-0"
          >
            <button
              type="button"
              onClick={() => uploadInputRef.current?.click()}
              className="flex-shrink-0 w-28 h-28 rounded-xl border border-zinc-700/50 bg-zinc-900/30 hover:border-zinc-600 hover:bg-zinc-900/45 transition-all duration-150 active:scale-[0.98] focus:outline-none focus:ring-1 focus:ring-blue-500/50 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="上传图片或文件"
              title="上传图片或文件"
              disabled={isGenerating}
            >
              <Plus size={22} className="text-zinc-400" />
            </button>
            {referenceImages.map((img) => (
              <div
                key={`image_${img.id}`}
                className="relative flex-shrink-0 w-28 h-28 rounded-xl border border-zinc-700/50 bg-zinc-800/40 overflow-hidden"
                title={img.filename}
              >
                <button
                  type="button"
                  aria-label={`移除 ${img.filename}`}
                  onClick={() => handleRemoveImage(img.id)}
                  className="absolute top-1.5 left-1.5 z-10 w-7 h-7 rounded-md bg-zinc-900/70 border border-zinc-700/60 hover:bg-zinc-900/90 transition-all duration-150 active:scale-[0.98] flex items-center justify-center"
                >
                  <X size={14} className="text-zinc-200" />
                </button>
                <div className="absolute inset-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.dataUrl}
                    alt={img.filename}
                    className="w-full h-full object-cover opacity-90"
                  />
                </div>
                <div className="absolute left-0 right-0 bottom-0 p-2.5 bg-black/30 pointer-events-none">
                  <div className="flex flex-col gap-1.5">
                    <p className="text-[10px] text-zinc-200 font-mono truncate leading-tight">
                      {img.filename}
                    </p>
                    <p className="text-[9px] text-zinc-200/70 font-mono leading-tight">
                      {Math.round((img.size / 1024) * 10) / 10} KB
                    </p>
                  </div>
                </div>
              </div>
            ))}

            {referenceFiles.map((f) => (
              <div
                key={`file_${f.id}`}
                className="relative flex-shrink-0 w-28 h-28 rounded-xl border border-zinc-700/50 bg-zinc-800/40 overflow-hidden px-2 py-2"
                title={f.filename}
              >
                <button
                  type="button"
                  aria-label={`移除 ${f.filename}`}
                  onClick={() => handleRemoveFile(f.id)}
                  className="absolute top-1.5 left-1.5 z-10 w-7 h-7 rounded-md bg-zinc-900/70 border border-zinc-700/60 hover:bg-zinc-900/90 transition-all duration-150 active:scale-[0.98] flex items-center justify-center"
                >
                  <X size={14} className="text-zinc-200" />
                </button>

                <div className="absolute left-0 right-0 bottom-0 p-2.5 bg-black/25 pointer-events-none">
                  <div className="flex flex-col items-start gap-1.5">
                    <FileText
                      size={18}
                      className="text-zinc-400 -translate-y-[12px]"
                    />
                    <p className="text-[10px] text-zinc-200 font-mono truncate leading-tight w-full">
                      {f.filename}
                    </p>
                    <p className="text-[9px] text-zinc-200/70 font-mono leading-tight">
                      {Math.round((f.size / 1024) * 10) / 10} KB
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {referenceError ? (
          <div className="text-xs text-red-300 px-3 py-2 rounded-lg border border-red-500/30 bg-red-500/10">
            {referenceError}
          </div>
        ) : null}
      </div>

    </motion.div>
  );
}
