// @ts-nocheck
/**
 * 武器派生樹推導 + 強化樹門檻傳播（原型，詳見 docs/WEAPON-TREE-DERIVATION-TODO.md）
 *
 * 分段：weapons.json 保持 Kiranico 列表順序，派生樹呈連續分段。
 * - rarity 重置（低於前一把）一律視為樹邊界。實測升級限定家族段
 *   （玄鐵/土砂/轟龍等）的真正父節點在其他段落，若不斷樹會錯誤繼承
 *   前一樹尾端門檻（嚴重高估）；斷樹則分支根不繼承（保守低估），
 *   寧可漏傳播也不錯傳播。
 * - 節點生產性三態：f 非空=可直接生產；f/u 皆空=初始配給（視同可生產）；
 *   僅 u=升級限定。升級限定的樹根＝父節點未知的分支根，列入可疑清單
 *   待影片抽驗校正。
 *
 * 門檻傳播：升級限定武器沿樹順序繼承前一階解鎖門檻（取較晚者）；
 * 可直接生產/初始配給武器重置傳播（自身門檻即有效門檻）。
 * 傳播值 src="tree-propagation"，信心度上限 inferred（鏈結構本身是推導）。
 *
 * 用法：node scripts/derive-weapon-trees.mjs [--types=great-sword,dual-blades] [--all] [--write]
 * 預設 report-only 不落盤；--write 產出 src/data/weaponTrees.json 並回寫
 * unlocks.json 的傳播條目。前置：import-unlocks.mjs 已產出 unlocks.json。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "src", "data");

const weapons = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "weapons.json"), "utf8"));
const unlocksFile = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "unlocks.json"), "utf8"));
const entries = unlocksFile.entries;
const mats = JSON.parse(fs.readFileSync(path.join(__dirname, "item-materials.json"), "utf8"));

const argTypes = process.argv.find((a) => a.startsWith("--types="));
const ALL_TYPES = [...new Set(weapons.map((w) => w.weaponType))];
const TYPES = process.argv.includes("--all")
  ? ALL_TYPES
  : argTypes
    ? argTypes.slice(8).split(",")
    : ["great-sword"];
const WRITE = process.argv.includes("--write");

/** 可直接生產 = 生產素材非空，或 f/u 皆空（初始配給/贈送武器，視同可生產）。 */
function isCraftable(id) {
  const m = mats[id];
  if (!m) return null; // 快照缺漏（理論上不會發生，發生則列警告）
  return m.f.length > 0 || m.u.length === 0;
}

/**
 * 解鎖條目 → 全域時間軸標量（比較「哪個門檻較晚」用）。
 * 多軸並存為 OR 語義（任一軸達標即可），故取各軸最早值。
 * 軸間粗略對齊：村v→v、集會所低位h1-3→h*2、上位h4-8→10+h、
 * Master m1-6→20+m、MR等級→26+(mr-10)/10（沿用 import-unlocks 的比例）。
 */
function earliestScalar(e) {
  const cands = [];
  if (e.v != null) cands.push(e.v);
  if (e.h != null) cands.push(e.h <= 3 ? e.h * 2 : 10 + e.h);
  if (e.m != null) cands.push(20 + e.m);
  if (e.mr != null) cands.push(26 + (e.mr - 10) / 10);
  return cands.length ? Math.min(...cands) : null;
}

const C_ORDER = { confirmed: 0, inferred: 1, unverified: 2 };

/** 傳播條目：沿用門檻來源(gate)的軸值，信心度取兩者較弱且上限 inferred。 */
function propagatedEntry(own, gate, gateName) {
  const c =
    C_ORDER[gate.e.c] >= C_ORDER.unverified || C_ORDER[own.c] >= C_ORDER.unverified
      ? "unverified"
      : "inferred";
  const out = {};
  for (const k of ["v", "h", "m", "mr"]) if (gate.e[k] != null) out[k] = gate.e[k];
  if (own.mon) out.mon = own.mon;
  out.note = `需先強化前一階（${gateName}）` + (gate.e.note ? `；${gate.e.note}` : "");
  out.c = c;
  out.src = "tree-propagation";
  return out;
}

const treesOut = [];
const nodesOut = {};
const propagations = [];
const suspects = [];
let missingSnapshot = 0;

