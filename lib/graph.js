(function () {
  /**
   * Możesz podmienić to drzewo na swoje właściwe dane.
   * Albo wcześniej na stronie ustawić window.Tree = {...}
   * i wtedy ten plik użyje tamtej definicji.
   *
   * Schemat:
   * {
   *   background: "#eee",
   *   content: "plain text with emoji support albo <div>HTML</div>",
   *   left: {...},
   *   right: {...}
   * }
   */
  const tree = window.Tree || {
    background: "#e8f4ff",
    content: `
      <div style="font-weight:600;">🧠 Leczenie łysienia androgenowego</div>
      <div style="margin-top:6px;">Klikaj w węzły i linki</div>
    `,
    left: {
      background: "#eef8e7",
      content: `
        <div style="font-weight:600;">⬅️ Blokowanie DHT</div>
        <div style="margin-top:6px;">
          <a href="/leczenie-lysienia-androgenowego/" target="_blank" rel="noopener">
            Przejdź do instrukcji
          </a>
        </div>
      `,
      left: {
        background: "#fff6de",
        content: `<div><b>Finasteryd</b><br>tabletki / wcierka</div>`
      },
      right: {
        background: "#fff1f1",
        content: `<div><b>Alfatradiol</b><br>łagodniejsza opcja</div>`
      }
    },
    right: {
      background: "#f3ecff",
      content: `
        <div style="font-weight:600;">➡️ Stymulacja wzrostu</div>
        <div style="margin-top:6px;">Minoxidil / zabiegi / mikronakłuwanie</div>
      `,
      left: {
        background: "#eef7ff",
        content: `<div><b>Minoxidil</b><br>stymulacja odrostu</div>`
      },
      right: {
        background: "#eefaf8",
        content: `<div><b>Przeszczep</b><br>uzupełnienie braków</div>`
      }
    }
  };

  const NODE_WIDTH = 260;
  const NODE_MIN_HEIGHT = 84;
  const HORIZONTAL_GAP = 42;
  const VERTICAL_GAP = 84;
  const PADDING_X = 48;
  const PADDING_Y = 48;
  const MOBILE_BREAKPOINT = 980;
  const MIN_SCALE = 0.42;
  const MAX_SCALE = 1.8;

  function isNode(value) {
    return value && typeof value === "object";
  }

  function injectStyles() {
    if (document.getElementById("graph-tree-styles")) return;

    const style = document.createElement("style");
    style.id = "graph-tree-styles";
    style.textContent = `
      #hair-loss-tree {
        width: 100%;
        min-height: 560px;
        position: relative;
        overflow: hidden;
        border-radius: 20px;
        background:
          radial-gradient(circle at top left, rgba(255,255,255,0.75), rgba(255,255,255,0) 40%),
          linear-gradient(180deg, rgba(255,255,255,0.58), rgba(255,255,255,0.18));
        box-shadow: 0 14px 40px rgba(25, 26, 26, 0.08);
        cursor: grab;
        touch-action: none;
      }

      #hair-loss-tree.is-dragging {
        cursor: grabbing;
      }

      #hair-loss-tree .graph-toolbar {
        position: absolute;
        top: 14px;
        right: 14px;
        z-index: 20;
        display: flex;
        gap: 8px;
      }

      #hair-loss-tree .graph-toolbar button {
        appearance: none;
        border: 0;
        background: rgba(255,255,255,0.94);
        color: #191a1a;
        width: 38px;
        height: 38px;
        border-radius: 12px;
        font-size: 18px;
        line-height: 1;
        cursor: pointer;
        box-shadow: 0 8px 20px rgba(25,26,26,0.12);
      }

      #hair-loss-tree .graph-toolbar button:hover {
        transform: translateY(-1px);
      }

      #hair-loss-tree .graph-stage {
        position: absolute;
        inset: 0;
        overflow: hidden;
      }

      #hair-loss-tree .graph-viewport {
        position: absolute;
        top: 0;
        left: 0;
        transform-origin: 0 0;
        will-change: transform;
      }

      #hair-loss-tree .graph-lines {
        position: absolute;
        top: 0;
        left: 0;
        overflow: visible;
        pointer-events: none;
      }

      #hair-loss-tree .tree-node {
        position: absolute;
        width: ${NODE_WIDTH}px;
        min-height: ${NODE_MIN_HEIGHT}px;
        border-radius: 18px;
        background: #fff;
        box-shadow:
          0 12px 28px rgba(25,26,26,0.10),
          inset 0 0 0 1px rgba(25,26,26,0.06);
        padding: 16px 18px;
        color: #191a1a;
        line-height: 1.35;
        transition: transform 0.15s ease, box-shadow 0.15s ease;
      }

      #hair-loss-tree .tree-node:hover {
        transform: translateY(-2px);
        box-shadow:
          0 14px 32px rgba(25,26,26,0.14),
          inset 0 0 0 1px rgba(25,26,26,0.08);
      }

      #hair-loss-tree .tree-node-content {
        position: relative;
        z-index: 2;
        word-break: break-word;
      }

      #hair-loss-tree .tree-node-content a {
        color: rgba(53, 142, 220, 1);
        text-decoration: none;
        font-weight: 500;
      }

      #hair-loss-tree .tree-node-content a:hover {
        text-decoration: underline;
      }

      #hair-loss-tree .node-dot {
        position: absolute;
        left: 50%;
        transform: translateX(-50%);
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: rgba(25,26,26,0.30);
      }

      #hair-loss-tree .node-dot.top {
        top: -5px;
      }

      #hair-loss-tree .node-dot.bottom {
        bottom: -5px;
      }

      #hair-loss-tree .graph-hint {
        position: absolute;
        left: 14px;
        bottom: 12px;
        z-index: 15;
        font-size: 12px;
        color: rgba(25,26,26,0.72);
        background: rgba(255,255,255,0.88);
        padding: 8px 10px;
        border-radius: 999px;
        box-shadow: 0 8px 20px rgba(25,26,26,0.10);
      }

      @media (max-width: ${MOBILE_BREAKPOINT}px) {
        #hair-loss-tree {
          min-height: 460px;
        }

        #hair-loss-tree .tree-node {
          width: 220px;
          padding: 14px 15px;
          border-radius: 16px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function annotateTree(node, depth, parent, side) {
    if (!isNode(node)) return null;

    const normalized = {
      background: node.background || "#fff",
      content: node.content || "",
      left: null,
      right: null,
      depth,
      parent,
      side,
      width: NODE_WIDTH,
      height: NODE_MIN_HEIGHT,
      subtreeWidth: NODE_WIDTH,
      x: 0,
      y: 0,
      el: null
    };

    normalized.left = annotateTree(node.left, depth + 1, normalized, "left");
    normalized.right = annotateTree(node.right, depth + 1, normalized, "right");

    return normalized;
  }

  function measureHeights(root, measureBox) {
    const nodes = [];

    function walk(node) {
      if (!node) return;
      nodes.push(node);

      measureBox.innerHTML = node.content;
      node.height = Math.max(NODE_MIN_HEIGHT, Math.ceil(measureBox.offsetHeight) + 32);

      walk(node.left);
      walk(node.right);
    }

    walk(root);
    return nodes;
  }

  function computeSubtreeWidths(node) {
    if (!node) return 0;

    const leftWidth = computeSubtreeWidths(node.left);
    const rightWidth = computeSubtreeWidths(node.right);

    if (!node.left && !node.right) {
      node.subtreeWidth = node.width;
      return node.subtreeWidth;
    }

    if (node.left && node.right) {
      node.subtreeWidth = Math.max(node.width, leftWidth + HORIZONTAL_GAP + rightWidth);
      return node.subtreeWidth;
    }

    node.subtreeWidth = Math.max(node.width, leftWidth || rightWidth);
    return node.subtreeWidth;
  }

  function assignPositions(node, left, top) {
    if (!node) return;

    node.x = left + (node.subtreeWidth - node.width) / 2;
    node.y = top;

    const childTop = top + node.height + VERTICAL_GAP;

    if (node.left && node.right) {
      assignPositions(node.left, left, childTop);
      assignPositions(node.right, left + node.left.subtreeWidth + HORIZONTAL_GAP, childTop);
      return;
    }

    if (node.left) {
      assignPositions(node.left, left + (node.subtreeWidth - node.left.subtreeWidth) / 2, childTop);
    }

    if (node.right) {
      assignPositions(node.right, left + (node.subtreeWidth - node.right.subtreeWidth) / 2, childTop);
    }
  }

  function collectBounds(node, bounds) {
    if (!node) return bounds;
    bounds.minX = Math.min(bounds.minX, node.x);
    bounds.minY = Math.min(bounds.minY, node.y);
    bounds.maxX = Math.max(bounds.maxX, node.x + node.width);
    bounds.maxY = Math.max(bounds.maxY, node.y + node.height);
    collectBounds(node.left, bounds);
    collectBounds(node.right, bounds);
    return bounds;
  }

  function renderNode(node, nodesLayer, linesLayer) {
    if (!node) return;

    const el = document.createElement("div");
    el.className = "tree-node";
    el.style.left = `${node.x}px`;
    el.style.top = `${node.y}px`;
    el.style.background = node.background;
    el.innerHTML = `
      <div class="node-dot top"></div>
      <div class="tree-node-content">${node.content}</div>
      <div class="node-dot bottom"></div>
    `;
    nodesLayer.appendChild(el);
    node.el = el;

    if (node.parent) {
      const x1 = node.parent.x + node.parent.width / 2;
      const y1 = node.parent.y + node.parent.height;
      const x2 = node.x + node.width / 2;
      const y2 = node.y;

      const midY = y1 + (y2 - y1) / 2;
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute(
        "d",
        `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`
      );
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", "rgba(25,26,26,0.26)");
      path.setAttribute("stroke-width", "2");
      path.setAttribute("stroke-linecap", "round");
      linesLayer.appendChild(path);
    }

    renderNode(node.left, nodesLayer, linesLayer);
    renderNode(node.right, nodesLayer, linesLayer);
  }

  function createControls(container, api) {
    const toolbar = document.createElement("div");
    toolbar.className = "graph-toolbar";
    toolbar.innerHTML = `
      <button type="button" aria-label="Przybliż" title="Przybliż">+</button>
      <button type="button" aria-label="Oddal" title="Oddal">−</button>
      <button type="button" aria-label="Resetuj widok" title="Resetuj widok">↺</button>
    `;

    const [zoomInBtn, zoomOutBtn, resetBtn] = toolbar.querySelectorAll("button");

    zoomInBtn.addEventListener("click", () => api.zoomBy(1.12));
    zoomOutBtn.addEventListener("click", () => api.zoomBy(1 / 1.12));
    resetBtn.addEventListener("click", () => api.fit());

    container.appendChild(toolbar);
  }

  function setupPanZoom(container, viewport, sceneWidth, sceneHeight) {
    const state = {
      scale: 1,
      x: 0,
      y: 0,
      dragging: false,
      startX: 0,
      startY: 0,
      originX: 0,
      originY: 0
    };

    function apply() {
      viewport.style.transform = `translate(${state.x}px, ${state.y}px) scale(${state.scale})`;
    }

    function clampScale(nextScale) {
      return Math.min(MAX_SCALE, Math.max(MIN_SCALE, nextScale));
    }

    function zoomAt(clientX, clientY, factor) {
      const rect = container.getBoundingClientRect();
      const px = clientX - rect.left;
      const py = clientY - rect.top;

      const prevScale = state.scale;
      const nextScale = clampScale(prevScale * factor);
      if (nextScale === prevScale) return;

      state.x = px - ((px - state.x) / prevScale) * nextScale;
      state.y = py - ((py - state.y) / prevScale) * nextScale;
      state.scale = nextScale;
      apply();
    }

    function fit() {
      const rect = container.getBoundingClientRect();
      const scaleX = rect.width / sceneWidth;
      const scaleY = rect.height / sceneHeight;
      state.scale = clampScale(Math.min(scaleX, scaleY, 1));
      state.x = (rect.width - sceneWidth * state.scale) / 2;
      state.y = (rect.height - sceneHeight * state.scale) / 2;
      apply();
    }

    container.addEventListener(
      "wheel",
      (event) => {
        event.preventDefault();
        const factor = event.deltaY < 0 ? 1.08 : 1 / 1.08;
        zoomAt(event.clientX, event.clientY, factor);
      },
      { passive: false }
    );

    container.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      if (event.target.closest(".graph-toolbar")) return;
      if (event.target.closest(".tree-node a, .tree-node button, .tree-node input, .tree-node textarea, .tree-node select")) {
        return;
      }

      state.dragging = true;
      state.startX = event.clientX;
      state.startY = event.clientY;
      state.originX = state.x;
      state.originY = state.y;
      container.classList.add("is-dragging");
      container.setPointerCapture(event.pointerId);
    });

    container.addEventListener("pointermove", (event) => {
      if (!state.dragging) return;
      state.x = state.originX + (event.clientX - state.startX);
      state.y = state.originY + (event.clientY - state.startY);
      apply();
    });

    function stopDragging(event) {
      if (!state.dragging) return;
      state.dragging = false;
      container.classList.remove("is-dragging");
      if (event) {
        try {
          container.releasePointerCapture(event.pointerId);
        } catch (e) {}
      }
    }

    container.addEventListener("pointerup", stopDragging);
    container.addEventListener("pointercancel", stopDragging);
    container.addEventListener("mouseleave", () => {
      container.classList.remove("is-dragging");
    });

    return {
      fit,
      zoomBy(factor) {
        const rect = container.getBoundingClientRect();
        zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, factor);
      }
    };
  }

  function renderTree(container, sourceTree) {
    injectStyles();
    container.innerHTML = "";

    const normalizedRoot = annotateTree(sourceTree, 0, null, null);
    if (!normalizedRoot) return;

    const stage = document.createElement("div");
    stage.className = "graph-stage";

    const viewport = document.createElement("div");
    viewport.className = "graph-viewport";

    const measureBox = document.createElement("div");
    measureBox.className = "tree-node";
    measureBox.style.visibility = "hidden";
    measureBox.style.left = "-99999px";
    measureBox.style.top = "0";
    measureBox.style.position = "absolute";
    measureBox.style.pointerEvents = "none";
    document.body.appendChild(measureBox);

    measureHeights(normalizedRoot, measureBox);
    measureBox.remove();

    computeSubtreeWidths(normalizedRoot);
    assignPositions(normalizedRoot, PADDING_X, PADDING_Y);

    const bounds = collectBounds(normalizedRoot, {
      minX: Infinity,
      minY: Infinity,
      maxX: 0,
      maxY: 0
    });

    const sceneWidth = Math.ceil(bounds.maxX + PADDING_X);
    const sceneHeight = Math.ceil(bounds.maxY + PADDING_Y);

    const linesLayer = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    linesLayer.setAttribute("class", "graph-lines");
    linesLayer.setAttribute("width", String(sceneWidth));
    linesLayer.setAttribute("height", String(sceneHeight));
    linesLayer.setAttribute("viewBox", `0 0 ${sceneWidth} ${sceneHeight}`);

    const nodesLayer = document.createElement("div");
    nodesLayer.style.position = "absolute";
    nodesLayer.style.left = "0";
    nodesLayer.style.top = "0";
    nodesLayer.style.width = `${sceneWidth}px`;
    nodesLayer.style.height = `${sceneHeight}px`;

    renderNode(normalizedRoot, nodesLayer, linesLayer);

    viewport.style.width = `${sceneWidth}px`;
    viewport.style.height = `${sceneHeight}px`;
    viewport.appendChild(linesLayer);
    viewport.appendChild(nodesLayer);
    stage.appendChild(viewport);
    container.appendChild(stage);

    const api = setupPanZoom(container, viewport, sceneWidth, sceneHeight);
    createControls(container, api);

    const hint = document.createElement("div");
    hint.className = "graph-hint";
    hint.textContent = "Kółko myszy = zoom, przeciągnij tło = przesuwanie";
    container.appendChild(hint);

    requestAnimationFrame(() => api.fit());
    window.addEventListener("resize", api.fit);
  }

  function init() {
    const container = document.getElementById("hair-loss-tree");
    if (!container) return;

    // Jeśli chcesz zachować stare zachowanie mobilne, odkomentuj:
    // if (window.innerWidth < MOBILE_BREAKPOINT) {
    //   container.remove();
    //   return;
    // }

    renderTree(container, tree);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.TreeGraph = {
    render: renderTree
  };
})();
