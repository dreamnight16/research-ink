**語言 / Language:** [English](README.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-Hant.md) | [日本語](README.ja.md)

# 研墨 / ResearchInk

[![Tests](https://img.shields.io/badge/tests-75%20passed-green)](https://github.com/dreamnight16/ResearchInk/actions)
[![Python](https://img.shields.io/badge/python-3.11+-blue)](https://www.python.org/)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux%20%7C%20Android%20%7C%20iOS-lightgrey)]()

**一個跑在你電腦上、資料不出門的科研助手。**

跟通用 AI 聊天不一樣。研墨是專門給做科研的人用的：能拆解指導教授給的模糊方向、跨來源追蹤最新論文、交叉驗證公式推導、客觀評估專案方案、輔助論文寫作。五個工具各有各的介面，不是塞進一個聊天框裡將就。

核心就三條：**資料不出本機、公式不允許出錯、支援裝自己的外掛程式。** 附帶 AI 去重、AI 找思路、去 AI 味。

---

## 安裝與執行

需要 Python 3.11+、Node.js 18+ 和 Ollama。

```bash
pip install -e ".[dev]"
python -m backend.main
```

後端執行在 `127.0.0.1:8000`。然後啟動前端：

```bash
cd frontend
npm install
npm run dev
```

瀏覽器開啟 `http://localhost:5173`。

### 桌面應用程式

從 [Releases](https://github.com/dreamnight16/ResearchInk/releases) 下載安裝包：

| 平台 | 格式 | 大小 |
|------|------|------|
| Windows 10/11 | `.msi` | ~50MB |
| macOS 12+ | `.dmg` | ~50MB |
| Linux (x86_64) | `.AppImage` / `.deb` | ~50MB |

桌面應用程式使用 Tauri 殼打包 React 前端，自動啟動 Python 後端。需 Python 3.11+ 和 Ollama。

### 行動端（配套應用）

行動端通過局域網連接桌面後端：

| 平台 | 格式 |
|------|------|
| Android 8+ | `.apk` |
| iOS 16+ | 開發者簽名 `.ipa` |

1. 桌面端打開 **設定 → 行動端配對**，生成配對碼
2. 行動端輸入桌面 IP 和配對碼完成連接

### Qt 桌面（已廢棄）

> Qt 前端 (`frontend_qt/`) 已廢棄，請使用 Tauri 桌面應用程式或 React Web 前端。

---

## 功能

頂部五個標籤頁（+ 右側聊天面板）：讀懂導師、追新論文、審專案、驗公式、寫論文。

### 讀懂導師

貼上導師的話。自動拆解為可執行任務，含排序和時間估算。每項任務可展開顯示子步驟和建議資源。導師資料屬機密等級，強制使用本地模型。

### 追新論文

設定研究關鍵字。並行抓取 ArXiv、Semantic Scholar 和 DBLP。論文以資訊流展示，一鍵取得中文摘要。後台每小時自動更新。

三重去重（標題相似度 + arxiv_id + DOI）確保無預印本重複出現。點選「找思路」從 10+ 維度（理論性、效率、穩健性、公平性等）分析目前論文列表，按可信度排序標註研究空白。

### 審專案

提交專案名稱和描述。從三個維度評分 — 創新性、嚴謹性、方法論 — 並給出具體弱點和改進建議。

### 驗公式

左右分欄 LaTeX 原始碼與渲染預覽。提交後雙通道驗證：基礎檢查（括號匹配、除零、定義域）+ SymPy 符號計算。兩通道均通過才亮綠燈。不涉及任何 LLM — 純本地符號計算。

### 寫論文

產生結構化大綱，含估算字數。支援 BibTeX 貼上解析。底部面板有「去 AI 味」工具，偵測 AI 寫作痕跡並自動清理。

---

## 外掛程式系統

外掛程式存放於 `~/.research-ink/plugins/`。透過設定 → 外掛程式管理器載入。最低要求：`plugin.toml` + `plugin.py`。開發指南見 `plugin_schema/API.md`。支援生命週期管理、熱載入/卸載和事件匯流排。

---

## 架構

| 元件 | 說明 |
|---|---|
| 外掛程式引擎 | 生命週期管理、熱載入/卸載、事件匯流排 |
| 任務排程器 | 每小時自動抓取論文 |
| WebSocket | 即時推送論文更新到前端 |
| 安全層 | 三級資料分類 + 雲端操作攔截 + 稽核日誌 |
| 儲存 | SQLite（結構化）+ ChromaDB（向量）+ 本地檔案 |

## 資料安全

預設：所有操作使用本地 Ollama。雲端 API 金鑰為可選 — 不填就不會有任何資料離開你的機器。

- 機密資料強制本地；雲端操作自動攔截
- 雲端出站流量有稽核日誌
- 資料儲存在 `~/.research-ink/`，隨時備份

## 技術棧

| 層 | 技術 |
|---|---|
| 後端 | Python, FastAPI, SQLite, ChromaDB, SymPy, SciPy |
| 前端 | React 18, TypeScript, Vite, KaTeX |
| 桌面殼 | Tauri (Rust) |
| 字型 | Noto Sans SC, Noto Serif SC |

## 相關專案

- [myBlog](https://github.com/dreamnight16/myBlog) — 作者部落格，更多科研相關文章

## License

MIT

---

<div align="center">

**Language / 语言 / 言語**

[**English**](README.md) | [**简体中文**](README.zh-CN.md) | [**繁體中文**](README.zh-Hant.md) | [**日本語**](README.ja.md)

</div>
