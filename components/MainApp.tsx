"use client";

import { useState, useCallback, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ClockCounterClockwise,
  GithubLogo,
  Pulse,
} from "@phosphor-icons/react";
import InputPanel, { type UmlHint } from "./InputPanel";
import PreviewPanel from "./PreviewPanel";
import HistoryList, { type HistoryItem } from "./HistoryList";

export default function MainApp() {
  const [description, setDescription] = useState("");
  const [hint, setHint] = useState<UmlHint>("auto");
  const [umlCode, setUmlCode] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [filename, setFilename] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch("/api/history");
      const data = await res.json();
      setHistory(data.items ?? []);
    } catch {
      // silent
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    if (showHistory) fetchHistory();
  }, [showHistory, fetchHistory]);

  const handleGenerate = async () => {
    if (!description.trim() || isGenerating) return;

    setIsGenerating(true);
    setError(null);

    // Build full prompt with optional type hint
    const promptPrefix =
      hint !== "auto"
        ? `请生成一个${
            {
              sequence: "时序图",
              class: "类图",
              activity: "活动图",
              usecase: "用例图",
              state: "状态图",
            }[hint]
          }：`
        : "";

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: promptPrefix + description }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "生成失败，请重试");
      }

      const data = await res.json();
      setUmlCode(data.umlCode);
      setImageUrl(data.imageUrl);
      setFilename(data.filename);

      // Refresh history if panel is open
      if (showHistory) fetchHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "未知错误");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSelectHistory = (item: HistoryItem) => {
    setUmlCode(item.umlCode);
    setImageUrl(item.imageUrl);
    setFilename(item.filename);
    setDescription("");
    setError(null);
  };

  return (
    <div className="min-h-[100dvh] flex flex-col">
      {/* ── Header ──────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 flex items-center justify-between px-4 lg:px-6 h-14 border-b border-zinc-800/80 bg-[#09090b]/90 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-blue-500/15 border border-blue-500/30 flex items-center justify-center">
            <Pulse size={15} className="text-blue-400" weight="fill" />
          </div>
          <span className="text-sm font-semibold tracking-tight">
            UML<span className="text-blue-400">.</span>AI
          </span>
          <span className="hidden sm:inline-block text-xs text-zinc-600 font-medium border border-zinc-800 px-2 py-0.5 rounded-full">
            Generator
          </span>
        </div>

        <div className="flex items-center gap-2">
          <motion.button
            onClick={() => setShowHistory((v) => !v)}
            whileTap={{ scale: 0.96 }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 border ${
              showHistory
                ? "bg-zinc-800 border-zinc-600 text-zinc-200"
                : "bg-transparent border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-300"
            }`}
          >
            <ClockCounterClockwise size={14} />
            <span className="hidden sm:inline">历史记录</span>
          </motion.button>

          <a
            href="https://plantuml.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center w-8 h-8 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-all duration-150"
            title="PlantUML 文档"
          >
            <GithubLogo size={15} />
          </a>
        </div>
      </header>

      {/* ── Main content ────────────────────────────────────── */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-0 max-w-[1600px] w-full mx-auto">
        {/* Left: Input */}
        <div className="lg:border-r border-zinc-800/70 p-4 lg:p-6 lg:min-h-[calc(100dvh-56px)]">
          <InputPanel
            description={description}
            hint={hint}
            isGenerating={isGenerating}
            error={error}
            onChange={setDescription}
            onHintChange={setHint}
            onGenerate={handleGenerate}
          />
        </div>

        {/* Divider on mobile */}
        <div className="lg:hidden h-px bg-zinc-800/70 mx-4" />

        {/* Right: Preview */}
        <div className="p-4 lg:p-6">
          <PreviewPanel
            umlCode={umlCode}
            imageUrl={imageUrl}
            filename={filename}
            isGenerating={isGenerating}
          />
        </div>
      </main>

      {/* ── History drawer ───────────────────────────────────── */}
      <AnimatePresence>
        {showHistory && (
          <HistoryList
            items={history}
            loading={loadingHistory}
            onSelect={handleSelectHistory}
            onClose={() => setShowHistory(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
