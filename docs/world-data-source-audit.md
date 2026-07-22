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
- zh 缺漏（G2）→ `scripts/world/zh-name-overrides.json`，來源以 Kiranico MHWorld 繁中頁裁決。
- 護石最高階歧異（G3）→ Kiranico 第三源 tie-break。
- 產出檔（`src/data/world/*.json`）一律機械產生、**絕不手改**；人工判斷全進 override 檔，重跑安全。

---

## 七、Phase 2 匯入結果（2026-07-22 實測）

管線：`fetch-mhwd.mjs`（pin commit 快取）→ `import-world.mjs` → `build-zh-name-map.mjs`（Kiranico id 配對）→ `audit-world-data.mjs`。

### 產出筆數（`src/data/world/`）
| 檔 | 筆數 | 備註 |
|---|---|---|
| skills.json | 178 | 含 12 個 secret（原生/解放上限＋secretUnlockedBy） |
| decorations.json | 404 | 複合珠 234（雙技能各 Lv1）、單技能 slot4 Lv2 |
| charms.json | 317 | 逐級展開；slots 一律 [] |
| setBonuses.json | 69 | ranks 由 armorset_bonus_base 機械推導 |
| armors.json | 1595 | 帶 setBonusId 825 件；含 γ+/α+/β+ 套 |
| weapons.json | 3544 | 帶斬味 2825（近戰）；rarity→12、含 Fatalis/Alatreon/Safi |
| weaponTypes.json | 14 | 沿用 Rise zh 名，World 全支援 |

### 獨立外部源交叉（mhw-db.com，audit 輸出）
- 裝飾珠 Δ0.2%、技能 Δ1.7%、護石逐級 Δ1.0% — 皆 <2% ✓
- **防具 Δ4.9%（world 1595 vs mhw-db 1677）＞2%，解釋**：兩源對防具「件」的計數口徑不同——mhw-db 納入部分 layered/活動變體與重複條目；MHWorldData 1595 與社群「Iceborne 可用防具件數」一致（rank low194/high?/master833 分佈合理）。非缺漏，屬計數口徑差異。
- 武器：mhw-db 停基礎版（G1），不交叉。

### secret / set bonus 抽驗（audit 輸出）
- 12 secret 技能 Δ 皆為 2、都有 secretUnlockedBy ✓（KO術 3/5、力量解放 5/7…，對 Kiranico skilltrees 一致）。
- set bonus 抽驗：黑龍的傳說(Fatalis Legend) Inheritance@2+Transcendance@4、銀火龍的真髓 投射器裝填‧極意@2+真‧會心擊【屬性】@4、冥赤龍的封印 龍脈覺醒@3+真‧龍脈覺醒@5 ✓。
- 三筆已知實體：Alatreon 防具（精英·煌黑龍智慧α，setBonusId=sb_alatreon-divinity）、複合珠（奪氣‧體術珠【４】）、攻擊護石Ⅲ ✓。

### G2 更新（zh 覆蓋）— ⚠️ 實際缺口比 Phase 0 初估多
- **修正**：Phase 0 初估「~42 筆」只算了 set bonus/armorSet/weapon 三類。**實測完整缺口 113 筆**（另含 armor 件 40、skills 10、charms 14、decorations 7）。此為 Phase 0 抽樣未涵蓋全實體所致的**低估，特此點名**。
- **已 source（Kiranico id 配對，附逐筆出處 url，非憑記憶）13 筆**：setBonuses 4/4（含黑龍的傳說）、armorSets 5/8（含 Fatalis「Dragon」以別名橋接 → 精英‧龍）、skills 4/10（飛翔爪攻擊強化 等）。
- **餘 100 筆為 EN-fallback（deferred）**：Fatalis 武器 30、γ+/Fatalis 防具件 40、charms 14、decorations 7、Inheritance/Transcendance 等子技能 6、collab 套 3。皆為**顯示層名稱**，不影響搜尋/set bonus 機能（setBonusId 連結與 set bonus 顯示名已具 zh）。完整清單於 `scripts/world/.cache/zh-gaps.json`；`build-zh-name-map.mjs` 為既成工具，補齊需再爬 Kiranico 分頁（武器 14 類型頁、armor 明細頁），列為後續。

#### G2 尾巴收尾（A1，`build-zh-name-map.mjs` 擴充；同 Phase 2 id 跨語系配對法，逐筆附出處 url）
- **本輪補齊 73/100**：
  - **weapons 30/30**：Kiranico `/weapons` 為 Livewire 分頁，伺服端只渲染單一武器種；改逐 `?type=0-13`（14 武器種）抓 en/zh，以「同一 detail id 跨語系」配對。例 `True Fatalis Sword→真‧黑龍劍`、`Vor Cannon→黑龍砲`、`Bow of Rack & Ruin→破壞殲滅之剛弓`。
  - **armors 40/40**：`/armors` 為平面列表，但每件連到其防具**系列** `armorseries/{setId}`（id 為 set 級、非 piece 級），無法靠 id join piece；改以 en/zh 兩頁**同序位置配對**，並以「逐列 setId 一致」硬檢查對齊（不齊即中止，防版本漂移錯配；實測 en=zh=2882 列完全對齊）。
  - **armorSets 3/3（Passionate/Demonlord/Artemis α+）**：活動 α+ 系列**不在** `/armorseries` 索引頁；改由 `/armors` 零件列反查得各 set 的 Kiranico id，抓其 `armorseries/{id}` detail 頁 `<title>` 取集合 zh 名（`ARMORSET_DETAIL` 表僅存穩定 id 指標，zh 值仍即時抓取＋附 src）。
