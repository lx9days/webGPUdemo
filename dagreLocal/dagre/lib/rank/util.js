"use strict";

const { applyWithChunking } = require("../util");

module.exports = {
  longestPath: longestPath,
  minWidth_algo: minWidth_consider_minLen,
  stretchWidth_algo: stretchWidth_consider_minLen,
  slack: slack
};

/*
 * Initializes ranks for the input graph using the longest path algorithm. This
 * algorithm scales well and is fast in practice, it yields rather poor
 * solutions. Nodes are pushed to the lowest layer possible, leaving the bottom
 * ranks wide and leaving edges longer than necessary. However, due to its
 * speed, this algorithm is good for getting an initial ranking that can be fed
 * into other algorithms.
 *
 * This algorithm does not normalize layers because it will be used by other
 * algorithms in most cases. If using this algorithm directly, be sure to
 * run normalize at the end.
 *
 * Pre-conditions:
 *
 *    1. Input graph is a DAG.
 *    2. Input graph node labels can be assigned properties.
 *
 * Post-conditions:
 *
 *    1. Each node will be assign an (unnormalized) "rank" property.
 */
function longestPath(g) {
  var visited = {};

  function dfs(v) {
    var label = g.node(v);
    if (Object.hasOwn(visited, v)) {
      return label.rank;
    }
    visited[v] = true;

    let outEdgesMinLens = g.outEdges(v).map(e => {
      if (e == null) {
        return Number.POSITIVE_INFINITY;
      }

      return dfs(e.w) - g.edge(e).minlen;//
    });

    var rank = applyWithChunking(Math.min, outEdgesMinLens);

    if (rank === Number.POSITIVE_INFINITY) {
      rank = 0;
    }
    return (label.rank = rank);
  }
  g.sources().forEach(dfs);
  let nodeRanks = g.nodes().map(v => g.node(v).rank);
  console.log(nodeRanks);

}

/*
 * Returns the amount of slack for the given edge. The slack is defined as the
 * difference between the length of the edge and its minimum length.
 */
function slack(g, e) {
  return g.node(e.w).rank - g.node(e.v).rank - g.edge(e).minlen;
}


function minWidth_consider_minLen(g, { UBW = 50, c = 2, strategy = 'A1', promotion = true } = {}) {
  const U = new Set();     // 已分层节点
  const Z = new Set();     // 当前层以下的节点
  let currentRank = 0;     // 从终点 0 向源头递减
  let widthCurrent = 0;    // 当前层宽度估计
  let widthUp = 0;         // 上层宽度估计
  const dummyWidth = 1;    // 每条边的 dummy 节点宽度估计
  const nodeWidth = 1;     // 原始节点宽度，固定为 1（可扩展）
  let emptyFlag = true;
  // 初始化所有节点的 rank


  g.nodes().forEach(v => {
    g.node(v).rank = null;
  });

  while (U.size < g.nodeCount()) {
    // 所有候选节点：未分层、所有后继都已在 Z 中
    // 严格候选筛选：后继都分层，且满足 minlen 约束
    const candidates = g.nodes().filter(v => {
      /* --- ① 已分层节点直接排除 --- */
      if (U.has(v)) return false;

      return (g.successors(v) || []).every(w => {
        if (!Z.has(w)) return false;            // 后继必须已在 Z
        const minlen = (g.edge(v, w)?.minlen) ?? 1;
        return currentRank <= g.node(w).rank - minlen;
      });
    });



    if (candidates.length === 0) {
      // 当前层结束，切换上一层
      for (const v of U) Z.add(v);
      currentRank -= 1;
      widthCurrent = widthUp;
      // 换层时，如果是 A2A3，不清零 widthUp
      if (strategy == 'A1') {
        widthUp = 0;
      }
      // console.log(currentRank, widthCurrent, widthUp, "end");//no candidate then go up
      emptyFlag = true//新层为空
      continue;
    }

    // === 应用 A1/A2/A3 策略选择节点 ===
    const v = selectNode(candidates, g, strategy);


    // === 更新当前层宽度（加入节点前计算） ===
    const dOut = (g.outEdges(v) || []).length;
    widthCurrent = widthCurrent - dummyWidth * dOut + nodeWidth;

    // === 更新上层宽度估计（当前节点产生 dIn 个 dummy）===
    let dIn = (g.inEdges(v) || []).length - 1;
    if (dIn < 0) {
      dIn = 0; // 避免负值
    }
    if (strategy == 'A1') {
      widthUp = widthUp + dummyWidth * dIn;
    } else {
      widthUp = widthUp + dummyWidth * (dIn - dOut);
    }


    // === 判断是否需要跳到新层（ConditionGoUp） ===
    const shouldGoUp =
      (widthCurrent >= UBW && dOut === 0) ||// only apply widthCurrent ≥ UBW if dOut == 0 (i.e., d⁺(v) < 1), as per paper
      (widthUp >= c * UBW);
    // === 分配当前节点 rank，加入 U 集 ===
    g.node(v).rank = currentRank;
    U.add(v);
    emptyFlag = false//分配节点后当前层不空
    if (shouldGoUp) {
      if (emptyFlag) {
        // alert(1)
        return false
      }
      for (const v of U) Z.add(v);
      // console.log(currentRank, widthCurrent, widthUp, widthUp >= c * UBW ? "up" : "current");//why go up?

      currentRank -= 1;
      widthCurrent = widthUp;
      // 换层时，如果是 A2A3，不清零 widthUp
      if (strategy == 'A1') {
        widthUp = 0;
      }

      emptyFlag = true//新层为空
      continue;
    }


  }

  // ✅ 输出最终 rank（可注释掉）
  const nodeRanks = g.nodes().map(v => g.node(v).rank);
  console.log("Final ranks:", nodeRanks);
  // g.nodes().forEach(v => {
  //   g.node(v).rank -- // ★ rank 越小越靠上
  // })
  if (promotion) {
    // promoteLayering(g);
  }
  const nodeRanks2 = g.nodes().map(v => g.node(v).rank);
  console.log("Promote ranks:", nodeRanks2);
  console.log(g.nodes());

  return true
}





