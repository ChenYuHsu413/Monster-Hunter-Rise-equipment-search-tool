# World: Iceborne 資料源盤點與選型（Phase 0 稽核）

> 本文件為 PLAN-iceborne Phase 0 的產出。所有數字為 2026-07-22 對兩個資料源的**實測抽查**，
> 非訓練記憶推測。抽查腳本與原始下載檔存於 session scratchpad（未進版控）。
> 資料源快照日：mhw-db.com API 即時查詢；MHWorldData `master` 分支
> commit tree `be7362213d7d1e30b794e3b58d3f87712035658d`。

---

## 結論（先講）

| | MHWorldData（gatheringhallstudios） | mhw-db.com API |
|---|---|---|
| **角色** | **主源（primary）** | **交叉核對（cross-check），僅限非武器** |
| 取用 | `raw.githubusercontent.com` CSV | REST JSON |
| Iceborne 完整度 | ✅ 完整（武器 rarity→12、防具 rarity→12、含 Fatalis/Alatreon/Safi） | ⚠️ **防具完整、武器停在基礎版** |
| set bonus 結構化 | ✅ `armorset_bonus_base.csv`（69 個，逐 rank 門檻） | ✅ `/armor/sets` 有 setBonus ranks |
| 複合珠（Lv4 雙技能） | ✅ 234 個，`skill1/skill2` 欄結構化 | ✅ 234 個（**與主源完全一致**） |
| 內建繁中 | ✅ `name_zh` 為**繁體**，覆蓋率極高（見下） | ❌ 僅英文 |

**選型理由**：MHWorldData 是唯一 Iceborne 武器完整、且內建繁體中文的結構化源，故為主源。
mhw-db.com 武器資料實測停在基礎版 World（見下方落差 G1），**不可用於 Iceborne 武器**；
其防具/珠子/護石仍可作交叉核對（珠子雙技能數 234 兩源一致，是強力互證）。
Kiranico MHWorld 保留給 Phase 2：解護石最高階歧異（落差 G3）、抽驗 set bonus/secret 數值、
補 ~40 筆缺失 zh 名（落差 G2）。

---

## 一、總筆數（實測）

### MHWorldData（主源）
| 實體 | 筆數 | 備註 |
|---|---|---|
| 武器 weapon_base | **3544** | rarity 分佈 1–12；rarity 12 = 516 把 |
| 防具（件）armor_base | **1595** | rarity 分佈 1–12；rarity 12 = 206 件 |
| 防具系列 armorset_base | **351** | 含 MR γ+ 套（Velkhana γ+、Namielle γ+） |
| 套裝加成 set bonus | **69** | 逐 rank 門檻結構化 |
| 裝飾珠 decoration_base | **404** | slot 分佈：slot1=58 / slot2=31 / slot3=16 / **slot4=299** |
| ─ 其中雙技能複合珠 | **234** | 全為 slot4 |
| ─ 單技能 Lv2 的 slot4 珠 | 65 | 對應 World「Lv4 洞：單技能 Lv2」機制 |
| 護石 charm_base | 317（含各級展開） | Attack Charm 見下 |
| 技能 skill_base | **178** | maxLevel 分佈見下 |

技能 maxLevel 分佈（178 技能）：`{1:94, 2:6, 3:45, 4:5, 5:17, 6:5, 7:6}`

### mhw-db.com（交叉核對）
| 實體 | 筆數 | 對比主源 |
|---|---|---|
| 防具（件） | 1677 | rank：low 194 / high 650 / **master 833** → 防具有 Iceborne |
| 防具系列 | 371 | 含 Alatreon Alpha+/Beta+ |
| 裝飾珠 | 405（雙技能 234） | **雙技能數與主源完全一致（234）** |
| 護石 | 109（object，內含 ranks） | Attack Charm 見落差 G3 |
| 技能 | 181 | — |
| 武器 | **1299（rarity 最高 8）** | **見落差 G1** |

---

## 二、三筆已知實體交叉核對（PLAN Phase 0 驗收要求）

### 1. 煌黑龍防具（= Alatreon armor）
- MHWorldData：`Alatreon α+` [精英·煌黑龍α]、`Alatreon β+` [精英·煌黑龍β]，rank=MR，bonus=`Alatreon Divinity`（煌黑龍的神秘）。
- mhw-db.com：`Alatreon Alpha +`、`Alatreon Beta +`。
- ✅ 兩源一致。確認 **煌黑龍 = Alatreon**（非 Fatalis，見衝突 C2）。

