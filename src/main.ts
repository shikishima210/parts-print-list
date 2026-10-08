import "./style.css";
import { startApp } from "./app";
import { firebaseStore } from "./store.firebase";
import { memoryStore } from "./store.memory";

const env = import.meta.env;
const cfg = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

// Firebase の設定があれば全員で共有。なければこのブラウザだけの確認用モード
startApp(cfg.apiKey && cfg.projectId && cfg.appId ? firebaseStore(cfg) : memoryStore());
