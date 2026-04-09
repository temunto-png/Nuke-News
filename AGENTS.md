# AGENTS

## ファイル操作に関する文字コードと改行コード

- パスの取得やファイル操作は**必ず**PowerShellで行う。
- ファイルやフォルダのパス、ならびにテキストファイルの内容を扱う場合は、以下の文字コードと改行コードを利用する。
- PowerShellのコンソール上でのパスや文字の表示: UTF-8, LF
- CSVファイル: BOM付きUTF-8, CRLF
- Markdown、YAML、TOML、Textなどのテキストベースファイル: BOM無しUTF-8, LF
- PowerShell 5.xのソースファイル: BOM付きUTF-8, LF
- PowerShell 7.xのソースファイル: BOM無しUTF-8, LF