function stretchWidth_consider_minLen(g, { UBW = 1, c = 2, strategy = 'rank' } = {}) {
  console.log("stretch");
  
  const U = new Set();     // 已分层节点
  const Z = new Set();     // 当前层以下的节点
  let currentRank = 0;     // 从终点 0 向源头递减
  let widthCurrent = 0;    // 当前层宽度估计
  let widthUp = 0;         // 上层宽度估计
  let widthCurrentTry = 0;
  let widthUpTry = 0;
  const dummyWidth = 1;    // 每条边的 dummy 节点宽度估计
  const nodeWidth = 1;     // 原始节点宽度，固定为 1（可扩展）
  let emptyFlag = true;
  // 初始化所有节点的 rank
  c = g.edges().length / g.nodes().length
  console.log("c:", c);



  g.nodes().forEach(v => {
    g.node(v).rank = null;
  });

  while (U.size < g.nodeCount()) {
    // 所有候选节点：未分层、所有后继都已在 Z 中
    // 严格候选筛选：后继都分层，且满足 minlen 约束
    const candidates = g.nodes().filter(v => {
      /* --- ① 已分层节点直接排除 --- */
      if (U.has(v)) return false;

      // /* --- ② 入度为 0 的节点，立即接受 --- */
      // if ((g.inEdges(v) || []).length === 1) return true;

      return (g.successors(v) || []).every(w => {
        if (!Z.has(w)) return false;            // 后继必须已在 Z
        const minlen = (g.edge(v, w)?.minlen) ?? 1;
        return currentRank <= g.node(w).rank - minlen;
      });
    });


    if (candidates.length === 0) {
      // 当前层结束，切换上一层
      for (const v of U) Z.add(v);
      currentRank -= 1;
      widthCurrent = widthUp;
      // 换层时，如果是 A2A3，不清零 widthUp
      if (strategy == 'A1' || strategy == 'rank') {
        widthUp = 0;
      }
      // console.log(currentRank, widthCurrent, widthUp, "end");//no candidate then go up
      emptyFlag = true//新层为空
      continue;
    }

    // === 应用 A1/A2/A3 策略选择节点 ===
    const v = selectNode(candidates, g, strategy);
    // console.log(v);



    // === 更新当前层宽度（加入节点前计算） ===
    const dOut = (g.outEdges(v) || []).length;
    widthCurrentTry = widthCurrent - dummyWidth * dOut + nodeWidth;

    // === 更新上层宽度估计（当前节点产生 dIn 个 dummy）===
    let dIn = (g.inEdges(v) || []).length - 1;
    if (dIn < 0) {
      dIn = 0; // 避免负值
    }
    if (strategy == 'A1' || strategy == 'rank') {
      widthUpTry = widthUp + dummyWidth * dIn;
    } else {
      widthUpTry = widthUp + dummyWidth * (dIn - dOut);
    }


    // === 判断是否需要跳到新层（ConditionGoUp） ===
    const shouldGoUp =
      (widthCurrentTry > UBW) ||// only apply widthCurrent ≥ UBW if dOut == 0 (i.e., d⁺(v) < 1), as per paper
      (widthUpTry > c * UBW);
    if (shouldGoUp) {
      if (emptyFlag) {
        // alert(1)
        return false
      }
      for (const v of U) Z.add(v);
      // console.log(currentRank, widthCurrent, widthUp, widthUp >= c * UBW ? "up" : "current");

      currentRank -= 1;
      widthCurrent = widthUp;
        widthUp = 0;

      emptyFlag = true//新层为空
      continue;
    }

    widthCurrent = widthCurrentTry
    widthUp = widthUpTry
    // === 分配当前节点 rank，加入 U 集 ===
    g.node(v).rank = currentRank;
    U.add(v);
    emptyFlag = false//分配节点后当前层不空

  }

  // ✅ 输出最终 rank（可注释掉）
  const nodeRanks = g.nodes().map(v => g.node(v).rank);
  console.log("Final ranks:", nodeRanks);
  return true
}


