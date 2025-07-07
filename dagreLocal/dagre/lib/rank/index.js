"use strict";

var rankUtil = require("./util");
var longestPath = rankUtil.longestPath;
var minWidth = rankUtil.minWidth_algo;
var stretchWidth_step = rankUtil.stretchWidth_algo;
var feasibleTree = require("./feasible-tree");
var networkSimplex = require("./network-simplex");

module.exports = rank;

/*
 * Assigns a rank to each node in the input graph that respects the "minlen"
 * constraint specified on edges between nodes.
 *
 * This basic structure is derived from Gansner, et al., "A Technique for
 * Drawing Directed Graphs."
 *
 * Pre-conditions:
 *
 *    1. Graph must be a connected DAG
 *    2. Graph nodes must be objects
 *    3. Graph edges must have "weight" and "minlen" attributes
 *
 * Post-conditions:
 *
 *    1. Graph nodes will have a "rank" attribute based on the results of the
 *       algorithm. Ranks can start at any index (including negative), we'll
 *       fix them up later.
 */
function rank(g) {
  switch (g.graph().ranker) {
    case "network-simplex": networkSimplexRanker(g); return true;
    case "tight-tree": tightTreeRanker(g); return true;
    case "longest-path": longestPathRanker(g); return true;
    case "min-width": return minWidth(g, { UBW : 9, c : 2, strategy : 'A1' })
    case "stretch-width": stretchWidth(g); break;
    default:
      // networkSimplexRanker(g);
      return true
    // minWidth(g, { UBW : 9, c : 2, strategy : 'A1' })
  }
}

// A fast and simple ranker, but results are far from optimal.
var longestPathRanker = longestPath;
var minWidth = minWidth;

function tightTreeRanker(g) {
  longestPath(g);
  feasibleTree(g);
}

function networkSimplexRanker(g) {
  networkSimplex(g);
}

function stretchWidth(g) {
  let success = false
  let maxOut = 0;
  let maxIn = 0;
  let maxOutNode
  let maxInNode

  g.nodes().forEach(v => {
    const dOut = (g.outEdges(v) || []).length;  // 出度 d⁺(v)
    const dIn = (g.inEdges(v) || []).length;   // 入度 d⁻(v)
    console.log(dIn);
    if(dIn == 0) return

    if (dOut > maxOut) {maxOut = dOut; maxOutNode = v}
    if (dIn > maxIn) {maxIn = dIn; maxInNode = v}
  });

  console.log('max d⁺ =', maxOut,' for node ',maxOutNode, 'max d⁻ =', maxIn, ' for node ', maxInNode);

  // StretchWidth 初始化上限时常用：
  let initialMaxWidth = Math.max(maxOut, maxIn);
  while (!success) {
    console.log("UBW", initialMaxWidth);
    success = stretchWidth_step(g, { UBW: initialMaxWidth })
    initialMaxWidth*=1.1

  }
  return success
}