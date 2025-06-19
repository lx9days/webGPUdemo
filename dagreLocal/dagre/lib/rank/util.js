"use strict";

const { applyWithChunking } = require("../util");

module.exports = {
  longestPath: longestPath,
  longestPath_iterative: longestPath_iterative,
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



function longestPath_iterative(g, strategy = 'A1') {
  const inDegree = new Map();
  const rank = new Map();

  g.nodes().forEach(v => {
    inDegree.set(v, 0);
    rank.set(v, Number.POSITIVE_INFINITY);
  });

  g.edges().forEach(e => {
    inDegree.set(e.v, inDegree.get(e.v) + 1);
  });

  const queue = [];

  // 起始点为终点（无出边的点），其 rank 为 0
  g.nodes().forEach(v => {
    if (inDegree.get(v) === 0) {
      rank.set(v, 0);
      queue.push(v);
    }
  });

  while (queue.length > 0) {
    // === 选择下一个要处理的节点 ===
    const v = selectNode(queue, g, strategy);
    queue.splice(queue.indexOf(v), 1); // 从 queue 中移除

    const vRank = rank.get(v);

    // 处理所有“反向”边 u → v，更新 u 的 rank
    (g.inEdges(v) || []).forEach(e => {
      const u = e.v;
      const minlen = g.edge(e).minlen || 1;

      const proposed = vRank - minlen;
      if (rank.get(u) > proposed) {
        rank.set(u, proposed);
      }

      inDegree.set(u, inDegree.get(u) - 1);
      if (inDegree.get(u) === 0) {
        queue.push(u);
      }
    });
  }

  // 写回 rank
  rank.forEach((r, v) => {
    g.node(v).rank = r;
  });

  let nodeRanks = g.nodes().map(v => g.node(v).rank);
  console.log("Final ranks:", nodeRanks);
}

function selectNode(candidates, g, strategy = 'A1') {
  switch (strategy) {
    case 'A1': // 最大出度
      return candidates.reduce((a, b) =>
        (g.outEdges(a)?.length || 0) > (g.outEdges(b)?.length || 0) ? a : b
      );
    case 'A2': // 最大 d+(v) - d-(v)
      return candidates.reduce((a, b) =>
        ((g.outEdges(a)?.length || 0) - (g.inEdges(a)?.length || 0)) >
        ((g.outEdges(b)?.length || 0) - (g.inEdges(b)?.length || 0)) ? a : b
      );
    case 'A3': // 自身或前驱最大 d+ - d-
      return candidates.reduce((a, b) =>
        getScore(a, g) > getScore(b, g) ? a : b
      );
    default:
      return candidates[0]; // fallback
  }

  function getScore(v, g) {
    const self = (g.outEdges(v)?.length || 0) - (g.inEdges(v)?.length || 0);
    const preds = (g.predecessors(v) || []).map(p =>
      (g.outEdges(p)?.length || 0) - (g.inEdges(p)?.length || 0)
    );
    return Math.max(self, ...preds);
  }
}