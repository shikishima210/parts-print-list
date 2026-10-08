# パーツ印刷リスト

稲友祭 デコラボ・パーツ班が、3Dプリントパーツの量産状況（1色目・2色目・3色目）と3Dプロトの確認OKを、スマホからチェックして全員でリアルタイムに共有するWebアプリ。

- 画面：GitHub Pages（静的ファイル）
- 保存とリアルタイム同期：Firebase Firestore ＋ 匿名ログイン
- Firebase の設定がないときは「確認用モード」で動く（このブラウザだけに保存。他の人には共有されない）

## 最初に一度だけやること

### 1. Firebase プロジェクトを作る（Googleアカウント）

1. https://console.firebase.google.com で「プロジェクトを追加」（例：`parts-print-list`）。Googleアナリティクスはオフでよい。
2. **Firestore Database** → 「データベースを作成」→ 場所は `asia-northeast1`（東京）→ 本番環境モード。
3. Firestore → **ルール** タブに、このリポジトリの `firestore.rules` の中身を貼って「公開」。
4. **Authentication** →「始める」→ ログイン方法で **匿名** を有効にする。
5. Authentication → 設定 → **承認済みドメイン** に `<GitHubのユーザー名>.github.io` を追加する。（これがないと公開ページでログインに失敗する）
6. プロジェクトの設定（歯車）→ マイアプリ →「ウェブ」（`</>`）でアプリを追加。表示される `firebaseConfig` の6項目を控える。

> `firebaseConfig` の値は秘密ではありません（ブラウザに必ず届く値です）。守りは `firestore.rules` で行います。

### 2. GitHub に置いて公開する

1. GitHub で新しいリポジトリ `parts-print-list` を作り、このフォルダを push する。
2. リポジトリの **Settings → Pages → Source** を「**GitHub Actions**」にする。
3. **Settings → Secrets and variables → Actions → Variables** に、次の6つを登録する（値は手順1-6で控えたもの）。

   | 名前 | firebaseConfig の項目 |
   |---|---|
   | `VITE_FIREBASE_API_KEY` | apiKey |
   | `VITE_FIREBASE_AUTH_DOMAIN` | authDomain |
   | `VITE_FIREBASE_PROJECT_ID` | projectId |
   | `VITE_FIREBASE_STORAGE_BUCKET` | storageBucket |
   | `VITE_FIREBASE_MESSAGING_SENDER_ID` | messagingSenderId |
   | `VITE_FIREBASE_APP_ID` | appId |

4. **Actions** タブ →「Deploy to GitHub Pages」→「Run workflow」。以後は `main` に push するたびに自動で公開される。
5. 公開URL：`https://<ユーザー名>.github.io/parts-print-list/`。これをパーツ班LINEに流す。

### 3. 初期データ

最初に誰かが公開ページを開いたとき、保存先が空なら、担当表（`2026稲友祭_パーツ班.xlsx`）の33件が自動で入る（ID `p01`〜`p33`）。同時に複数人が開いても重複しない。既にデータがあれば何もしない。

## 運用

| やりたいこと | 方法 |
|---|---|
| パーツを追加 | 画面の一番下「パーツを追加する」 |
| 担当・パーツ名を変える | 量産の行の「詳細」 |
| 確認OKを取り消す | 移した直後の「元に戻す」、または量産の行の「詳細」→「3Dプロトに戻す」 |
| パーツを削除 | Firebase コンソール → Firestore → `parts` → 該当ドキュメントを削除（画面からは消せない） |
| メンバー・締切・注意文の対象を変える | `src/config.ts` を編集して push |
| 全部やり直す | Firestore の `parts` を全部削除してからページを開く（33件が入り直る） |

## 開発

```bash
npm install
npm run dev      # http://localhost:5173（.env.local が無ければ確認用モード）
npm test         # model.ts の単体テスト
npm run build
```

Firebase につないでローカルで試すときは、`.env.example` を `.env.local` にコピーして値を入れる。

## 構成

```
src/
  config.ts          締切、メンバー名簿、注意文の対象、初期データ
  model.ts           型、派生値（nCol / isDone）、集計、入力の検証
  store.ts           保存先のインターフェース（画面はこれだけを見る）
  store.firebase.ts  Firestore 実装（匿名ログイン、リアルタイム購読、書き込みの直列化、初期データ投入）
  store.memory.ts    確認用モード（localStorage）
  app.ts             画面（変わった行だけ作り直す。入力中の行は後回し）
  style.css
firestore.rules      読み書きのルール（削除は不可）
.github/workflows/deploy.yml   GitHub Pages への公開
```

設計の詳細は `../261008-パーツ印刷リスト設計書-V3.md`。