for (const type of TYPES) {
  const list = weapons.filter((w) => w.weaponType === type);
  const trees = [];
  let cur = null;

  for (let i = 0; i < list.length; i++) {
    const w = list[i];
    const craft = isCraftable(w.id);
    if (craft == null) missingSnapshot++;
    const prev = i > 0 ? list[i - 1] : null;
    const isBoundary = !prev || w.rarity < prev.rarity;
    if (isBoundary && prev && !craft) {
      suspects.push({
        type,
        name: w.nameZh,
        rarity: w.rarity,
        prevName: prev.nameZh,
        prevRarity: prev.rarity,
        reason: "升級限定分支根（父節點未知，不繼承門檻）",
      });
    }
    if (isBoundary) {
      cur = { type, treeIndex: trees.length, name: w.seriesName ?? w.nameZh, nodes: [] };
      trees.push(cur);
    }
    cur.nodes.push({ w, craft });
  }

  // 門檻傳播（樹內線性鏈近似）
  for (const tree of trees) {
    let gate = null; // { e, s, name } 目前鏈上最晚門檻
    for (const { w, craft } of tree.nodes) {
      const own = entries[w.id];
      const ownS = earliestScalar(own);
      if (craft) {
        gate = { e: own, s: ownS, name: w.nameZh };
        continue;
      }
      if (gate && gate.s != null && ownS != null && gate.s > ownS) {
        // 既有人工覆寫（manual-verified）不動，只做比對驗證
        if (own.src === "manual-verified") {
          propagations.push({ type, name: w.nameZh, old: own, next: propagatedEntry(own, gate, gate.name), manualKept: true, gateName: gate.name });
        } else {
          const next = propagatedEntry(own, gate, gate.name);
          propagations.push({ type, name: w.nameZh, old: own, next, gateName: gate.name });
          if (WRITE) entries[w.id] = next;
        }
        gate = { ...gate, name: w.nameZh }; // 門檻值不變，鏈上名稱更新為本階
      } else if (ownS != null && (gate == null || gate.s == null || ownS > gate.s)) {
        gate = { e: own, s: ownS, name: w.nameZh };
      }
    }
  }

  for (const tree of trees) {
    const treeId = `${type}/${String(tree.treeIndex).padStart(2, "0")}`;
    treesOut.push({
      treeId,
      type,
      treeName: tree.name,
      nodeCount: tree.nodes.length,
      rootCraftable: tree.nodes[0].craft === true,
    });
    tree.nodes.forEach(({ w, craft }, nodeIndex) => {
      nodesOut[w.id] = { treeId, nodeIndex, craftable: craft === true };
    });
  }

  // ---- 報告 ----
  console.log(`\n═══ ${type}：${list.length} 把 → ${trees.length} 棵樹 ═══`);
  for (const tree of trees) {
    const first = tree.nodes[0];
    const rarities = tree.nodes.map((n) => `R${n.w.rarity}${n.craft ? "" : "*"}`).join(" ");
    console.log(`  [${String(tree.treeIndex).padStart(2)}] ${tree.name}（${tree.nodes.length} 節點，根${first.craft ? "可生產" : "⚠升級限定"}）: ${rarities}`);
  }
}

console.log(`\n─── 可疑邊界（rarity 重置但升級限定，${suspects.length} 筆）───`);
for (const s of suspects) {
  console.log(`  [${s.type}] ${s.prevName}(R${s.prevRarity}) → ${s.name}(R${s.rarity})`);
}

console.log(`\n─── 門檻傳播（${propagations.length} 筆）───`);
const fmt = (e) => JSON.stringify(e);
for (const p of propagations) {
  const tag = p.manualKept ? "（既有人工覆寫，保留；傳播值供比對）" : "";
  console.log(`  [${p.type}] ${p.name} ← 繼承「${p.gateName}」${tag}`);
  console.log(`      ${fmt(p.old)}`);
  console.log(`    → ${fmt(p.next)}`);
}

if (missingSnapshot) console.warn(`\n⚠ 素材快照缺漏 ${missingSnapshot} 件（craftable 未知，視為樹內節點）`);

if (WRITE) {
  const out = {
    meta: {
      source: "derive-weapon-trees.mjs — Kiranico 列表順序分段（rarity 重置×可直接生產）+ 線性鏈門檻傳播",
      fields: "trees[]: treeId/type/treeName/nodeCount/rootCraftable; nodes{weaponId}: treeId/nodeIndex/craftable",
      caveat: "分岔形狀為線性鏈近似，升級限定分支根不繼承門檻（保守低估），待影片抽驗校正",
      types: TYPES,
    },
    trees: treesOut,
    nodes: nodesOut,
  };
  fs.writeFileSync(path.join(DATA_DIR, "weaponTrees.json"), JSON.stringify(out, null, 1) + "\n");
  fs.writeFileSync(path.join(DATA_DIR, "unlocks.json"), JSON.stringify(unlocksFile, null, 1) + "\n");
  console.log(`\n✓ 已寫入 weaponTrees.json（${treesOut.length} 棵樹）並回寫 unlocks.json（${propagations.filter((p) => !p.manualKept).length} 筆傳播）`);
} else {
  console.log("\n（report-only，未落盤；加 --write 寫入）");
}
