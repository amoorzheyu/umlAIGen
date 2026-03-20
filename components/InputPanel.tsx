"use client";

import { useRef, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Lightning,
  Spinner,
  ArrowRight,
  Graph,
  TreeStructure,
  ArrowsLeftRight,
  CirclesThree,
  Stack,
  FileText,
  Image as ImageIcon,
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
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [referenceError, setReferenceError] = useState<string | null>(null);

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

  const handleAddImages = async (files: FileList | null) => {
    setReferenceError(null);
    if (!files || files.length === 0) return;

    const picked = Array.from(files);
    const validImages = picked.filter((f) => f.type.startsWith("image/"));

    if (validImages.length !== picked.length) {
      setReferenceError("图片只接受 image/* 类型。");
    }

    const next: ReferenceImagePreview[] = [...referenceImages];
    let nextTotal = currentTotalBytes;

    for (const f of validImages) {
      if (f.size > IMAGE_MAX_BYTES) {
        setReferenceError(`图片 ${f.name} 超过 5MB 限制。`);
        continue;
      }
      if (nextTotal + f.size > TOTAL_MAX_BYTES) {
        setReferenceError("参考资料总大小超过 10MB 限制。");
        continue;
      }
      nextTotal += f.size;
      const dataUrl = await fileToDataUrl(f);
      next.push({
        id: makeId(f),
        filename: f.name,
        size: f.size,
        mimeType: f.type || "image/*",
        dataUrl,
        file: f,
      });
    }

    onReferenceChange(next, referenceFiles);
  };

  const handleAddFiles = async (files: FileList | null) => {
    setReferenceError(null);
    if (!files || files.length === 0) return;

    const picked = Array.from(files);
    const next: ReferenceFilePreview[] = [...referenceFiles];
    let nextTotal = currentTotalBytes;

    for (const f of picked) {
      if (f.size > FILE_MAX_BYTES) {
        setReferenceError(`文件 ${f.name} 超过 5MB 限制。`);
        continue;
      }
      if (nextTotal + f.size > TOTAL_MAX_BYTES) {
        setReferenceError("参考资料总大小超过 10MB 限制。");
        continue;
      }
      nextTotal += f.size;
      next.push({
        id: makeId(f),
        filename: f.name,
        size: f.size,
        mimeType: f.type || "application/octet-stream",
        file: f,
      });
    }

    onReferenceChange(referenceImages, next);
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
          disabled={isGenerating}
          placeholder={`用自然语言描述 UML 图表的内容…\n\n例如：\n  • 用户登录系统的时序图，包含前端、后端和数据库\n  • 电商平台的订单状态机，包含待支付、已支付、发货中等状态\n  • 微服务架构的类图，包含用户服务、订单服务和商品服务`}
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
      <div className="flex flex-col gap-3 pt-1">
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

        {/* Images */}
        <div className="flex flex-col gap-2">
          <p className="text-[11px] text-zinc-600 font-medium">
            图片参考（单张不超过 5MB）
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 border border-zinc-700/50 bg-zinc-900/30 hover:border-zinc-600 hover:text-zinc-200 active:scale-[0.98]"
            >
              <ImageIcon size={14} />
              选择图片
            </button>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => void handleAddImages(e.target.files)}
            />
          </div>

          {referenceImages.length > 0 ? (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {referenceImages.map((img) => (
                <div
                  key={img.id}
                  className="flex-shrink-0 w-[150px] rounded-xl border border-zinc-700/50 bg-zinc-800/40 overflow-hidden"
                >
                  <div className="h-[80px] bg-white/5 flex items-center justify-center border-b border-zinc-700/50">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img.dataUrl}
                      alt={img.filename}
                      className="w-full h-full object-cover opacity-85"
                    />
                  </div>
                  <div className="p-2">
                    <p className="text-[10px] text-zinc-500 font-mono truncate">
                      {img.filename}
                    </p>
                    <p className="text-[10px] text-zinc-600 font-mono">
                      {Math.round((img.size / 1024) * 10) / 10} KB
                    </p>
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(img.id)}
                      className="mt-2 w-full px-2 py-1 rounded-md text-[11px] text-zinc-300 border border-zinc-700/50 hover:bg-zinc-700/30 transition-all duration-150 active:scale-[0.98]"
                    >
                      移除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        {/* Files */}
        <div className="flex flex-col gap-2">
          <p className="text-[11px] text-zinc-600 font-medium">
            文件参考（单个不超过 5MB）
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 border border-zinc-700/50 bg-zinc-900/30 hover:border-zinc-600 hover:text-zinc-200 active:scale-[0.98]"
            >
              <FileText size={14} />
              选择文件
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => void handleAddFiles(e.target.files)}
            />
          </div>

          {referenceFiles.length > 0 ? (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {referenceFiles.map((f) => (
                <div
                  key={f.id}
                  className="flex-shrink-0 w-[180px] rounded-xl border border-zinc-700/50 bg-zinc-800/40 overflow-hidden px-3 py-2"
                >
                  <p className="text-[11px] text-zinc-300 font-mono truncate">
                    {f.filename}
                  </p>
                  <p className="text-[10px] text-zinc-600 font-mono">
                    {Math.round((f.size / 1024) * 10) / 10} KB
                  </p>
                  <button
                    type="button"
                    onClick={() => handleRemoveFile(f.id)}
                    className="mt-2 w-full px-2 py-1 rounded-md text-[11px] text-zinc-300 border border-zinc-700/50 hover:bg-zinc-700/30 transition-all duration-150 active:scale-[0.98]"
                  >
                    移除
                  </button>
                </div>
              ))}
            </div>
          ) : null}
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