### 2. 雙技能 Lv4 複合珠
- MHWorldData：234 個，例 `奪氣‧攻擊珠【４】`（Stamina Thief Lv1 + Attack Boost Lv1，slot4）、`奪氣‧體術珠【４】`（Stamina Thief+Constitution）。含 Attack Boost 的雙技能珠 19 個。
- mhw-db.com：405 珠中 slot4=299、雙技能=234。
- ✅ 兩源雙技能數 **完全一致（234）**，強力互證。
- 註：PLAN 舉例的「剛刃・攻擊珠」（Razor Sharp+Attack）未以該確切中文名命中；但同類「X‧攻擊珠【４】」雙技能珠齊全。屬 PLAN 例子名稱不精確，非資料缺（見衝突 C4）。

### 3. 攻擊護石Ⅲ
- MHWorldData：`Attack Charm I/II/III/IV` → `攻擊護石Ⅰ/Ⅱ/Ⅲ/Ⅳ`（**最高 IV**）。
- mhw-db.com：`Attack Charm 1`…`Attack Charm 5`（**最高 5**）。
- ⚠️ 兩源**最高階不一致**（IV vs 5），見落差 G3。攻擊護石Ⅲ 本身兩源皆有。

---

## 三、繁中覆蓋率（MHWorldData，實測）

覆蓋率＝有翻譯列且 `name_zh` 非空 ÷ 該實體翻譯檔總列數：

| 實體 | 覆蓋 | 繁/簡 |
|---|---|---|
| 武器 | 3514/3514（100%） | 繁體 |
| 防具（件） | 1555/1555（100%） | 繁體 |
| 防具系列 | 343/343（100%） | 繁體 |
| 套裝加成 | 65/65（100%） | 繁體 |
| 裝飾珠 | 397/397（100%） | 繁體 |
| 護石 | 303/303（100%） | 繁體 |
| 技能逐級描述 | 408/418（97.6%） | 繁體 |

繁/簡判定（全體 zh 字串字形計數）：`龍(繁)=1463, 龙(簡)=0；劍(繁)=528, 剑(簡)=0；會(繁)=46, 会(簡)=0`
→ **確定為繁體中文**，與本專案一致。

**但**上表的「100%」是「有翻譯列者」的比率；真正落差是**整列翻譯缺失**（該實體在 `*_translations.csv` 根本沒有列），集中如下（落差 G2）。

---

## 四、落差清單（Gap List）

### G1（阻斷級）— mhw-db.com 武器停在基礎版 World，不可用於 Iceborne 武器
- 實測：mhw-db.com `/weapons` 共 1299 把，**rarity 最高僅 8**（基礎版上限）。
- Safi=0、Alatreon=0、Fatalis=0、Velkhana=0、Namielle=0、Ruiner=0（皆 Iceborne MR 武器）。Kjarr=20（基礎版 rarity8 熔山龍武器）。
- 對比 MHWorldData：rarity 12 有 516 把，Safi=115、Fatalis=24、Alatreon=22、Ruinous=14 —— 皆齊全。
- **結論**：武器一律取自 MHWorldData。mhw-db.com 的武器欄位（含 durability 逐匠斬味、attack.display）**不可用於 Iceborne 武器**，PLAN Phase 2「斬味由 durability 轉換」需改以 MHWorldData `weapon_sharpness.csv` 為源。

### G2（需 override）— MHWorldData 少數實體無 zh 翻譯列，集中於 Fatalis(黑龍)+活動套
- **套裝加成缺 zh（4）**：`New World`、**`Fatalis Legend`**、`Fun Fright Blessing`、`Sizzling Blessing`。
- **防具系列缺 zh（8）**：`Namielle γ+`、`Velkhana γ+`、`Passionate α+`、`Demonlord α+`、**`Dragon α+`/`Dragon β+`（＝Fatalis 防具）**、`Azure Age α+`、`Artemis α+`。
- **武器缺 zh（30）**：全為 Fatalis 系列（`Fatalis Blade`、`Dark Claw`、`True Fatalis Sword`…）等末期/活動武器。
- 影響面：以 Fatalis(黑龍) 系列 + 少數季節/活動/合作套為主。**其餘畢業級實體（Alatreon 煌黑龍、Safi 龍紋、Velkhana 冰呪龍、Silver Rathalos 銀火龍）zh 皆齊全。**
- 處理：Phase 2 建 `scripts/world/zh-name-overrides.json`（人工裁決，來源以 Kiranico MHWorld 繁中頁為準），**絕不手改產出檔**。約 42 筆需補。

### G3（需第三源裁決）— 護石最高階兩源歧異
- MHWorldData：Attack Charm 最高 **IV**；mhw-db.com：最高 **5**。
- 尚未判定何者正確（不憑記憶裁決）。Phase 2 以 Kiranico MHWorld 護石頁為第三源 tie-break，結論寫回本檔。

