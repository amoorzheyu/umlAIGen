export type GraphType =
  | "auto"
  | "sequence"
  | "class"
  | "activity"
  | "usecase"
  | "state";

export interface UmlAIGenIdbEntry {
  filename: string;
  createdAt: string; // YYYY-MM-DD HH:mm:ss (for UI)
  askedAt: number; // ms timestamp (client-side)
  question: string;
  graphType: GraphType;
  umlCode: string;
  remoteImageUrl: string; // plantuml png/svgs 的最终链接（备份/追溯用）
  imageDataUrl: string; // data:image/png;base64,...
  size: number; // bytes

  // 上传参考（可选）：用于历史复用生成时的上下文
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

const DB_NAME = "uml-ai-gen";
const DB_VERSION = 1;
const STORE_NAME = "history_images";

function formatFilenameDate(filename: string): string {
  // Format: YYYYMMDD_HHMMSS_mmm.wsd
  const base = filename.replace(".wsd", "");
  const parts = base.split("_");
  if (parts.length < 2) return filename;
  const [datePart, timePart] = parts;
  const y = datePart.slice(0, 4);
  const mo = datePart.slice(4, 6);
  const d = datePart.slice(6, 8);
  const h = timePart.slice(0, 2);
  const mi = timePart.slice(2, 4);
  const s = timePart.slice(4, 6);
  return `${y}-${mo}-${d} ${h}:${mi}:${s}`;
}

function openDb(): Promise<IDBDatabase> {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    return Promise.reject(new Error("IndexedDB 不可用"));
  }

  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "filename" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function putUmlAIGenEntry(partial: Omit<UmlAIGenIdbEntry, "createdAt">) {
  const db = await openDb();
  const entry: UmlAIGenIdbEntry = {
    ...partial,
    createdAt: formatFilenameDate(partial.filename),
  };

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(entry);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getUmlAIGenEntry(
  filename: string
): Promise<UmlAIGenIdbEntry | null> {
  const db = await openDb();

  return await new Promise<UmlAIGenIdbEntry | null>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(filename);
    req.onsuccess = () => resolve((req.result as UmlAIGenIdbEntry) ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function listUmlAIGenEntries(
  limit = 30
): Promise<UmlAIGenIdbEntry[]> {
  const db = await openDb();

  return await new Promise<UmlAIGenIdbEntry[]>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();

    req.onsuccess = () => {
      const all = (req.result as UmlAIGenIdbEntry[]) ?? [];
      all.sort((a, b) => b.askedAt - a.askedAt);
      resolve(all.slice(0, limit));
    };
    req.onerror = () => reject(req.error);
  });
}

