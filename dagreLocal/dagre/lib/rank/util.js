"use strict";

const { applyWithChunking } = require("../util");

module.exports = {
  longestPath: longestPath,
  longestPath_iterative: minWidth_consider_minLen,
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


function minWidth_consider_minLen(g, { UBW = 40, c = 1.2, strategy = 'A2' } = {}) {
  const U = new Set();     // 已分层节点
  const Z = new Set();     // 当前层以下的节点
  let currentRank = 0;     // 从终点 0 向源头递减
  let widthCurrent = 0;    // 当前层宽度估计
  let widthUp = 0;         // 上层宽度估计
  const dummyWidth = 1;    // 每条边的 dummy 节点宽度估计
  const nodeWidth = 1;     // 原始节点宽度，固定为 1（可扩展）

  // 初始化所有节点的 rank
  g.nodes().forEach(v => {
    g.node(v).rank = null;
  });

  while (U.size < g.nodeCount()) {
    // 所有候选节点：未分层、所有后继都已在 Z 中
    // 严格候选筛选：后继都分层，且满足 minlen 约束
    const candidates = g.nodes().filter(v =>
      !U.has(v) &&
      (g.successors(v) || []).every(w => {
        if (!Z.has(w)) return false;
        const edge = g.edge(v, w);
        // console.log(v,w, edge.minlen);
        
        const minlen = edge?.minlen || 1;
        return currentRank <= g.node(w).rank - minlen;
      })
    );

    if (candidates.length === 0) {
      // 当前层结束，切换上一层
      for (const v of U) Z.add(v);
      currentRank -= 1;
      widthCurrent = widthUp;
      widthUp = 0;
      continue;
    }

    // === 应用 A1/A2/A3 策略选择节点 ===
    const v = selectNode(candidates, g, strategy);

    // === 更新当前层宽度（加入节点前计算） ===
    const dOut = (g.outEdges(v) || []).length;
    widthCurrent = widthCurrent - dummyWidth * dOut + nodeWidth;

    // === 更新上层宽度估计（当前节点产生 dIn 个 dummy）===
    const dIn = (g.inEdges(v) || []).length;
    widthUp = widthUp + dummyWidth * dIn;

    // === 判断是否需要跳到新层（ConditionGoUp） ===
    const shouldGoUp =
      (widthCurrent >= UBW && dOut === 0) ||
      (widthUp >= c * UBW);

    if (shouldGoUp) {
      for (const v of U) Z.add(v);
      currentRank -= 1;
      widthCurrent = widthUp;
      widthUp = 0;
      continue;
    }

    // === 分配当前节点 rank，加入 U 集 ===
    g.node(v).rank = currentRank;
    U.add(v);
  }

  // ✅ 输出最终 rank（可注释掉）
  const nodeRanks = g.nodes().map(v => g.node(v).rank);
  console.log("Final ranks:", nodeRanks);
}


function selectNode(candidates, g, strategy = 'A1') {
  switch (strategy) {
    case 'A1': // 最大出度 d+(v)
      console.log("A1");
      return candidates.reduce((a, b) =>
        (g.outEdges(a)?.length || 0) > (g.outEdges(b)?.length || 0) ? a : b
      );

    case 'A2': // 最大 d+(v) - d-(v)
      console.log("A2");
      return candidates.reduce((a, b) =>
        ((g.outEdges(a)?.length || 0) - (g.inEdges(a)?.length || 0)) >
          ((g.outEdges(b)?.length || 0) - (g.inEdges(b)?.length || 0)) ? a : b
      );

    case 'A3': // v 或其前驱最大 d+ - d-
      console.log("A3");
      return candidates.reduce((a, b) =>
        getScore(a, g) > getScore(b, g) ? a : b
      );

    default:
      return candidates[0]; // 默认取第一个
  }

  function getScore(v, g) {
    const self = (g.outEdges(v)?.length || 0) - (g.inEdges(v)?.length || 0);
    const preds = (g.predecessors(v) || []).map(p =>
      (g.outEdges(p)?.length || 0) - (g.inEdges(p)?.length || 0)
    );
    return Math.max(self, ...preds);
  }
}

// function longestPath_iterative(g) {
//   const inDegree = new Map();
//   const rank = new Map();

//   // 计算 outDegree（因为我们要“反向”处理）
//   g.nodes().forEach(v => {
//     inDegree.set(v, 0);
//     rank.set(v, Number.POSITIVE_INFINITY);
//   });

//   // 构建反向图的 in-degree
//   g.edges().forEach(e => {
//     inDegree.set(e.v, inDegree.get(e.v) + 1);
//   });

//   const queue = [];

//   g.nodes().forEach(v => {
//     if (inDegree.get(v) === 0) {
//       rank.set(v, 0);  // ✅ 终点 rank 为 0
//       queue.push(v);
//     }
//   });

//   while (queue.length > 0) {
//     const v = queue.shift();
//     const vRank = rank.get(v);

//     (g.inEdges(v) || []).forEach(e => {
//       const u = e.v; // ← 因为我们处理反向边 u → v
//       const minlen = g.edge(e).minlen || 1;

//       // ✅ mimic: rank(u) = min( rank(v) - minlen )
//       const proposed = vRank - minlen;
//       if (rank.get(u) > proposed) {
//         rank.set(u, proposed);
//       }

//       inDegree.set(u, inDegree.get(u) - 1);
//       if (inDegree.get(u) === 0) {
//         queue.push(u);
//       }
//     });
//   }

//   // 最后写回节点属性
//   rank.forEach((r, v) => {
//     g.node(v).rank = r;
//   });
//   let nodeRanks = g.nodes().map(v => g.node(v).rank);
//   console.log(nodeRanks);
// }



// function longestPath_iterative(g, strategy = 'A1') {
//   const inDegree = new Map();
//   const rank = new Map();

//   g.nodes().forEach(v => {
//     inDegree.set(v, 0);
//     rank.set(v, Number.POSITIVE_INFINITY);
//   });

//   g.edges().forEach(e => {
//     inDegree.set(e.v, inDegree.get(e.v) + 1);
//   });

//   const queue = [];

//   // 起始点为终点（无出边的点），其 rank 为 0
//   g.nodes().forEach(v => {
//     if (inDegree.get(v) === 0) {
//       rank.set(v, 0);
//       queue.push(v);
//     }
//   });

//   while (queue.length > 0) {
//     // === 选择下一个要处理的节点 ===
//     const v = selectNode(queue, g, strategy);
//     queue.splice(queue.indexOf(v), 1); // 从 queue 中移除

//     const vRank = rank.get(v);

//     // 处理所有“反向”边 u → v，更新 u 的 rank
//     (g.inEdges(v) || []).forEach(e => {
//       const u = e.v;
//       const minlen = g.edge(e).minlen || 1;

//       const proposed = vRank - minlen;
//       if (rank.get(u) > proposed) {
//         rank.set(u, proposed);
//       }

//       inDegree.set(u, inDegree.get(u) - 1);
//       if (inDegree.get(u) === 0) {
//         queue.push(u);
//       }
//     });
//   }

//   // 写回 rank
//   rank.forEach((r, v) => {
//     g.node(v).rank = r;
//   });

//   let nodeRanks = g.nodes().map(v => g.node(v).rank);
//   console.log("Final ranks:", nodeRanks);
// }

// function selectNode(candidates, g, strategy = 'A1') {
//   switch (strategy) {
//     case 'A1': // 最大出度
//       return candidates.reduce((a, b) =>
//         (g.outEdges(a)?.length || 0) > (g.outEdges(b)?.length || 0) ? a : b
//       );
//     case 'A2': // 最大 d+(v) - d-(v)
//       return candidates.reduce((a, b) =>
//         ((g.outEdges(a)?.length || 0) - (g.inEdges(a)?.length || 0)) >
//         ((g.outEdges(b)?.length || 0) - (g.inEdges(b)?.length || 0)) ? a : b
//       );
//     case 'A3': // 自身或前驱最大 d+ - d-
//       return candidates.reduce((a, b) =>
//         getScore(a, g) > getScore(b, g) ? a : b
//       );
//     default:
//       return candidates[0]; // fallback
//   }

//   function getScore(v, g) {
//     const self = (g.outEdges(v)?.length || 0) - (g.inEdges(v)?.length || 0);
//     const preds = (g.predecessors(v) || []).map(p =>
//       (g.outEdges(p)?.length || 0) - (g.inEdges(p)?.length || 0)
//     );
//     return Math.max(self, ...preds);
//   }
// }

// function minWidth_not_consider_minlen(g, { UBW = 80, c = 1.5, strategy = 'A1' } = {}) {
//   const U = new Set();     // 已分层节点
//   const Z = new Set();     // 当前层以下的节点
//   let currentRank = 0;     // 从终点 0 向源头递减
//   let widthCurrent = 0;    // 当前层宽度估计
//   let widthUp = 0;         // 上层宽度估计
//   const dummyWidth = 1;    // 每条边的 dummy node 宽度估计
//   const nodeWidth = 1;     // 原始节点宽度

//   // 初始化所有节点的 rank
//   g.nodes().forEach(v => {
//     g.node(v).rank = null;
//   });

//   let layerNodes = [];

//   while (U.size < g.nodeCount()) {
//     // 宽松条件筛选候选：只要求后继已分层
//     const candidates = g.nodes().filter(v =>
//       !U.has(v) &&
//       (g.successors(v) || []).every(w => Z.has(w))
//     );

//     if (candidates.length === 0) {
//       // 当前层结束 → 统一设置层号
//       let targetRank = currentRank;
//       for (const v of layerNodes) {
//         for (const w of g.successors(v) || []) {
//           const minlen = g.edge(v, w)?.minlen || 1;
//           const requiredRank = g.node(w).rank - minlen;
//           if (requiredRank < targetRank) {
//             targetRank = requiredRank;
//           }
//         }
//       }

//       for (const v of layerNodes) {
//         g.node(v).rank = targetRank;
//         U.add(v);
//         Z.add(v);
//       }

//       // 下一层准备
//       currentRank = targetRank - 1;
//       layerNodes = [];
//       widthCurrent = widthUp;
//       widthUp = 0;
//       continue;
//     }

//     // 策略性选择一个节点
//     const v = selectNode(candidates, g, strategy);
//     layerNodes.push(v);

//     // 更新当前层宽度估计
//     const dOut = (g.outEdges(v) || []).length;
//     widthCurrent = widthCurrent - dummyWidth * dOut + nodeWidth;

//     // 更新上层宽度估计（该节点的 dIn 将产生 dummy）
//     const dIn = (g.inEdges(v) || []).length;
//     widthUp += dummyWidth * dIn;

//     // 判断是否换层
//     const shouldGoUp =
//       (widthCurrent >= UBW && dOut === 0) ||
//       (widthUp >= c * UBW);

//     if (shouldGoUp) {
//       // 当前层结束 → 统一调整 rank 后换层
//       let targetRank = currentRank;
//       for (const v of layerNodes) {
//         for (const w of g.successors(v) || []) {
//           const minlen = g.edge(v, w)?.minlen || 1;
//           const requiredRank = g.node(w).rank - minlen;
//           if (requiredRank < targetRank) {
//             targetRank = requiredRank;
//           }
//         }
//       }

//       for (const v of layerNodes) {
//         g.node(v).rank = targetRank;
//         U.add(v);
//         Z.add(v);
//       }

//       currentRank = targetRank - 1;
//       layerNodes = [];
//       widthCurrent = widthUp;
//       widthUp = 0;
//     }
//   }

//   // 输出 rank 结果
//   const nodeRanks = g.nodes().map(v => g.node(v).rank);
//   console.log("Final ranks:", nodeRanks);
// }


