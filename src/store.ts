import type { Part, PartData, Patch } from "./model";

export type StoreErrorCode = "permission" | "network" | "unknown";
export interface StoreError {
  code: StoreErrorCode;
  message: string;
}

/** 画面はこのインターフェースだけを使う（Firebase の型を画面側に出さない） */
export interface Store {
  /** true なら他の人と共有される保存先。false は確認用（このブラウザだけ） */
  readonly shared: boolean;
  /** 全パーツを order 昇順で購読する。変更のたびに全件を渡す。解除関数を返す */
  subscribe(onChange: (parts: Part[], info: { offline: boolean }) => void, onError: (e: StoreError) => void): () => void;
  /** 変更した項目だけを書く */
  update(id: string, patch: Patch): Promise<void>;
  /** パーツを追加し、新しいIDを返す */
  add(part: PartData): Promise<string>;
  /** 保存先が空なら初期データを入れる。既にあるIDは上書きしない */
  seedIfEmpty(docs: { id: string; data: PartData }[]): Promise<void>;
}

export function toStoreError(e: unknown): StoreError {
  const code = (e as { code?: string })?.code ?? "";
  const message = (e as { message?: string })?.message ?? String(e);
  if (code.includes("permission-denied") || code.includes("unauthenticated")) return { code: "permission", message };
  if (code.includes("unavailable") || code.includes("network") || code.includes("deadline")) return { code: "network", message };
  return { code: "unknown", message };
}
