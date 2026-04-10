# NewsCard 変換可視化リデザイン

**日付:** 2026-04-10  
**対象ファイル:** `src/app/components/NewsCard.tsx`

---

## 背景・課題

現状のカードは「ニュースタイトル → AV作品サムネイル」という並びのため、初見ユーザーには「ニュースと無関係なサムネイルが並んでいるサイト」に見える。「AIがニュースをAVジャンルに変換した」という因果の流れが視覚的に伝わっていない。

---

## 目標

- 「AIが変換した」という事実を明示する
- 笑いのオチ（`reason`）を際立たせる
- `genre` を「答え合わせ」として強調する

---

## 新しいカード構造

### 情報の順序（上から）

1. **ヘッダー部**（変更なし）
   - `#N` バッジ + `newsTitle`

2. **変換セクション**（新規）
   - 区切り帯：「AIが変換すると…」
   - `reason` テキスト（笑いのオチ）
   - `genre` 答え合わせバッジ（大・目立つ）

3. **作品セクション**（変更なし、位置のみ移動）
   - AV作品サムネイル
   - AV作品タイトル

4. **CTAボタン**（変更なし）

---

## スタイル仕様

### 区切り帯「AIが変換すると…」

```
背景: bg-slate-50
テキスト: "🤖 AIが変換すると…"
スタイル: text-xs font-semibold text-slate-600 tracking-wider
パディング: px-5 py-3
区切り線: border-t border-b border-slate-100
```

アイコン（🤖）を前置することで、低コントラストなテキスト単体に頼らず
視覚的なランドマークを作る。文字色は text-slate-600（bg-slate-50 に対して
コントラスト比 5.9:1、WCAG AA 達成）。

### reasonテキスト（笑いのオチ）

```
変更前: text-sm leading-7 text-slate-600
変更後: text-base font-bold leading-relaxed text-slate-800
```

文字サイズを sm→base、weight を通常→bold、色を slate-600→slate-800 に引き上げる。
オチとして視覚的に本文より一段上の優先度を持たせる。

### genreバッジ（答え合わせ）

```
変更前: inline-flex rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700
変更後: block w-full rounded-2xl bg-red-600 text-white text-center font-bold py-3 text-sm
表示テキスト: "変換結果：{genre}"
```

グラデーション案（to-amber-500）はコントラスト不足のため廃止。
bg-red-600 の単色にすることで text-white とのコントラスト比 4.5:1 以上を確保。
amber 系の装飾は既存の月額CTAボタン（bg-amber-400）と役割が混同しやすいため避ける。

---

## 変更しないもの

- ヘッダー部のデザイン（`#N` + newsTitle）
- サムネイル・AV作品タイトル・CTAボタンのデザイン
- `shareText` の内容（ティザー戦略に影響しないため）
- モバイルレイアウト（シングルカラムのまま）
- データスキーマ・型定義

---

## 変更スコープ

- **変更ファイル:** `src/app/components/NewsCard.tsx` のみ
- **変更種別:** UI レイアウト・スタイルのみ。ロジック・データ変更なし
