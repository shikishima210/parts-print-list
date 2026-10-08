import { CAUTION_NAMES, DUE_MASS, MEMBERS } from "./config";
import { blank, COLS, isDone, isMass, leftText, nCol, owners, parseSize, people, seedDocs, stats, type Kind, type Part, type Patch } from "./model";
import type { Store, StoreError } from "./store";

type Attrs = Record<string, string | boolean | null | undefined | ((ev: Event) => void)>;
type Kid = Node | string | null | false | undefined;

/** 要素を作る。文字は必ず textContent で入れる（利用者の入力を HTML として解釈しない） */
function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs?: Attrs, kids?: Kid[]): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs ?? {})) {
    if (k === "text") e.textContent = String(v ?? "");
    else if (k === "class") e.className = String(v);
    else if (k.startsWith("on") && typeof v === "function") e.addEventListener(k.slice(2), v);
    else if (v === true) e.setAttribute(k, "");
    else if (v !== false && v != null) e.setAttribute(k, String(v));
  }
  for (const c of kids ?? []) if (c) e.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  return e;
}
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

function storageGet(k: string): string {
  try {
    return localStorage.getItem(k) ?? "";
  } catch {
    return "";
  }
}
function storageSet(k: string, v: string) {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* 使えなくても動かす */
  }
}

