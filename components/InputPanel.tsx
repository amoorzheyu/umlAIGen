"use client";

import { useRef, useEffect } from "react";
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
} from "@phosphor-icons/react";

export type UmlHint =
  | "auto"
  | "sequence"
  | "class"
  | "activity"
  | "usecase"
  | "state";

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
}

export default function InputPanel({
  description,
  hint,
  isGenerating,
  error,
  onChange,
  onHintChange,
  onGenerate,
}: InputPanelProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

      {/* Footer tip */}
      <p className="text-xs text-zinc-600 text-center">
        生成的 .wsd 文件自动保存至项目{" "}
        <code className="font-mono text-zinc-500">output/</code> 目录
      </p>
    </motion.div>
  );
}
