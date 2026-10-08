import { describe, expect, it } from "vitest";
import { blank, daysLeft, isDone, leftText, nCol, normalize, owners, parseSize, people, seedDocs, stats } from "./model";

const part = (over: Record<string, unknown> = {}) => normalize("x", { ...blank("河合", "あめ", "量産OK", 1), ...over });

describe("派生値", () => {
  it("nCol は 1〜3色目のチェック数", () => {
    expect(nCol(part())).toBe(0);
    expect(nCol(part({ c1: true, c3: true }))).toBe(2);
  });
  it("isDone は量産OKで3つそろったときだけ", () => {
    expect(isDone(part({ c1: true, c2: true, c3: true }))).toBe(true);
    expect(isDone(part({ c1: true, c2: true }))).toBe(false);
    expect(isDone(part({ kind: "3Dプロト", c1: true, c2: true, c3: true }))).toBe(false);
  });
});

describe("normalize（欠損・不正なフィールド）", () => {
  it("欠けたフィールドは既定値", () => {
    const p = normalize("a", { owner: "館", name: "ねこ", kind: "量産OK", order: 3 });
    expect(p).toMatchObject({ c1: false, c2: false, c3: false, fromProto: false, w: null, note: "", tapeDone: false });
  });
  it("不明な kind は3Dプロト、数値でないサイズは null、true 以外は false", () => {
    const p = normalize("a", { kind: "?", w: "10", h: NaN, c1: "true" });
    expect(p.kind).toBe("3Dプロト");
    expect(p.w).toBeNull();
    expect(p.h).toBeNull();
    expect(p.c1).toBe(false);
  });
});

describe("集計", () => {
  it("分母0なら割合0", () => {
    expect(stats([])).toEqual({ mass: 0, proto: 0, done: 0, cols: 0, colsAll: 0, ratio: 0 });
  });
  it("量産OKだけを数える", () => {
    const s = stats([part({ c1: true, c2: true, c3: true }), part({ c1: true }), part({ kind: "3Dプロト", c1: true })]);
    expect(s).toMatchObject({ mass: 2, proto: 1, done: 1, cols: 4, colsAll: 6 });
    expect(s.ratio).toBeCloseTo(4 / 6);
  });
});

describe("担当者の並び", () => {
  it("名簿の順、名簿にない人は末尾", () => {
    expect(owners([{ owner: "山田" }, { owner: "新人" }, { owner: "河合" }, { owner: "山田" }])).toEqual(["河合", "山田", "新人"]);
    expect(people([{ owner: "新人" }]).slice(-2)).toEqual(["山田", "新人"]);
  });
});

describe("締切（日本時間）", () => {
  const jst = (s: string) => Date.parse(s + "+09:00");
  it("日本時間の日付で数える", () => {
    expect(daysLeft("2026-10-14", jst("2026-10-08T23:59:00"))).toBe(6);
    expect(daysLeft("2026-10-14", jst("2026-10-09T00:01:00"))).toBe(5);
    expect(leftText("2026-10-14", jst("2026-10-14T12:00:00"))).toBe("今日まで");
    expect(leftText("2026-10-14", jst("2026-10-15T00:00:00"))).toBe("締切を過ぎています");
  });
});

describe("サイズ入力", () => {
  it("空は null、全角は半角に、負や文字は不正", () => {
    expect(parseSize("")).toBeNull();
    expect(parseSize("２０")).toBe(20);
    expect(parseSize("12.5")).toBe(12.5);
    expect(parseSize("-1")).toBeUndefined();
    expect(parseSize("abc")).toBeUndefined();
  });
});

describe("初期データ", () => {
  it("33件、量産OK15・3Dプロト18、IDは p01〜p33", () => {
    const d = seedDocs();
    expect(d).toHaveLength(33);
    expect(d.filter((x) => x.data.kind === "量産OK")).toHaveLength(15);
    expect(d[0].id).toBe("p01");
    expect(d[32].id).toBe("p33");
    expect(d.find((x) => x.data.name.endsWith(" "))).toBeUndefined();
  });
});
