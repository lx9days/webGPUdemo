# WebGPU Demo 全局样式与边形态开关

本项目的渲染样式集中定义在 `src/gpuRenderer.js` 的全局 `STYLE` 对象中（`src/gpuRenderer.js:6–50`）。下文列出常用可全局控制项，以及“直线/曲线”统一开关的使用方法。

## 边形态（直线/曲线）
- 开关：`STYLE.edgeGlobalStraight`（布尔）
- 位置：`src/gpuRenderer.js:24`
- 效果：
  - `true`：所有非自环边初始化与拖拽时都按直线线性采样；箭头沿最后一段直线方向。
  - `false`：所有非自环边都按四次中心对称曲线采样；箭头沿曲线在终点的切线方向。
  - 自环边逻辑保持不变。
- 实际使用：在 `src/gpuRenderer.js` 顶部修改 `STYLE.edgeGlobalStraight` 即可。
  - 初始化采样判定：`src/gpuRenderer.js:1669`
  - 拖拽边段重采样判定：`src/gpuRenderer.js:2056`（主视图）、`src/gpuRenderer.js:2152`（小地图）
  - 拖拽箭头重算判定：`src/gpuRenderer.js:1936`
- 变更生效说明：
  - 初始化后的折线坐标不会自动重算；切换开关后对边进行拖拽可触发重采样。若需全量应用新形态，调用一次初始化或编写刷新逻辑重建折线数据。

## 连线样式
- `STYLE.edgeColor`：主视图边的颜色与透明度（`src/gpuRenderer.js:19`）
- `STYLE.edgeColor_mini`：小地图边颜色与透明度（`src/gpuRenderer.js:20`）
- `STYLE.edgeCurveOffsetRatioX`：曲线 X 方向曲率（相对长度的偏移比例，`src/gpuRenderer.js:21`）。越大越弯。
- `STYLE.edgeCurveOffsetRatioY`：曲线 Y 方向曲率（相对长度的偏移比例，`src/gpuRenderer.js:22`）。
- `STYLE.edgeCurveSegments`：边采样段数（`src/gpuRenderer.js:23`）。越大越平滑但数据量增加。

## 箭头样式
- `STYLE.arrowColor`：箭头颜色（`src/gpuRenderer.js:26`）
- `STYLE.arrowSize`：箭头长度（世界坐标单位，`src/gpuRenderer.js:27`）。

## 节点与文字
- `STYLE.nodeColor`：主视图节点矩形颜色（`src/gpuRenderer.js:15`）
- `STYLE.nodeColor_mini`：小地图节点矩形颜色（`src/gpuRenderer.js:16`）
- `STYLE.charColor`：字符颜色（`src/gpuRenderer.js:12`）
- `STYLE.charSize`：字符基础宽度（世界坐标，`src/gpuRenderer.js:7`）
- `STYLE.charWidthRatio`：字符横向放大比例（`src/gpuRenderer.js:8`）
- `STYLE.charHeightRatio`：字符高宽比（`src/gpuRenderer.js:9`）
- `STYLE.charSpacingRatio`：字符间距比例（相对 `charSize`，`src/gpuRenderer.js:10`）
- `STYLE.charShiftY`：字符相对节点中心的纵向偏移（`src/gpuRenderer.js:28`）

## 交互反馈（Hover/Selected）
- `STYLE.rectHoverColor`：矩形 hover 颜色（`src/gpuRenderer.js:39`）
- `STYLE.charHoverColor`：文字 hover 颜色（`src/gpuRenderer.js:40`）
- `STYLE.charSelectedColor`：文字 selected 颜色（`src/gpuRenderer.js:41`）
- `STYLE.charNearestSwitchThreshold`：字符最近像素切换阈值（`src/gpuRenderer.js:42`）
- `STYLE.charCoverageGamma`：文字覆盖度伽马（`src/gpuRenderer.js:43`）
- `STYLE.imageHoverTint`：图片 hover 着色（`src/gpuRenderer.js:44`）
- `STYLE.imageSelectedTint`：图片 selected 着色（`src/gpuRenderer.js:45`）
- `STYLE.ringColor`：环基础颜色（`src/gpuRenderer.js:29`）
- `STYLE.ringInnerColor`：环内侧颜色（`src/gpuRenderer.js:30`）
- `STYLE.ringHighlightColor`：环高亮颜色（`src/gpuRenderer.js:31`）
- `STYLE.ringHoverColor`：环 hover 颜色（`src/gpuRenderer.js:46`）
- `STYLE.ringSelectedColor`：环 selected 颜色（`src/gpuRenderer.js:47`）
- `STYLE.ringHoverGlowWidth`：环 hover 光晕宽度（`src/gpuRenderer.js:48`）
- `STYLE.ringSelectedGlowWidth`：环 selected 光晕宽度（`src/gpuRenderer.js:49`）

## 视图与小地图
- `STYLE.clearColor`：背景清屏颜色（`src/gpuRenderer.js:11`）
- `STYLE.viewRectColor`：视口矩形颜色（`src/gpuRenderer.js:33`）
- `STYLE.minimapMargin`：小地图边距（NDC 范围填充比例，`src/gpuRenderer.js:36`）。

## 使用建议
- 修改 `STYLE` 任意项不需要重启；影响初始化采样的参数（如 `edgeGlobalStraight`、`edgeCurveSegments`、曲率比例）在拖拽时会应用到更新的边；若需对全部现有边立即生效，可触发一次重建折线数据或重新初始化。
- 大数据量场景建议适当降低 `edgeCurveSegments` 以控制折线数据规模。

## 代码参考索引
- 样式对象：`src/gpuRenderer.js:6–50`
- 初始化抽取与采样：`src/gpuRenderer.js:1567–1769`
- 拖拽边段重采样（主视图）：`src/gpuRenderer.js:1981–2102`
- 拖拽边段重采样（小地图）：`src/gpuRenderer.js:2104–2196`
- 拖拽箭头更新：`src/gpuRenderer.js:1869–1979`
