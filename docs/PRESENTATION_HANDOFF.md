# Snack Overflow 簡報規劃與交接

本文件整理討論中已確認的方向、五頁初稿、Demo 節奏及後續工作，不是完整聊天逐字稿。

## 已確認的方向

- **Snack Overflow 是隊名**，產品名稱待定。簡報使用「Built by Snack Overflow」。
- 初衷與故事主線：**幫沒車的新生一次配齊家具**。
- 參賽組別：**Optimization**。
- 故事情境：剛搬到 Pittsburgh 的新生，需要 TV、TV stand、desk、chair，家具預算 $300，沒有車。
- 暫定產品描述：Turn scattered secondhand listings into a furniture bundle you can actually bring home.
- 英文簡報、五頁、暖白底與深綠、少字、家具與房間示意圖。技術頁一次逐步顯示，其餘使用輕微淡入淡出。
- 投影片加 Demo 目標 2:45，預留 15 秒緩衝。

## 比賽依據

依使用者提供的 **HackCMU 2026 Opening Ceremony.pdf**：

- 第 32 頁：presentation + demo 合計 3 分鐘。
- 第 34 頁：Originality、Technical Difficulty、Demo Quality、Usefulness、Relevance (Track only)。文件未列各項權重。
- 第 20 頁：提交時選一個組別；組別相關性屬評分內容。

原 PDF 在原作者電腦的 Downloads，**未包含在 repository**。以上為此次閱讀的摘要；若主辦方之後更新規則，需重新確認。

## 系統如何支撐故事

買家需求 → 商品篩選 → OR-Tools CP-SAT 選最多約 10 組候選 → 檢查可配送賣家並以 OR-Tools Routing 規劃取貨路線 → 計算配送成本並依偏好重新排序 → 回傳最多 3 個方案。

- 商品需滿足類別、可用性、家具預算等限制。
- 賣家配送模式中，司機必須是所選商品組合的賣家之一，且容量足以容納整組商品。
- 司機從自己位置出發，經其他賣家，最後抵達買家。
- Grok 協助輸入解析、刊登建議和價格研究；最終商品組合與路線由優化程式決定。
- 主簡報聚焦買家與運輸，AI 刊登、價格研究、換商品及預約流程留給追問。

表述界線：$300 是家具預算，配送費另計；車輛容量是簡化大小單位；兩階段候選搜尋不保證全域最佳。不可將歷史測試數字當成目前即時結果，也不預設節省百分比。

## 五頁內容骨架

| 頁面 | 標題 | 核心畫面 | 時間 |
| --- | --- | --- | --- |
| 1 | New city. Empty room. No car. | 新生、空房間、四件家具與 $300 家具預算 | 20 秒 |
| 2 | Finding furniture is only half the problem. | 分散商品；預算、司機、容量三個問題 | 25 秒 |
| 3 | Choose the furniture. Plan the pickup. | CP-SAT → Routing → 重新排序；一次逐步顯示 | 35 秒 |
| 4 | Four items. One coordinated pickup plan. | 切到實際產品，展示需求與完整配送方案 | 60 秒 |
| 5 | From an empty room to a plan to bring it home. | 房間示意圖與價值主張；隊名署名 | 25 秒 |

不另加目錄、團隊介紹或整頁技術 Logo。每頁只推進一個核心訊息。

## 目前檔案與使用方式

- 可編輯簡報：[index.tsx](../presentation/slides/no-car-new-home/index.tsx)
- 五頁英文講稿與彩排提醒：同一檔案的 `export const notes`，對應各頁講者備註。
- 官方操作規則：[AGENTS.md](../presentation/AGENTS.md)
- 初始化說明：[README.md](../presentation/README.md)
- open-slide 官方 skills 在 `presentation/.agents/skills/`；repository 根目錄 `.agents/skills/` 是相對 symlink，已納入 Git。

隊友取得分支後，從 repository 根目錄執行：

```bash
cd presentation
npm ci
npm run dev
```

打開伺服器印出的網址，進入 `/s/no-car-new-home`。應使用目前專案要求的 Node.js 版本（根 README：22.12+）。若主產品占用 5173，簡報會使用其他可用 port，以終端輸出為準。

`npm run build` 建立靜態產物；`npm run preview` 可預覽建置結果。本機 localhost 網址不能提供給遠端隊友直接存取，他們需要在自己的電腦啟動。

請讓接手的 agent 先讀本文件及 `presentation/AGENTS.md`，再使用 create-slide / slide-authoring / apply-comments 等 skills。既有簡報編輯使用 slide-authoring；相對路徑以 `presentation/` 為準。

## Demo 腳本

| 時段 | 操作 | 英文口述 |
| --- | --- | --- |
| 0–10 秒 | 預填四品類、$300、確認地點、賣家配送 | Here’s our student’s request: four items, a three-hundred-dollar furniture budget, and seller delivery. |
| 10–25 秒 | Build my bundle，展示結果 | The system gives us complete options, with furniture and delivery costs shown separately. |
| 25–45 秒 | 打開一組，展示司機、容量、路線 | This seller can carry the full bundle. The pickup plan starts at their location, visits the other sellers, and ends at the student’s home. |
| 45–60 秒 | 有時間則展示限制說明，再切回簡報 | Each option covers the requested items and passes the budget, driver, and capacity checks. |

目前第 4 頁是操作提示，尚未放入產品截圖或影片。彩排前確認庫存與結果；保留同次操作截圖作為網路延遲備援。反覆彩排避免實際預約導致庫存耗盡。

## 待完成

1. 決定產品名稱，保留 Snack Overflow 為隊名。
2. 在主產品功能穩定後固定 Demo 資料，重跑並記錄版本、輸入、庫存及路線資料來源。
3. 取得真實結果截圖／短錄影，接上 Demo 頁；要標明路線是 Mapbox 或估算。
4. 可選比較實驗：同批商品與同一需求，比較「逐類選最便宜商品」與現有流程，記錄家具價格、司機／容量可行性、配送費、總價、路程。先取得結果，再決定是否聲稱改善；不要挑數據預設贏面。
5. 計時彩排，確保 Demo 加講稿在 3 分鐘內。後續可補充模型、約束、AI 分工、MVP 限制等問答備用資料。

目前已完成：五頁可執行雛形、英文講者備註、Demo 提示、TypeScript 檢查、production build、逐頁瀏覽器版面檢查。圖像目前為程式繪製的概念示意，並非產品實際畫面或配送成果。
