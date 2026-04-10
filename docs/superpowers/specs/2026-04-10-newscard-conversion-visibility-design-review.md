# Review Findings

## Finding 1

**対象:** `docs/superpowers/specs/2026-04-10-newscard-conversion-visibility-design.md:14-18`  
**優先度:** P2  
**タイトル:** `reason` を目立たせる目的に対して具体仕様が足りない

目標では `reason` を「笑いのオチ」として際立たせるとありますが、具体的に指定されているのは区切り帯と `genre` バッジだけです。現行実装の `reason` は通常本文寄りの見た目なので、この仕様のままだとレイアウト順だけ変えても punchline が埋もれたままになる可能性があります。文字サイズ、太さ、余白、引用風スタイルなど、`reason` の視覚的優先度を示す受け入れ条件を追加した方がよいです。

## Finding 2

**対象:** `docs/superpowers/specs/2026-04-10-newscard-conversion-visibility-design.md:57-60`  
**優先度:** P1  
**タイトル:** genreバッジの白文字がグラデーション終端で読めなくなる

`text-white` を `from-red-600 to-amber-500` に重ねる指定だと、特に `amber-500` 側でコントラストが大きく不足します。ここは今回いちばん強調したい「答え合わせ」要素なのに、視認性を落としてしまいます。背景を濃色寄りに寄せるか、文字色を `text-slate-950` 系にするなど、コントラスト基準を満たす配色条件を仕様に入れた方が安全です。

## Finding 3

**対象:** `docs/superpowers/specs/2026-04-10-newscard-conversion-visibility-design.md:44-51`  
**優先度:** P1  
**タイトル:** 区切り帯の説明文が低コントラストで主目的を果たせない

`text-xs text-slate-400` を `bg-slate-50` に載せる指定はかなり薄く、今回の主目的である「AIが変換した」事実の明示が埋もれます。説明ラベルは新規追加される唯一の因果説明なので、少なくとも本文補助より一段強いコントラストにする、またはアイコンやラベル装飾を含めた可視性要件を定義しておくべきです。
