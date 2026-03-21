"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Clock, File, Trash, Warning } from "@phosphor-icons/react";
import type { UmlHint } from "./InputPanel";

export interface HistoryItem {
  filename: string;
  createdAt: string; // 兼容旧记录：由后端文件名解析得到
  umlCode: string;
  imageUrl: string;
  size: number;

  // 新增：IndexedDB 缓存的增强元信息
  question?: string;
  graphType?: UmlHint;
  askedAt?: number; // ms timestamp

  // 上传参考与抽取上下文（可选）
  referenceContextText?: string;
  referenceImages?: Array<{
    filename: string;
    mimeType: string;
    dataUrl: string;
    size: number;
  }>;
  referenceFiles?: Array<{
    filename: string;
    mimeType: string;
    size: number;
  }>;
}

interface HistoryListProps {
  items: HistoryItem[];
  loading: boolean;
  onSelect: (item: HistoryItem) => void;
  onClose: () => void;
  onDelete?: (item: HistoryItem) => void;
  onDeleteAll?: () => void;
  canDelete?: boolean;
}

export default function HistoryList({
  items,
  loading,
  onSelect,
  onClose,
  onDelete,
  onDeleteAll,
  canDelete = false,
}: HistoryListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [confirmDeleteItem, setConfirmDeleteItem] = useState<HistoryItem | null>(null);
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const scrollEl = scrollRef.current;
    if (!wrapper || !scrollEl) return;
    const handler = (e: WheelEvent) => {
      const delta = Math.abs(e.deltaX) > 0 ? e.deltaX : e.deltaY;
      if (Math.abs(delta) < 1) return;
      const maxScroll = scrollEl.scrollWidth - scrollEl.clientWidth;
      if (maxScroll <= 0) return;
      e.preventDefault();
      e.stopPropagation();
      scrollEl.scrollLeft += delta;
    };
    wrapper.addEventListener("wheel", handler, {
      passive: false,
      capture: true,
    });
    return () =>
      wrapper.removeEventListener("wheel", handler, { capture: true });
  }, []);

  const graphTypeLabel: Record<UmlHint, string> = {
    auto: "自动判断",
    sequence: "时序图",
    class: "类图",
    activity: "活动图",
    usecase: "用例图",
    state: "状态图",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-zinc-800 bg-zinc-900/98 backdrop-blur-md shadow-2xl shadow-black/40"
    >
      <div
        ref={wrapperRef}
        className="max-w-[1600px] mx-auto px-4 lg:px-6 py-4"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Clock size={15} className="text-zinc-500" />
            <h3 className="text-sm font-semibold text-zinc-300">历史记录</h3>
            {!loading && items.length > 0 && (
              <span className="text-xs text-zinc-600 font-mono">
                {items.length} 条
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {canDelete && items.length > 0 && onDeleteAll && (
              <button
                onClick={() => setConfirmClearAll(true)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-all duration-150 active:scale-[0.98]"
                title="清空全部历史"
              >
                <Trash size={12} />
                <span>清空全部</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="flex items-center justify-center w-7 h-7 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-all duration-150"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div
            ref={scrollRef}
            className="flex gap-3 overflow-x-scroll overflow-y-hidden pb-2"
          >
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="flex-shrink-0 w-[180px] h-[120px] rounded-xl shimmer"
              />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <File size={24} className="text-zinc-700" weight="duotone" />
            <p className="text-xs text-zinc-600">还没有生成记录</p>
          </div>
        ) : (
          <div
            ref={scrollRef}
            className="flex gap-3 overflow-x-scroll overflow-y-hidden pb-2"
          >
            <AnimatePresence>
              {items.map((item, idx) => (
                <motion.div
                  key={item.filename}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: idx * 0.04, duration: 0.2 }}
                  onClick={() => onSelect(item)}
                  className="flex-shrink-0 w-[180px] group relative rounded-xl border border-zinc-700/50 bg-zinc-800/60 hover:border-blue-500/50 hover:bg-zinc-800 transition-all duration-200 overflow-hidden active:scale-[0.98] text-left cursor-pointer"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelect(item);
                    }
                  }}
                  title={item.filename}
                >
                  {/* Thumbnail */}
                  <div className="h-[90px] bg-white/5 overflow-hidden flex items-center justify-center border-b border-zinc-700/50">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.imageUrl}
                      alt={item.filename}
                      className="w-full h-full object-contain p-1 opacity-80 group-hover:opacity-100 transition-opacity"
                    />
                  </div>
                  {/* Meta */}
                  <div className="p-2">
                    <p className="text-[10px] text-zinc-500 font-mono truncate leading-relaxed">
                      {item.question ? item.question : "未记录问题"}
                    </p>
                    <p className="text-[10px] text-zinc-600 font-mono truncate leading-relaxed">
                      {item.graphType ? graphTypeLabel[item.graphType] : "未记录图类型"}{" "}
                      •{" "}
                      {typeof item.askedAt === "number"
                        ? new Date(item.askedAt).toLocaleString("zh-CN", {
                            hour12: false,
                          })
                        : item.createdAt}
                    </p>
                    <p className="text-[10px] text-zinc-600 font-mono">
                      {(item.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  {/* Delete button (hover) */}
                  {canDelete && onDelete && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmDeleteItem(item);
                      }}
                      className="absolute top-1.5 right-1.5 w-6 h-6 rounded-md bg-zinc-900/90 border border-zinc-700/60 text-zinc-400 hover:text-red-400 hover:bg-red-500/20 hover:border-red-500/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-150 active:scale-[0.95] z-10"
                      title="删除此记录"
                    >
                      <Trash size={12} />
                    </button>
                  )}
                  {/* Hover overlay */}
                  <div className="absolute inset-0 border-2 border-blue-500/0 group-hover:border-blue-500/30 rounded-xl transition-all duration-200 pointer-events-none" />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* 删除单条确认 */}
      <AnimatePresence>
        {confirmDeleteItem && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setConfirmDeleteItem(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-xs rounded-xl border border-zinc-700 bg-zinc-900 p-5 shadow-xl shadow-black/50"
            >
              <p className="text-sm text-zinc-300">确定删除这条记录？</p>
              <p className="mt-1 text-xs text-zinc-500 font-mono truncate">
                {confirmDeleteItem.filename}
              </p>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmDeleteItem(null)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onDelete?.(confirmDeleteItem);
                    setConfirmDeleteItem(null);
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-red-600 hover:bg-red-500 transition-colors active:scale-[0.98]"
                >
                  删除
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 清空全部确认（更严肃） */}
      <AnimatePresence>
        {confirmClearAll && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={() => setConfirmClearAll(false)}
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
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-red-500/15 border border-red-500/30 flex items-center justify-center">
                  <Warning size={20} className="text-red-400" weight="fill" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-zinc-200">
                    清空全部历史记录
                  </h4>
                  <p className="mt-2 text-xs text-zinc-500 leading-relaxed">
                    此操作不可撤销，将永久删除本地所有历史记录。确定要继续吗？
                  </p>
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmClearAll(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onDeleteAll?.();
                    setConfirmClearAll(false);
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-red-600 hover:bg-red-500 transition-colors active:scale-[0.98]"
                >
                  全部删除
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