/* ---------- 节点选择策略 ---------- */
function selectNode(candidates, g, strategy = "rank") {
  const zeroInList = candidates.filter(
    v => (g.inEdges(v) || []).length === 1
  );
  if (zeroInList.length) {
    return zeroInList[0];
  }
  switch (strategy) {
    case "A1":   // 论文 MinWidth: 最大出度
      return candidates.reduce((a, b) =>
        (g.outEdges(a)?.length || 0) > (g.outEdges(b)?.length || 0) ? a : b
      );

    case "A2":   // 最大 d⁺ - d⁻
      return candidates.reduce((a, b) =>
        ((g.outEdges(a)?.length || 0) - (g.inEdges(a)?.length || 0)) >
          ((g.outEdges(b)?.length || 0) - (g.inEdges(b)?.length || 0)) ? a : b
      );

    case "A3":   // v 或其前驱最大 d⁺ - d⁻
      return candidates.reduce((a, b) => score(a) > score(b) ? a : b);

    case "rank": // ★ StretchWidth 原生 ranking：max{d⁺(v), max d⁺(pred(v))}
    default:
      return candidates.reduce((a, b) =>
        rankScore(a) > rankScore(b) ? a : b
      );
  }

  function score(v) {
    const self = (g.outEdges(v)?.length || 0) - (g.inEdges(v)?.length || 0);
    const preds = (g.predecessors(v) || []).map(p =>
      (g.outEdges(p)?.length || 0) - (g.inEdges(p)?.length || 0)
    );
    return Math.max(self, ...preds);
  }
  function rankScore(v) {
    const preds = (g.predecessors(v) || []);
    const maxPredOut = preds.reduce(
      (m, p) => Math.max(m, (g.outEdges(p) || []).length), 0);
    return Math.max((g.outEdges(v) || []).length, maxPredOut);
  }
}


/**
 * Promotion 后处理 —— 减少 dummy 节点而不增加层宽
 * @param {Graph} g  dagre/graphlib 图（要求节点已带 .rank，边已设 .minlen == MINLEN）
 * @param {Object}  [opts]
 *        - keepWidth  : 是否严格禁止任何层宽增加
 *        - minlen     : 预处理统一写入的 minlen（默认 2）
 */
