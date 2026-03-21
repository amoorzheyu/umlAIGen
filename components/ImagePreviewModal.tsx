"use client";

import { useEffect, useCallback, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Copy, Check } from "@phosphor-icons/react";

interface ImagePreviewModalProps {
  isOpen: boolean;
  imageUrl: string;
  onClose: () => void;
}

const springTransition = {
  type: "spring" as const,
  stiffness: 100,
  damping: 20,
};

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 4;
const ZOOM_STEP = 0.15;

export default function ImagePreviewModal({
  isOpen,
  imageUrl,
  onClose,
}: ImagePreviewModalProps) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const didDragRef = useRef(false);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const startPanRef = useRef({ x: 0, y: 0 });

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !isOpen) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      setZoom((prev) => {
        const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
        return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, prev + delta));
      });
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, [isOpen]);

  useEffect(() => {
    if (zoom <= 1) setPan({ x: 0, y: 0 });
  }, [zoom]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (zoom <= 1) return;
    isDraggingRef.current = true;
    didDragRef.current = false;
    startXRef.current = e.clientX;
    startYRef.current = e.clientY;
    startPanRef.current = pan;
  }, [zoom, pan]);

  useEffect(() => {
    if (!isOpen) return;
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      didDragRef.current = true;
      const dx = e.clientX - startXRef.current;
      const dy = e.clientY - startYRef.current;
      setPan({
        x: startPanRef.current.x + dx,
        y: startPanRef.current.y + dy,
      });
    };
    const handleMouseUp = () => {
      isDraggingRef.current = false;
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setCopied(false);
    setCopyError(null);
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, handleKeyDown]);

  const handleCopyImage = useCallback(async () => {
    try {
      setCopyError(null);
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
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      setCopyError("复制失败");
    }
  }, [imageUrl]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex flex-col bg-zinc-950/85 backdrop-blur-sm"
        >
          <div
            ref={containerRef}
            className="flex-1 overflow-hidden flex items-center justify-center p-4 min-h-0 cursor-grab active:cursor-grabbing"
            onClick={(e) => {
              if (didDragRef.current) {
                e.stopPropagation();
                didDragRef.current = false;
              }
            }}
            onMouseDown={handleMouseDown}
          >
            <motion.div
              onClick={(e) => e.stopPropagation()}
              className="flex items-center justify-center origin-center touch-none"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={springTransition}
              style={{
                transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
                willChange: "transform",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl}
                alt="UML diagram 预览"
                className="max-w-[90vw] max-h-[85dvh] w-auto h-auto object-contain rounded-xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] ring-1 ring-white/5 select-none pointer-events-none"
                style={{ imageRendering: "crisp-edges" }}
                draggable={false}
              />
            </motion.div>
          </div>

          <div className="absolute top-4 right-4 flex items-center gap-2">
            <motion.button
              onClick={(e) => {
                e.stopPropagation();
                handleCopyImage();
              }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.98 }}
              transition={springTransition}
              className="w-10 h-10 rounded-xl bg-zinc-800/90 border border-zinc-700/60 text-zinc-300 hover:text-zinc-100 hover:bg-zinc-700/90 flex items-center justify-center shadow-lg"
              aria-label="复制图片"
              title={copied ? "已复制" : "复制图片"}
            >
              {copied ? (
                <Check size={18} weight="bold" className="text-emerald-400" />
              ) : (
                <Copy size={18} weight="bold" />
              )}
            </motion.button>
            <motion.button
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.98 }}
              transition={springTransition}
              className="w-10 h-10 rounded-xl bg-zinc-800/90 border border-zinc-700/60 text-zinc-300 hover:text-zinc-100 hover:bg-zinc-700/90 flex items-center justify-center shadow-lg"
              aria-label="关闭预览"
            >
              <X size={18} weight="bold" />
            </motion.button>
          </div>
          {copyError && (
            <p className="absolute top-16 right-4 text-xs text-red-400 bg-zinc-900/90 px-2 py-1 rounded-lg border border-red-500/30">
              {copyError}
            </p>
          )}
          <AnimatePresence>
            {copied && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-xl bg-zinc-800/95 border border-zinc-600/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] px-4 py-2.5 text-sm text-zinc-200"
              >
                <Check size={16} weight="bold" className="text-emerald-400 flex-shrink-0" />
                <span>已复制到剪贴板</span>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