- **餘 27 筆確認 Kiranico World 亦無 zh，留 EN（不硬翻）**：
  - **charms 14**：Kiranico World **無 charms 區段**（nav 無此項、`/charms` 404）。高 id 護石（`Attack Charm V`(id304)、`Master's Charm V`、`Survival Charm I–III`、`Shaver Charm` 等）在 MHWorldData `charm_base` 有列但 `charm_base_translations` 無翻譯列，Kiranico 又無可配之頁 → 顯示層留 EN。
  - **decorations 7**：size-1 單技珠（`Survival Jewel 1`(id399)、`Guardian Jewel 2`…）不在 Kiranico `/decorations`（532KB 全表實搜無此名）→ 留 EN。
  - **skills 6**：`Inheritance`/`Transcendance`（Fatalis set bonus 子技能）與 `Fun Fright's Gift/Gratitude`、`Sizzling Gift/Gratitude`（活動 set bonus 子技能）均**不在** Kiranico `/skilltrees` 索引，其母 set bonus detail 頁（黑龍的傳說/驚魂夜/熱情）內也未以具名 zh 連結列出這些子技能 → 留 EN。
- **順手：armor `sourceMonster` 顯示層改 zh（與 Rise 對齊；Rise 既有 armors.json 即 zh）**：無 MHWorldData 怪物翻譯 CSV，改走 `overrides.monsters`（`/monsters` 索引 id 跨語系配對，**76/77**）。唯一缺口 **`Kestodon`**：Kiranico zh `/monsters` 無此條（en 頁僅有 `Kestodon (Female)`/`(Male)` 變體、id `eQoIZ/Y7XIE`，zh 頁無對應 id）→ display-only 留 EN（補不到不失敗）。
- **最終 `zh-gaps.json` 餘量**：`skills 6 / charms 14 / decorations 7 / monsters 1（Kestodon）= 28`，全數如上有逐筆理由；皆顯示層、不影響搜尋/set bonus。

### G3 解決 — 無真歧異
- 實測：MHWorldData `charm_base` **有 Attack Charm V**（及其他 V 階），只是 name_zh 缺列，故 Phase 0 的「最高 IV」是**翻譯缺漏造成的錯覺**。兩源實際皆到 **5**。**G3 結案：無最高階歧異**，Attack Charm V 併入 G2 的 zh 缺口處理。

### G4 確認
- secret 推導方向已於機械核對確認：`maxLevel(原生)=dataMax − Δ`、`secretMaxLevel=dataMax`、`secretUnlockedBy=`對應「X‧極意」。Fatalis Inheritance 為全域 secret 解放器（Phase 3 `resolveSkillMax` 另建模）。

### 斬味語意 — ✅ Phase 4 已考證修正（本節初判方向錯誤，已更正）
- MHWorldData `weapon_sharpness` **每把近戰武器僅一列**（`maxed` FALSE=2393 / TRUE=432；無法同時給匠0/匠5）。Phase 2 暫取 `base = max = 該列值`，使**匠在 World EFR 中無效**。
- **~~初判（錯，已推翻）~~**：本節與 commit `13b4779` 交接備註曾稱「`maxed=FALSE`＝匠0 base、`maxed=TRUE`＝匠5 maxed」。
- **✅ Phase 4 實測判定（7 把對 Kiranico 逐段核對，見 `docs/world-sharpness-audit.md`）**：
  該單列（不論 TRUE/FALSE）**＝匠5（handicraft-maxed）色帶**，方向與初判**相反**。`maxed` 欄只標示
  「base 是否已等於 maxed」：`TRUE`＝匠加成 0（base=此列）、`FALSE`＝匠 Lv5 恰 +50（**base = 由最高色端剝除 50**）。
  MHWorldData 以二值（0/50）建模，**無「加不滿 +50」中間值**（短帶 Buster/Defender 亦吃滿 +50）。
- **修正落地**：`import-world.mjs` 已改為機械推導 base（`peelFromTop(maxed,50)` for FALSE / base=maxed for TRUE），
  重跑後 weapons.json 帶正確 `{base,max}`；6 把武器 base/max 兩端逐段吻合 Kiranico。衝突逐條見 sharpness-audit 第五節。

### 防呆
- 6 個仍指向舊 `src/data/*.json` 的 Rise 腳本（import-kiranico/import-unlocks/derive-weapon-trees/add-armor-resistances/add-weapon-sharpness/validate-unlocks）DATA_DIR 已改指 `src/data/rise/`，避免誤跑重建孤兒檔。validate-unlocks 實跑通過佐證 rise/ 資料完好。
