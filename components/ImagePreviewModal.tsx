"use client";

import { useEffect, useCallback, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "@phosphor-icons/react";

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
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, handleKeyDown]);

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

          <motion.button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.98 }}
            transition={springTransition}
            className="absolute top-4 right-4 w-10 h-10 rounded-xl bg-zinc-800/90 border border-zinc-700/60 text-zinc-300 hover:text-zinc-100 hover:bg-zinc-700/90 flex items-center justify-center shadow-lg"
            aria-label="关闭预览"
          >
            <X size={18} weight="bold" />
          </motion.button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