function promoteLayering(
  g,
  { keepWidth = true, minlen: MINLEN = 2 } = {}
) {
  // === 1.1 先数真实节点 ===
  const layerWidth = new Map();
  g.nodes().forEach(v => {
    const r = g.node(v).rank;
    layerWidth.set(r, (layerWidth.get(r) || 0) + 1);
  });
  // === 1.2 再把每条边会生成的 dummy 算进去 ===
  g.edges().forEach(e => {
    const u = e.v;
    const v = e.w;

    /* --- 0. 过滤自环或虚拟根相关边 --------------------- */
    // if (u === v) return;                              // 自环
    // const hasUndefined = id => typeof id === "string" && id.includes("object Undefined");
    // if (hasUndefined(u) || hasUndefined(v)) return;   // 与虚拟根相连
    const uRank = g.node(e.v).rank;
    const vRank = g.node(e.w).rank;
    const span = Math.abs(vRank - uRank);     // 下行 / 上行都行
    const dummyCnt = Math.max(0, span / MINLEN - 1);

    for (let i = 1; i <= dummyCnt; ++i) {
      const dummyLayer = uRank < vRank               // 下行边
        ? uRank + i * MINLEN
        : uRank - i * MINLEN;                        // 上行边（少见）
      layerWidth.set(dummyLayer,
        (layerWidth.get(dummyLayer) || 0) + 1);
    }
  });

  let origMaxWidth = Math.max(...layerWidth.values());
  console.log(layerWidth);

 /* ---------- 2. 递归试提升 ---------- */
function simulatePromote(v, visited = new Set()) {
  if (visited.has(v)) return { ok: true, diff: 0, touched: [] };
  visited.add(v);

  const rank   = g.node(v).rank;
  const upRank = rank - MINLEN;            // 向上跨 MINLEN (=2) 层
  // 不再限制 upRank >= 0 —— 允许继续开新负层

  /* 2.1 先递归提升“恰好在 upRank 的前驱” */
  let diff = 0;          // dummy 改变量（负数 = 减少）
  let touched = [];

  for (const e of g.inEdges(v) || []) {
    const u = e.v;
    if (g.node(u).rank === upRank) {
      const res = simulatePromote(u, visited);
      if (!res.ok) return { ok: false, diff: 0, touched: [] };
      diff     += res.diff;
      touched.push(...res.touched);
    }
  }

  /* 2.2 计算本节点上提后每条边 dummy 变化，并检查 minlen */
  const dummyCnt = span => Math.max(0, span / MINLEN - 1);
  const skipEdge = id => typeof id === "string" && id.includes("object Undefined");

  // --- 入边 ---
  for (const e of g.inEdges(v) || []) {
    const u = e.v;
    if (skipEdge(u)) continue;                 // 虚拟根边完全忽略
    const spanOld = rank   - g.node(u).rank;   // 原跨度 ≥ MINLEN
    const spanNew = upRank - g.node(u).rank;
    if (spanNew < MINLEN)                     // 违反 minlen
      return { ok: false, diff: 0, touched: [] };
    diff += dummyCnt(spanNew) - dummyCnt(spanOld);
  }

  // --- 出边 ---
  for (const e of g.outEdges(v) || []) {
    const w = e.w;
    if (skipEdge(w)) continue;
    const spanOld = g.node(w).rank - rank;
    const spanNew = g.node(w).rank - upRank;
    if (spanNew < MINLEN)
      return { ok: false, diff: 0, touched: [] };
    diff += dummyCnt(spanNew) - dummyCnt(spanOld);
  }

  /* 2.3 层宽试算（只看真实节点；dummy 已进 diff） */
  if (keepWidth) {
    const curNew = layerWidth.get(rank) - 1;          // 当前层少 1
    const upNew  = (layerWidth.get(upRank) || 0) + 1; // 上层多 1
    if (curNew > origMaxWidth || upNew > origMaxWidth)
      return { ok: false, diff: 0, touched: [] };
  }

  touched.push(v);
  return { ok: true, diff, touched };
}

  /* ---------- 3. 真正提交 ---------- */
  function commitPromote(touched) {
    for (const v of touched) {
      const r0 = g.node(v).rank;
      const r1 = r0 - MINLEN;          // 新层
      layerWidth.set(r0, layerWidth.get(r0) - 1);
      layerWidth.set(r1, (layerWidth.get(r1) || 0) + 1);
      g.node(v).rank = r1;
    }
    // 更新最大层宽
    origMaxWidth = Math.max(...layerWidth.values());
  }

  /* ---------- 4. 外层迭代，直到再无改进 ---------- */
  let improved;
  do {
    improved = false;

    for (const v of g.nodes()) {
      if ((g.inEdges(v) || []).length === 0) continue; // 源点无法上提

      const { ok, diff, touched } = simulatePromote(v);
      console.log(ok, diff, touched);
      if (ok && diff < 0) {        // dummy 数真正下降
        commitPromote(touched);
        improved = true; console.log("diff", diff);

      }
    }
  } while (improved);
}