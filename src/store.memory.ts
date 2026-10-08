import { normalize, type Part, type PartData, type Patch } from "./model";
import type { Store } from "./store";

/** Firebase の設定がないときの確認用。このブラウザの localStorage にだけ保存する */
export function memoryStore(key = "parts.local.v1", persist = true): Store {
  let docs: Record<string, PartData> = {};
  if (persist) {
    try {
      docs = JSON.parse(localStorage.getItem(key) || "{}");
    } catch {
      docs = {};
    }
  }
  const subs = new Set<(parts: Part[], info: { offline: boolean }) => void>();
  const save = () => {
    if (!persist) return;
    try {
      localStorage.setItem(key, JSON.stringify(docs));
    } catch {
      /* 保存できなくても動かす */
    }
  };
  const list = () =>
    Object.entries(docs)
      .map(([id, d]) => normalize(id, d as unknown as Record<string, unknown>))
      .sort((a, b) => a.order - b.order);
  const emit = () => queueMicrotask(() => subs.forEach((f) => f(list(), { offline: false })));
  let seq = 0;

  return {
    shared: false,
    subscribe(onChange) {
      subs.add(onChange);
      emit();
      return () => subs.delete(onChange);
    },
    async update(id, patch: Patch) {
      if (!docs[id]) throw Object.assign(new Error("not found"), { code: "not-found" });
      docs[id] = { ...docs[id], ...patch };
      save();
      emit();
    },
    async add(part) {
      const id = "m" + Date.now().toString(36) + (seq++).toString(36);
      docs[id] = part;
      save();
      emit();
      return id;
    },
    async seedIfEmpty(seed) {
      if (Object.keys(docs).length) return;
      for (const s of seed) if (!docs[s.id]) docs[s.id] = s.data;
      save();
      emit();
    },
  };
}
