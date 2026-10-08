import { MEMBERS, SEED } from "./config";

export type Kind = "量産OK" | "3Dプロト";

export interface PartData {
  owner: string;
  name: string;
  kind: Kind;
  order: number;
  /** 1色目・2色目・3色目の量産が終わったか（何色かは問わない） */
  c1: boolean;
  c2: boolean;
  c3: boolean;
  /** 3Dプロトで確認OKになり、量産に移ってきたか */
  fromProto: boolean;
  w: number | null;
  d: number | null;
  h: number | null;
  tapeDone: boolean;
  reported: boolean;
  note: string;
  updatedBy: string;
}
export interface Part extends PartData {
  id: string;
}
export type Patch = Partial<Omit<PartData, "order">>;

export const COLS = [
  ["c1", "1色目"],
  ["c2", "2色目"],
  ["c3", "3色目"],
] as const;
export type ColKey = (typeof COLS)[number][0];

export function blank(owner: string, name: string, kind: Kind, order: number): PartData {
  return { owner, name, kind, order, c1: false, c2: false, c3: false, fromProto: false, w: null, d: null, h: null, tapeDone: false, reported: false, note: "", updatedBy: "" };
}

/** 保存先から来たデータを、欠けたフィールドを既定値で埋めて Part にする */
export function normalize(id: string, raw: Record<string, unknown>): Part {
  const b = blank("", "", "3Dプロト", 0);
  const nOrNull = (v: unknown) => (typeof v === "number" && isFinite(v) ? v : null);
  return {
    id,
    owner: typeof raw.owner === "string" ? raw.owner : b.owner,
    name: typeof raw.name === "string" ? raw.name : b.name,
    kind: raw.kind === "量産OK" ? "量産OK" : "3Dプロト",
    order: typeof raw.order === "number" && isFinite(raw.order) ? raw.order : 0,
    c1: raw.c1 === true,
    c2: raw.c2 === true,
    c3: raw.c3 === true,
    fromProto: raw.fromProto === true,
    w: nOrNull(raw.w),
    d: nOrNull(raw.d),
    h: nOrNull(raw.h),
    tapeDone: raw.tapeDone === true,
    reported: raw.reported === true,
    note: typeof raw.note === "string" ? raw.note : "",
    updatedBy: typeof raw.updatedBy === "string" ? raw.updatedBy : "",
  };
}

export const isMass = (p: Pick<Part, "kind">) => p.kind === "量産OK";
export const nCol = (p: Pick<Part, ColKey>) => COLS.filter(([k]) => p[k]).length;
export const isDone = (p: Part) => isMass(p) && nCol(p) === 3;

export interface Stats {
  mass: number;
  proto: number;
  done: number;
  cols: number;
  colsAll: number;
  /** 0〜1。分母が0なら0 */
  ratio: number;
}
export function stats(parts: Part[]): Stats {
  const mass = parts.filter(isMass);
  const cols = mass.reduce((a, p) => a + nCol(p), 0);
  const colsAll = mass.length * 3;
  return {
    mass: mass.length,
    proto: parts.length - mass.length,
    done: mass.filter(isDone).length,
    cols,
    colsAll,
    ratio: colsAll ? cols / colsAll : 0,
  };
}

/** 担当者の並び：名簿の順、名簿にない人は登場順で末尾 */
export function owners(parts: Pick<Part, "owner">[]): string[] {
  const seen: string[] = [];
  for (const p of parts) if (p.owner && !seen.includes(p.owner)) seen.push(p.owner);
  return MEMBERS.filter((m) => seen.includes(m)).concat(seen.filter((m) => !MEMBERS.includes(m)));
}
/** 全メンバー＋名簿にない担当者 */
export function people(parts: Pick<Part, "owner">[]): string[] {
  return MEMBERS.concat(owners(parts).filter((m) => !MEMBERS.includes(m)));
}

/** 日本時間の今日から ymd までの日数 */
export function daysLeft(ymd: string, now = Date.now()): number {
  const [y, m, d] = ymd.split("-").map(Number);
  const jst = new Date(now + 9 * 3600 * 1000);
  const today = Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), jst.getUTCDate());
  return Math.round((Date.UTC(y, m - 1, d) - today) / 86400000);
}
export function leftText(ymd: string, now = Date.now()): string {
  const n = daysLeft(ymd, now);
  return n > 0 ? `あと${n}日` : n === 0 ? "今日まで" : "締切を過ぎています";
}

/** 数値欄の入力を検証する。空なら null、不正なら undefined */
export function parseSize(input: string): number | null | undefined {
  const t = input.trim().replace(/[０-９．]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
  if (t === "") return null;
  const n = Number(t);
  return isFinite(n) && n >= 0 ? n : undefined;
}

/** 初期データ（ID は p01〜p33 で固定。何度投入しても重複しない） */
export function seedDocs(): { id: string; data: PartData }[] {
  return SEED.map(([owner, name, kind], i) => ({ id: "p" + String(i + 1).padStart(2, "0"), data: blank(owner, name.trim(), kind, i + 1) }));
}
