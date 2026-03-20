"use client";

import { useState, useCallback, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ClockCounterClockwise,
  GithubLogo,
  Pulse,
} from "@phosphor-icons/react";
import InputPanel, { type UmlHint } from "./InputPanel";
import PreviewPanel, { type PreviewTab } from "./PreviewPanel";
import HistoryList, { type HistoryItem } from "./HistoryList";
import {
  getUmlAIGenEntry,
  listUmlAIGenEntries,
  putUmlAIGenEntry,
} from "@/lib/umlAIGenIdb";

export default function MainApp() {
  const [description, setDescription] = useState("");
  const [hint, setHint] = useState<UmlHint>("auto");
  const [umlCode, setUmlCode] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [filename, setFilename] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Controlled tab state — lifted here so generation can switch to "code"
  const [activeTab, setActiveTab] = useState<PreviewTab>("image");

  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      // 以 IndexedDB 为主：后端只是备份（尽量不依赖它）
      let cached: Awaited<ReturnType<typeof listUmlAIGenEntries>> = [];
      try {
        cached = await listUmlAIGenEntries(30);
      } catch {
        cached = [];
      }
      if (cached.length > 0) {
        setHistory(
          cached.map((c) => ({
            filename: c.filename,
            createdAt: c.createdAt,
            umlCode: c.umlCode,
            imageUrl: c.imageDataUrl,
            size: c.size,
            question: c.question,
            graphType: c.graphType,
            askedAt: c.askedAt,
          }))
        );
        return;
      }

      // 没有本地缓存时，才读取后端备份（并在点击条目后补做 base64 缓存）
      const res = await fetch("/api/history");
      const data = await res.json();
      setHistory((data.items ?? []) as HistoryItem[]);
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

    const askedAt = Date.now();
    const askedQuestion = description;
    const askedGraphType = hint;

    setIsGenerating(true);
    setError(null);
    // Always switch to code tab immediately so user sees streamed output.
    setActiveTab("code");
    setUmlCode("");
    setImageUrl("");
    setFilename("");

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
        const text = await res.text();
        try {
          const err = JSON.parse(text);
          throw new Error(err.error ?? "生成失败，请重试");
        } catch {
          throw new Error(text || "生成失败，请重试");
        }
      }

      if (!res.body) throw new Error("响应体为空，无法流式读取");

      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        buffer = buffer.replace(/\r\n/g, "\n");

        let idx: number;
        while ((idx = buffer.indexOf("\n\n")) >= 0) {
          const eventBlock = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);

          if (!eventBlock.trim()) continue;

          const lines = eventBlock
            .split("\n")
            .map((l) => l.trim())
            .filter(Boolean);

          let eventType = "message";
          const dataParts: string[] = [];

          for (const line of lines) {
            if (line.startsWith("event:")) {
              eventType = line.slice(6).trim();
            } else if (line.startsWith("data:")) {
              dataParts.push(line.slice(5).trim());
            }
          }

          const dataStr = dataParts.join("\n");
          const payload = JSON.parse(dataStr || "{}") as any;

          if (eventType === "token" && payload.chunk) {
            setUmlCode((prev) => prev + payload.chunk);
          } else if (eventType === "done") {
            const nextUmlCode = payload.umlCode ?? "";
            const nextFilename = payload.filename ?? "";
            const nextRemoteImageUrl = payload.imageUrl ?? "";

            setUmlCode(nextUmlCode);
            setFilename(nextFilename);
            // 先用远程图快速展示；随后转成 base64 并用本地缓存覆盖。
            setImageUrl(nextRemoteImageUrl);
            setActiveTab("image");

            if (nextFilename && nextRemoteImageUrl) {
              try {
                const base64Res = await fetch("/api/image-base64", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ imageUrl: nextRemoteImageUrl }),
                });

                if (base64Res.ok) {
                  const base64Payload = (await base64Res.json()) as {
                    dataUrl: string;
                    size: number;
                  };

                  if (base64Payload?.dataUrl) {
                    setImageUrl(base64Payload.dataUrl);

                    await putUmlAIGenEntry({
                      filename: nextFilename,
                      askedAt,
                      question: askedQuestion,
                      graphType: askedGraphType,
                      umlCode: nextUmlCode,
                      remoteImageUrl: nextRemoteImageUrl,
                      imageDataUrl: base64Payload.dataUrl,
                      size: base64Payload.size ?? 0,
                    });
                  }
                }
              } catch {
                // 缓存失败不影响主流程（仍然保留远程预览）
              }
            }

            if (showHistory) {
              await fetchHistory();
            }
            return;
          } else if (eventType === "error") {
            throw new Error(payload.message ?? "生成失败，请重试");
          }
        }
      }
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
    setDescription(item.question ?? "");
    if (item.graphType) setHint(item.graphType);
    setError(null);
    setActiveTab("code");

    // 如果是远程链接（非 dataUrl），点击后补做 base64 缓存，保证展示走本地
    if (item.imageUrl && !item.imageUrl.startsWith("data:")) {
      (async () => {
        try {
          const cached = await getUmlAIGenEntry(item.filename);
          if (cached?.imageDataUrl) {
            setImageUrl(cached.imageDataUrl);
            return;
          }

          const askedAt = Date.now();

          const base64Res = await fetch("/api/image-base64", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ imageUrl: item.imageUrl }),
          });

          if (!base64Res.ok) return;
          const base64Payload = (await base64Res.json()) as {
            dataUrl?: string;
            size?: number;
          };

          if (!base64Payload?.dataUrl) return;

          // TS: `base64Payload.dataUrl` 在 json 解析后是可选类型，这里明确收窄为 string
          const nextImageDataUrl = base64Payload.dataUrl;
          setImageUrl(nextImageDataUrl);
          await putUmlAIGenEntry({
            filename: item.filename,
            askedAt,
            question: item.question ?? "",
            graphType: item.graphType ?? ("auto" as UmlHint),
            umlCode: item.umlCode,
            remoteImageUrl: item.imageUrl,
            imageDataUrl: nextImageDataUrl,
            size: base64Payload.size ?? item.size ?? 0,
          });

          // 同步刷新当前历史列表中该条目的缩略图/预览来源
          setHistory((prev) =>
            prev.map((h) =>
              h.filename === item.filename
                ? {
                    ...h,
                    imageUrl: nextImageDataUrl,
                    askedAt,
                    question: item.question ?? "",
                    graphType: item.graphType ?? ("auto" as UmlHint),
                  }
                : h
            )
          );
        } catch {
          // 补缓存失败不影响展示
        }
      })();
    }
  };

  return (
    // h-[100dvh] + overflow-hidden = no browser-level scroll ever
    <div className="h-[100dvh] overflow-hidden flex flex-col">
      {/* ── Header ──────────────────────────────────────────── */}
      <header className="flex-shrink-0 flex items-center justify-between px-4 lg:px-6 h-14 border-b border-zinc-800/80 bg-[#09090b]/90 backdrop-blur-md z-10 shadow-[0_10px_30px_-20px_rgba(0,0,0,0.7)]">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-blue-500/15 border border-blue-500/30 flex items-center justify-center">
            <Pulse size={15} className="text-blue-400" weight="fill" />
          </div>
          <span className="text-sm sm:text-base font-semibold tracking-tight">
            UML <span className="text-blue-400">AI</span> Generator
          </span>
          <span className="hidden sm:inline-flex items-center justify-center text-[11px] font-mono text-zinc-500 border border-zinc-800 px-2 py-0.5 rounded-full">
            uml-ai-gen
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
            href="https://github.com/amoorzheyu/umlAIGen"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center w-8 h-8 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-all duration-150"
            title="GitHub 仓库"
          >
            <GithubLogo size={15} />
          </a>
        </div>
      </header>

      {/* ── Main content ────────────────────────────────────── */}
      {/*
        Desktop: overflow-hidden, each column fills height and scrolls internally.
        Mobile: overflow-y-auto on the whole main area (single-column stacked layout).
      */}
      <main className="flex-1 min-h-0 overflow-y-auto lg:overflow-hidden grid grid-cols-1 lg:grid-cols-[420px_1fr]">
        {/* Left: Input — scrolls internally on desktop */}
        <div className="lg:h-full lg:overflow-y-auto lg:border-r border-zinc-800/70 p-4 lg:p-6">
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

        {/* Mobile divider */}
        <div className="lg:hidden h-px bg-zinc-800/70 mx-4" />

        {/* Right: Preview — fills height, content scrolls inside */}
        <div className="lg:h-full lg:overflow-hidden flex flex-col p-4 lg:p-6">
          <PreviewPanel
            umlCode={umlCode}
            imageUrl={imageUrl}
            filename={filename}
            isGenerating={isGenerating}
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />
        </div>
      </main>

      {/* ── History: fixed overlay at the bottom ─────────────── */}
      <AnimatePresence>
        {showHistory && (
          <>
            {/* Dim backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setShowHistory(false)}
              className="fixed inset-0 z-30 bg-black/30"
            />
            <HistoryList
              items={history}
              loading={loadingHistory}
              onSelect={handleSelectHistory}
              onClose={() => setShowHistory(false)}
            />
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
