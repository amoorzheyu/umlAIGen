"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Clock, File } from "@phosphor-icons/react";

export interface HistoryItem {
  filename: string;
  createdAt: string;
  umlCode: string;
  imageUrl: string;
  size: number;
}

interface HistoryListProps {
  items: HistoryItem[];
  loading: boolean;
  onSelect: (item: HistoryItem) => void;
  onClose: () => void;
}

export default function HistoryList({
  items,
  loading,
  onSelect,
  onClose,
}: HistoryListProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-zinc-800 bg-zinc-900/98 backdrop-blur-md shadow-2xl shadow-black/40"
    >
      <div className="max-w-[1600px] mx-auto px-4 lg:px-6 py-4">
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
          <button
            onClick={onClose}
            className="flex items-center justify-center w-7 h-7 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-all duration-150"
          >
            <X size={14} />
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex gap-3 overflow-x-auto pb-2">
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
          <div className="flex gap-3 overflow-x-auto pb-2">
            <AnimatePresence>
              {items.map((item, idx) => (
                <motion.button
                  key={item.filename}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: idx * 0.04, duration: 0.2 }}
                  onClick={() => onSelect(item)}
                  className="flex-shrink-0 w-[180px] group relative rounded-xl border border-zinc-700/50 bg-zinc-800/60 hover:border-blue-500/50 hover:bg-zinc-800 transition-all duration-200 overflow-hidden active:scale-[0.98] text-left"
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
                    <p className="text-[10px] text-zinc-400 font-mono truncate leading-relaxed">
                      {item.createdAt}
                    </p>
                    <p className="text-[10px] text-zinc-600 font-mono">
                      {(item.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  {/* Hover overlay */}
                  <div className="absolute inset-0 border-2 border-blue-500/0 group-hover:border-blue-500/30 rounded-xl transition-all duration-200 pointer-events-none" />
                </motion.button>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </motion.div>
  );
}
