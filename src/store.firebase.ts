import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, signInAnonymously } from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  getDocsFromServer,
  initializeFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { normalize } from "./model";
import { toStoreError, type Store } from "./store";

export interface FirebaseEnv {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId: string;
}

export function firebaseStore(cfg: FirebaseEnv): Store {
  const app = initializeApp(cfg);
  const auth = getAuth(app);
  // 通信が切れても、開いている間の記入は保持され、戻ると自動で送られる（Firestore の標準動作）
  const db = initializeFirestore(app, {});
  const col = collection(db, "parts");

  /** 匿名ログイン（ログイン操作は求めない） */
  const ready = new Promise<void>((resolve, reject) => {
    const off = onAuthStateChanged(
      auth,
      (u) => {
        if (u) {
          off();
          resolve();
        }
      },
      reject,
    );
    signInAnonymously(auth).catch(reject);
  });

  /** 同じパーツへの書き込みは直列化する */
  const queues = new Map<string, Promise<unknown>>();

  return {
    shared: true,
    subscribe(onChange, onError) {
      let unsub: (() => void) | null = null;
      let stopped = false;
      ready
        .then(() => {
          if (stopped) return;
          unsub = onSnapshot(
            query(col, orderBy("order")),
            { includeMetadataChanges: true },
            (snap) => onChange(snap.docs.map((d) => normalize(d.id, d.data())), { offline: snap.metadata.fromCache }),
            (e) => onError(toStoreError(e)),
          );
        })
        .catch((e) => onError(toStoreError(e)));
      return () => {
        stopped = true;
        unsub?.();
      };
    },
    update(id, patch) {
      const prev = queues.get(id) ?? Promise.resolve();
      const next = prev
        .catch(() => undefined)
        .then(() => ready)
        .then(() => updateDoc(doc(col, id), { ...patch, updatedAt: serverTimestamp() }));
      queues.set(id, next);
      return next.catch((e) => {
        throw toStoreError(e);
      });
    },
    async add(part) {
      await ready;
      try {
        const ref = await addDoc(col, { ...part, updatedAt: serverTimestamp() });
        return ref.id;
      } catch (e) {
        throw toStoreError(e);
      }
    },
    async seedIfEmpty(seed) {
      await ready;
      const first = await getDocsFromServer(query(col, limit(1)));
      if (!first.empty) return;
      // 複数人が同時に開いても重複しないよう、固定IDで「無いときだけ作る」
      for (const s of seed) {
        const ref = doc(col, s.id);
        await runTransaction(db, async (tx) => {
          const cur = await tx.get(ref);
          if (!cur.exists()) tx.set(ref, { ...s.data, updatedAt: serverTimestamp() });
        });
      }
    },
  };
}