export function startApp(store: Store) {
  let parts: Part[] = [];
  let tab: Kind = "量産OK";
  let loaded = false;
  let me = storageGet("parts.me");
  let moved: { id: string; name: string } | null = null;
  let pending = false;
  const openIds = new Set<string>();
  const msgs = new Map<string, { text: string; err: boolean }>();
  let nodes = new Map<string, { el: HTMLElement; sig: string }>();

  if (!store.shared) $("local").hidden = false;

  const setMe = (v: string) => {
    me = v;
    storageSet("parts.me", v);
  };

  /* ===== 保存 ===== */
  function setMsg(id: string, text: string, err = false) {
    msgs.set(id, { text, err });
    const m = document.getElementById("m-" + id);
    if (m) {
      m.textContent = text;
      m.className = "save" + (err ? " err" : "");
    }
    if (text && text !== "保存中…") {
      const p = parts.find((x) => x.id === id);
      $("live").textContent = (p ? p.name + "：" : "") + text;
    }
    if (text === "保存しました")
      setTimeout(() => {
        if (msgs.get(id)?.text === text) setMsg(id, "");
      }, 2500);
  }
  function save(p: Part, patch: Patch) {
    const full = { ...patch, updatedBy: me };
    const local = parts.find((x) => x.id === p.id);
    if (local) Object.assign(local, full); // 楽観的更新
    setMsg(p.id, "保存中…");
    paintStats();
    store.update(p.id, full).then(
      () => setMsg(p.id, "保存しました"),
      (e: StoreError) => setMsg(p.id, e.code === "permission" ? "保存できません（編集権限がありません）" : "保存できませんでした。もう一度試してください", true),
    );
  }

  /* ===== 部品 ===== */
  function colCheck(p: Part, [key, label]: (typeof COLS)[number], row: HTMLElement) {
    const inp = el("input", { type: "checkbox", id: `c-${p.id}-${key}`, "aria-label": `${p.name} ${label}の量産が終わった` });
    inp.checked = p[key];
    const lab = el("label", { class: "col" + (p[key] ? " on" : ""), for: inp.id }, [inp, el("span", { class: "box" }), label]);
    inp.addEventListener("change", () => {
      lab.classList.toggle("on", inp.checked);
      save(p, { [key]: inp.checked });
      row.classList.toggle("done", isDone(p));
    });
    return lab;
  }
  function sizeField(p: Part, label: string, key: "w" | "d" | "h") {
    const inp = el("input", { type: "text", inputmode: "decimal", id: `f-${p.id}-${key}` });
    inp.value = p[key] == null ? "" : String(p[key]);
    inp.addEventListener("change", () => {
      const v = parseSize(inp.value);
      if (v === undefined) {
        inp.value = p[key] == null ? "" : String(p[key]);
        setMsg(p.id, "0以上の数値を入力してください", true);
        return;
      }
      save(p, { [key]: v });
    });
    return el("label", { class: "f", for: inp.id }, [label, inp]);
  }
  function textField(p: Part, label: string, key: "note" | "name", required = false) {
    const inp = el("input", { type: "text", id: `f-${p.id}-${key}`, maxlength: key === "note" ? "500" : "40" });
    inp.value = p[key];
    inp.addEventListener("change", () => {
      const v = inp.value.trim();
      if (required && !v) {
        inp.value = p[key];
        setMsg(p.id, `${label}は空にできません`, true);
        return;
      }
      save(p, { [key]: v });
    });
    return el("label", { class: "f", for: inp.id }, [label, inp]);
  }
  function ownerSelect(id: string, cur: string) {
    const s = el("select", { id });
    const list = people(parts);
    if (cur && !list.includes(cur)) list.push(cur);
    for (const n of list) {
      const o = el("option", { value: n, text: n });
      if (n === cur) o.selected = true;
      s.appendChild(o);
    }
    return s;
  }
  function ownerField(p: Part) {
    const s = ownerSelect(`f-${p.id}-owner`, p.owner);
    s.addEventListener("change", () => save(p, { owner: s.value }));
    return el("label", { class: "f", for: s.id }, ["担当", s]);
  }
  function checkField(p: Part, label: string, key: "tapeDone" | "reported") {
    const c = el("input", { type: "checkbox", id: `f-${p.id}-${key}` });
    c.checked = p[key];
    c.addEventListener("change", () => save(p, { [key]: c.checked }));
    return el("label", { class: "ck", for: c.id }, [c, label]);
  }
  function moreBtn(p: Part) {
    const open = openIds.has(p.id);
    return el("button", {
      class: "more",
      type: "button",
      id: "more-" + p.id,
      "aria-expanded": open ? "true" : "false",
      text: open ? "閉じる" : "詳細",
      onclick: () => {
        if (openIds.has(p.id)) openIds.delete(p.id);
        else openIds.add(p.id);
        nodes.delete("p:" + p.id);
        render();
      },
    });
  }
  function editPanel(p: Part) {
    return el("div", { class: "edit" }, [
      el("div", { class: "edit-row" }, [sizeField(p, "縦 (mm)", "w"), sizeField(p, "横 (mm)", "d"), sizeField(p, "高さ (mm)", "h")]),
      checkField(p, "両面テープを貼った（小さいものは切って貼る）", "tapeDone"),
      checkField(p, "個数・パーツ名・色を、パーツ班LINEに報告した", "reported"),
      textField(p, "メモ", "note"),
      el("div", { class: "edit-row two" }, [ownerField(p), textField(p, "パーツ名", "name", true)]),
      p.fromProto &&
        el("button", {
          type: "button",
          class: "undo",
          text: "3Dプロトに戻す（確認OKを取り消す）",
          onclick: () => {
            openIds.delete(p.id);
            save(p, { kind: "3Dプロト", fromProto: false });
          },
        }),
    ]);
  }
  const sizeText = (p: Part) => (p.w != null || p.d != null || p.h != null ? `${p.w ?? 0}×${p.d ?? 0}×${p.h ?? 0}mm` : "");
  function msgEl(p: Part) {
    const m = msgs.get(p.id) ?? { text: "", err: false };
    return el("div", { class: "save" + (m.err ? " err" : ""), id: "m-" + p.id, text: m.text });
  }

  function massRow(p: Part) {
    const meta: string[] = [];
    if (p.fromProto) meta.push("3Dプロトから");
    const s = sizeText(p);
    if (s) meta.push(s);
    if (p.tapeDone) meta.push("テープ済");
    if (p.reported) meta.push("LINE報告済");
    const row = el("div", { class: "part" + (isDone(p) ? " done" : "") });
    const kids: Kid[] = [
      el("div", { class: "part-h" }, [el("span", { class: "nm", text: p.name }), el("span", { class: "meta", text: meta.join("　") }), moreBtn(p)]),
      CAUTION_NAMES.includes(p.name) && el("div", { class: "warn", text: "担当が重なっているので、作る量は少なめに" }),
      el("div", { class: "cols" }, COLS.map((c) => colCheck(p, c, row))),
      openIds.has(p.id) && editPanel(p),
      msgEl(p),
    ];
    for (const k of kids) if (k) row.appendChild(k as Node);
    return row;
  }
  /* 3Dプロト：確認OKにチェックすると量産に移る */
  function protoRow(p: Part) {
    const cb = el("input", { type: "checkbox", id: `c-${p.id}-ok`, "aria-label": `${p.name}の確認OKが出た（量産に移す）` });
    const lab = el("label", { class: "share", for: cb.id }, [cb, el("span", { class: "box" }), el("span", { class: "t", text: "確認OK" })]);
    cb.addEventListener("change", () => {
      if (!cb.checked) return;
      lab.classList.add("on");
      moved = { id: p.id, name: p.name };
      showMoved();
      save(p, { kind: "量産OK", fromProto: true });
    });
    return el("div", {}, [el("div", { class: "prow" }, [el("div", { class: "part-h" }, [el("span", { class: "nm", text: p.name })]), lab]), msgEl(p)]);
  }
  function showMoved() {
    const b = $("moved");
    b.textContent = "";
    if (!moved || tab !== "3Dプロト") {
      b.hidden = true;
      return;
    }
    const { id, name } = moved;
    b.append(
      `「${name}」を量産に移しました。`,
      el("button", {
        type: "button",
        class: "undo",
        text: "元に戻す",
        onclick: () => {
          const p = parts.find((x) => x.id === id);
          moved = null;
          showMoved();
          if (p) save(p, { kind: "3Dプロト", fromProto: false });
        },
      }),
    );
    b.hidden = false;
  }

  /* ===== 集計 ===== */
  function paintStats() {
    const s = stats(parts);
    $("t-done").textContent = String(s.done);
    $("t-mass").textContent = String(s.mass);
    $("t-cols").textContent = String(s.cols);
    $("t-colsAll").textContent = String(s.colsAll);
    $("t-bar").style.width = s.ratio * 100 + "%";
    const due = $("due");
    due.textContent = "";
    due.append("10/14締切 ", el("b", { text: leftText(DUE_MASS) }));
    const pl = $("proto-line");
    pl.textContent = "";
    pl.append("確認待ち ", el("b", { text: s.proto + "件" }), "。確認OKにチェックすると「量産」に移ります。");
    $("n-mass").textContent = String(s.mass);
    $("n-proto").textContent = String(s.proto);
  }

  /* ===== 描画（変わった所だけ作り直す。文字入力中の行は後回し） ===== */
  function typingIn(): HTMLElement | null {
    const a = document.activeElement as HTMLElement | null;
    if (!a || !$("list").contains(a)) return null;
    return a instanceof HTMLInputElement && a.type === "text" ? a : null;
  }
  function renderWho() {
    const box = $("who");
    const list = people(parts);
    if (me && !list.includes(me)) setMe("");
    const sig = list.join(",") + "|" + me;
    if (box.dataset.sig !== sig) {
      box.dataset.sig = sig;
      box.textContent = "";
      box.appendChild(el("span", { class: "who-l", text: "あなたは" }));
      for (const n of [""].concat(list)) {
        box.appendChild(
          el("button", {
            type: "button",
            class: "chip",
            "aria-pressed": me === n ? "true" : "false",
            text: n || "全員を見る",
            onclick: () => {
              setMe(n);
              render();
            },
          }),
        );
      }
    }
    $("hint").textContent = me ? `${me}さんの担当だけを表示しています。記入した人として「${me}」が残ります。` : "自分の名前を選ぶと、自分の担当だけが出ます。";
  }
  function renderAddOwner() {
    const ao = $<HTMLSelectElement>("a-owner");
    if (document.activeElement === ao) return;
    ao.replaceWith(ownerSelect("a-owner", ao.value || me || MEMBERS[0]));
  }

  function render() {
    paintStats();
    renderWho();
    renderAddOwner();
    const box = $("list");
    if (!loaded) return;
    const list = parts.filter((p) => p.kind === tab && (!me || p.owner === me));
    if (!list.length) {
      box.textContent = "";
      nodes = new Map();
      const msg = !parts.length
        ? "パーツがまだ登録されていません。下の「パーツを追加する」から登録できます。"
        : me
          ? `${me}さんの担当は` + (tab === "量産OK" ? "量産にはありません。「3Dプロト」のタブを見てください。" : "3Dプロトにはありません。「量産」のタブを見てください。")
          : tab === "量産OK"
            ? "量産のパーツはまだありません。"
            : "確認待ちの3Dプロトはありません。";
      box.appendChild(el("div", { class: "empty", text: msg }));
      return;
    }
    type Entry = { k: string; sig: string; build: () => HTMLElement };
    const entries: Entry[] = [];
    for (const o of owners(list)) {
      const mine = list.filter((p) => p.owner === o);
      entries.push(
        tab === "量産OK"
          ? {
              k: "g:" + o,
              sig: o + "|" + mine.map(nCol).join(","),
              build: () => el("div", { class: "grp" }, [el("b", { text: o }), el("span", {}, ["3色済 ", el("b", { text: `${mine.filter(isDone).length} / ${mine.length}` }), "種類"])]),
            }
          : {
              k: "g:" + o,
              sig: o + "|" + mine.length,
              build: () => el("div", { class: "grp" }, [el("b", { text: o }), el("span", {}, ["確認待ち ", el("b", { text: String(mine.length) }), "件"])]),
            },
      );
      for (const p of mine)
        entries.push({ k: "p:" + p.id, sig: JSON.stringify(p) + "|" + openIds.has(p.id) + "|" + tab, build: () => (isMass(p) ? massRow(p) : protoRow(p)) });
    }
    const typing = typingIn();
    const act = document.activeElement as HTMLElement | null;
    const keep = new Map<string, { el: HTMLElement; sig: string }>();
    let refocus: string | null = null;
    pending = false;
    for (const e of entries) {
      const cur = nodes.get(e.k);
      if (cur && cur.sig !== e.sig && typing && cur.el.contains(typing)) {
        pending = true; // 入力中の行は作り直さない。入力が終わってから反映する
        keep.set(e.k, cur);
        continue;
      }
      if (cur && cur.sig === e.sig) {
        keep.set(e.k, cur);
        continue;
      }
      if (cur && act?.id && cur.el.contains(act)) refocus = act.id;
      keep.set(e.k, { el: e.build(), sig: e.sig });
    }
    if (box.firstElementChild?.classList.contains("empty")) box.textContent = "";
    // 並べ替え：正しい位置にある要素は動かさない（フォーカスとスクロールを保つ）
    let ref = box.firstChild;
    for (const e of entries) {
      const n = keep.get(e.k)!.el;
      if (n === ref) ref = ref.nextSibling;
      else box.insertBefore(n, ref);
    }
    while (ref) {
      const nx = ref.nextSibling;
      box.removeChild(ref);
      ref = nx;
    }
    nodes = keep;
    if (refocus) document.getElementById(refocus)?.focus({ preventScroll: true });
  }

  $("list").addEventListener("focusout", () => {
    if (pending)
      setTimeout(() => {
        if (!typingIn()) render();
      }, 0);
  });
  document.querySelectorAll<HTMLButtonElement>(".tab").forEach((b) =>
    b.addEventListener("click", () => {
      tab = b.dataset.k as Kind;
      document.querySelectorAll(".tab").forEach((x) => x.setAttribute("aria-selected", x === b ? "true" : "false"));
      $<HTMLSelectElement>("a-kind").value = tab;
      $("proto-line").hidden = tab !== "3Dプロト";
      showMoved();
      render();
    }),
  );
  $("a-go").addEventListener("click", () => {
    const msg = $("a-msg");
    const owner = $<HTMLSelectElement>("a-owner").value.trim();
    const name = $<HTMLInputElement>("a-name").value.trim();
    if (!owner || !name) {
      msg.textContent = "担当とパーツ名を入力してください";
      return;
    }
    const order = parts.reduce((a, p) => Math.max(a, p.order), 0) + 1;
    const d = blank(owner, name, $<HTMLSelectElement>("a-kind").value as Kind, order);
    d.updatedBy = me;
    store.add(d).then(
      () => {
        msg.textContent = `「${name}」を追加しました`;
        $<HTMLInputElement>("a-name").value = "";
      },
      () => (msg.textContent = "追加できませんでした。もう一度試してください"),
    );
  });

  /* ===== 接続 ===== */
  function showError(e: StoreError) {
    const b = $("err");
    b.textContent =
      e.code === "permission"
        ? "保存先に入れませんでした。Firebase の設定（匿名ログインと承認済みドメイン）を確認してください。"
        : "接続できません。通信状況を確認して、ページを開き直してください。";
    b.hidden = false;
    loaded = true;
    render();
  }
  // オフライン表示（Firestore は端末に保存しておき、通信が戻ると自動で送る）
  const paintOnline = () => ($("offline").hidden = !store.shared || navigator.onLine);
  window.addEventListener("online", paintOnline);
  window.addEventListener("offline", paintOnline);
  paintOnline();
  render();
  store
    .seedIfEmpty(seedDocs())
    .catch((e: StoreError) => console.warn("初期データの投入をスキップしました", e))
    .finally(() => {
      store.subscribe((next) => {
        parts = next;
        loaded = true;
        $("err").hidden = true;
        render();
      }, showError);
    });
}