### G4（機制建模，非資料缺）— set bonus 與 secret 的資料形狀 vs PLAN 型別
- MHWorldData set bonus 形狀：每個 set bonus 一列，最多 2 組 `(skillName, requiredPieces)`；例 `Fatalis Legend` = Inheritance@2 + Transcendance@4、`Silver Rathalos Essence` = Slinger Ammo Secret@2 + True Critical Element@4。
- PLAN 型別 `SetBonus.ranks[]` 為 `{pieces, skillName, skillLevel}` 陣列 → 主源的 2 欄可乾淨映射為 ranks（skillLevel 預設 1）。無阻礙。
- secret 機制：`skill_base.csv` 有 `secret` 欄，**12 個技能** secret=2（Slugger/Agitator/Maximum Might/Latent Power/Heroics/Artillery/Free Meal/Bombardier/Divine Blessing/Slinger Capacity/Tool Specialist/Stamina Thief）。
  - **✅ 已於後續機械核對確認推導方向（修正 Phase 0 初判）**：`skill_levels.csv` 的 dataMax **已包含 secret 級數**，故：
    - `maxLevel(原生) = dataMax − Δ`、`secretMaxLevel = dataMax`（Δ 恆 2）。
    - 實測：挑戰者 dataMax 7 → 原生 5 / secret 7；KO術 5 → 3/5；精神抖擻 5 → 3/5；力量解放/火場怪力 7 → 5/7；滿足感 3 → 1/3。（早先誤記為「baseMax + delta」，方向相反，已更正。）
  - 每個 secret 技能都有對應「X‧極意」列（`skill_base` 中 `unlocks==該技能`），由 set bonus 授予 → `secretUnlockedBy`。
  - **特例**：Fatalis「Inheritance」Lv1 描述為「Removes the skill level cap for the skill secrets」＝**全域** secret 解放器（解除所有 secret 上限，非專指某技能）；Transcendance 為生存/utility。Phase 3 `resolveSkillMax` 需另建模此全域解放。
  - **攻擊 Attack Boost 無 secret**（原生上限即 7）——PLAN 舊例「攻擊 4→7 / 攻擊之力解放」為誤，已於 PLAN 修訂（C3）。資料足以機械推導，符合「不得硬編」要求。

---

## 五、與 PLAN 的衝突（實測為準，逐條點名）

> 依工作協議「遇 PLAN 與實測衝突以實測為準，寫進 docs 並點名」。以下不沉默繞過。

- **C1（阻斷）**：PLAN Phase 0 把 mhw-db.com 列為可用結構化武器源（`/weapons` 含 durability 斬味）。**實測其武器停在基礎版 World（max rarity 8，無任何 Iceborne 末期武器）**。→ 武器改以 MHWorldData 為唯一源；Phase 2「durability→斬味」改用 `weapon_sharpness.csv`。（已記為 G1。）

- **C2（用語錯誤）**：PLAN Phase 3 冒煙測試①寫「煌黑龍武器…組出含**煌黑套** 4 件（觸發**轉禍為福** + **攻擊之力解放**）」。實測：
  - 煌黑龍 = **Alatreon**（Alatreon Divinity = 煌黑龍的神秘），其 set bonus 為 Element Conversion@2 + All Elemental Resistance@3，**與「轉禍為福」「攻擊之力解放」無關**。
  - 「轉禍為福」= Transcendance，屬 **Fatalis Legend**（Fatalis 防具，EN 名 "Dragon" 套）= Inheritance@2 + Transcendance@4。
  - → PLAN 把 Alatreon(煌黑龍) 與 Fatalis(黑龍) 混為一談。Phase 3 冒煙測試①應正名（究竟要測 Alatreon 或 Fatalis 由人類定；資料兩者皆備）。

- **C3（機制錯誤）**：PLAN §1 機制表與 Phase 3 寫「技能上限動態：**攻擊 4→7**」「攻擊之力解放」。實測 World **無「攻擊之力解放」**——Attack Boost 原生上限即 7，無 secret 解放。secret/解放機制作用於**另外 12 個技能**（挑戰者 5→7、力量解放、鈍器…），非攻擊。
  - **對 Phase 1 schema 無影響**：`Skill.secretMaxLevel?/secretUnlockedBy?` 設計仍正確且必要，只是 PLAN 舉的「攻擊」例子錯；正確例為「挑戰者 5→7 via Agitator Secret」。schema 照原案推進。

- **C4（例子不精確，非缺）**：PLAN 舉的雙技能珠例「剛刃・攻擊珠」未以該確切中文名命中；同類 Lv4 雙技能攻擊珠齊全（19 個）。無資料缺，僅例名不精確。

---

## 六、決策規則落地（延續既有管線哲學）
- 主源 = 結構化程度最高者 = MHWorldData。
- zh 缺漏（G2，~42 筆）→ Phase 2 進 `scripts/world/zh-name-overrides.json`，來源以 Kiranico MHWorld 繁中頁裁決。
- 護石最高階歧異（G3）→ Kiranico 第三源 tie-break。
- 產出檔（`src/data/world/*.json`）一律機械產生、**絕不手改**；人工判斷全進 override 檔，重跑安全。
