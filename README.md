# MHRise: Sunbreak 配裝搜尋器

《魔物獵人 Rise：破曉》配裝搜尋網頁工具。以太刀起家、架構可擴充至全武器,目前完整支援 **太刀** 與 **雙刀**。防具/珠子/技能為真實破曉 TU5 資料。無後端,資料使用本地 JSON,搜尋邏輯為純 TypeScript utility(可獨立測試)。

## 功能

- 武器類型 + 流派 preset(太刀 3 / 雙刀 3),選取自動帶入推薦技能
- 手動調整必要 / 偏好 / 排除技能;護石、武器洞數、保留洞位輸入
- 固定 / 排除指定裝備(可從搜尋結果卡片一鍵操作後再搜)
- 簡化版傀異鍊成(直接輸入鍊成後技能與洞數)
- 三種搜尋模式(快速 / 完整 / 推薦)、自動補裝飾珠、評分排序、顯示前 100 套
- 結果卡片:分數細項、技能摘要、珠子配置、剩餘/保留洞位、複製配裝摘要

## 技術

Next.js 14（App Router）· TypeScript · Tailwind CSS · shadcn/ui · 深色 Dashboard UI。

## 開發

```bash
npm run dev     # 開發伺服器（本機 3000 被占用時可用 -p 指定其他埠）
npm run build   # 生產建置（含 type-check + lint）
npm run start   # 執行生產版本
```

> 注意：本機 3000 埠可能被其他專案占用，`.claude/launch.json` 內建 `mhsb-prod`(3005) / `mhsb-dev`(3006) 兩組設定。

## 架構

```
src/
├── types/build.ts          # 全部核心型別（不寫死太刀，武器只以 weaponType 字串區分）
├── data/                   # 本地 JSON 資料（由 Kiranico 匯入）
│   ├── armors.json         #   全防具 1591 件（RARE1-10，含破曉 TU5 全系列）
│   ├── weapons.json        #   太刀範例（武器 DB 為後續工作）
│   ├── decorations.json    #   裝飾珠 243 顆（含 4 級洞）
│   ├── skills.json         #   147 個技能與上限、特殊標記
│   ├── weaponTypes.json    #   14 種武器（太刀、雙刀 supported: true）
│   └── buildPresets.json   #   太刀 3 + 雙刀 3 個流派 preset
├── lib/                    # 純函式邏輯層（無 React 相依，方便測試）
│   ├── data.ts             #   資料存取 + 衍生索引（未來可換 SQLite/Supabase/IndexedDB）
│   ├── slot-utils.ts       #   洞位：normalize / parse / place / canFit
│   ├── skill-calculator.ts #   技能累加、gap、上限截斷
│   ├── decoration-solver.ts#   自動補珠（必要→保留洞位→偏好）
│   ├── equipment-pools.ts  #   候選池、固定/排除、單件評分、模式裁切
│   ├── score-build.ts      #   scoreBuild()（分數細項）
│   └── build-search.ts     #   searchBuilds() / formatBuildResult()
├── components/             # UI 元件（每個獨立、可組合）
└── app/page.tsx            # 主 Dashboard 頁面
```

## 搜尋流程

1. 選武器 → 選流派 preset → 自動帶入必要／偏好／排除技能（可再手動調整）
2. 輸入武器洞數、護石、保留洞位；可建立傀異鍊成自訂防具
3. 三種模式：`fast`（預設，候選裁切）/ `exact`（較大候選池、較慢）/ `greedy`（最快，優先補必要技能）
4. 每套配裝自動補珠：先補必要技能（補不滿即淘汰）→ 檢查保留洞位（硬條件）→ 剩餘補偏好
5. 依 `scoreBuild()` 排序，最多顯示前 100 套
6. 從結果卡片可「固定此部位 / 排除此裝備」，再搜尋即套用

## 資料來源與匯入

防具 / 裝飾珠 / 技能為**真實破曉 TU5（Ver16）正體中文資料**,由 [Kiranico](https://mhrise.kiranico.com/zh-Hant) 匯入:

```bash
node scripts/import-kiranico.mjs   # 重新抓取並覆寫 src/data/{armors,decorations,skills}.json
```

- 防具部位（頭/身/手/腰/腳）Kiranico 未文字標註,由 `import-kiranico.mjs` 以「後綴／【】token 關鍵字 + 系列內位置游標」混合判定(涵蓋主題命名系列如冥淵/脈動鋼龍)。
- 少數套裝加成技能 Kiranico 未提供逐級說明,其最大等級以腳本內 `KNOWN_MAX` 常數表補齊。
- Kiranico 官方譯名與坊間略有差異(例:納刀術→**收刀術**、翔蟲使→**翔蟲能手**、業物→**利刃**、冰氣鍊成→**寒氣鍊成**),preset 已對齊官方譯名。

> 搜尋為相關度裁切後的組合搜尋(全 DB 每部位 300+ 件無法暴力枚舉):各模式先濾除無關裝備、依 preset 相關度取每部位前 N 名(greedy 7 / fast 9 / exact 12)再枚舉補珠評分。結果為高品質啟發解,非保證全域最佳。

## 擴充方向

- 新武器：於 `weaponTypes.json` 設 `supported: true`，補該武器的 preset 與資料即可，邏輯層無需改動。
- 完整資料：補齊 `armors/weapons/decorations`；`data.ts` 是唯一資料來源，可替換為 DB。
- 已預留：護石收藏、裝備庫存、完整武器資料庫、收藏／比較的持久化。

## 資料致謝

遊戲資料來源:[Kiranico — Monster Hunter Rise: Sunbreak](https://mhrise.kiranico.com/)。本專案為個人非商業用途的配裝工具。《Monster Hunter Rise: Sunbreak》© CAPCOM。
