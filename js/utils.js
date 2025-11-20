export let disabledrow = false;
import { api } from "../../../scripts/api.js";
import { app } from "../../../scripts/app.js";
import { sendMsg } from "./connection.js";
import { isPsConnected, isWorkflowLoaded } from "./event.js";

export function handleError(message, error) {
  console.error(`🔹 ${message}:`, error);
}

export async function fetchImage(path) {
  try {
    const response = await api.fetchApi(path);
    
    // Check if the response was successful
    if (!response.ok && response.status !== 200) {
      throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
    }
    
    const url = response.url;

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.src = url;
      img.onload = () => resolve(img);
      img.onerror = () => {
        console.warn(`Failed to load image: ${url}`);
        reject(`Failed to load image: ${url}`);
      };
    });
  } catch (error) {
    console.warn(`Failed to fetch image path: ${path}. ${error.message || error}`);
    throw error;
  }
}

export function createWatchedObject(obj, onChange) {
  return new Proxy(obj, {
    set(target, property, value) {
      if (target[property] !== value) {
        target[property] = value;
        onChange(property, value);
      }
      return true;
    },
  });
}

export function updateNodeProperty(node, propertyName, value) {
  if (node && node.properties) node.properties[propertyName] = value;
  else console.error("Node or properties not found");
}
export function AddHtmlWidget(node, widgetName, htmlContent) {
  const div = document.createElement("div");
  div.innerHTML = htmlContent;

  div.addEventListener("wheel", (e) => {
    let scale = app.canvas.ds.scale;
    if (e.deltaY < 0) scale *= 1.07;
    else scale *= 1 / 1.07;
    app.canvas.ds.changeScale(scale, [e.clientX, e.clientY]);
    app.graph.setDirtyCanvas(true, true);
  });

  const widget = node.addDOMWidget(widgetName, widgetName, div, {});

  return widget;
}

export function addButton(node, btntxt, class__name, func) {
  try {
    disabledrow = true;
    const originalSize = [...node.size];
    const button = node.addWidget("button", btntxt, null, func);
    button.className = class__name;

    const newHeight = node.size[1];
    if (newHeight > originalSize[1]) {
      node.size = [originalSize[0], newHeight];
    } else {
      node.size = originalSize;
    }

    node.setDirtyCanvas(true, true);
    node.onResize();
    disabledrow = false;
  } catch (error) {
    handleError("Error in addButton", error);
  }
}

export function removeButtons(node, className) {
  try {
    node.widgets = node.widgets.filter((widget) => widget.className !== className);
    node.setDirtyCanvas(true, true);
  } catch (error) {
    handleError("Error in removeButtons", error);
  }
}
export function addMultilineWidget(node, name, opts, callback) {
  const inputEl = document.createElement("textarea");
  inputEl.className = "blupixl-text-input";
  inputEl.value = opts.defaultVal;
  inputEl.placeholder = opts.placeholder || name;

  const widget = node.addDOMWidget(name, "textmultiline", inputEl, {
    getValue() {
      return inputEl.value;
    },
    setValue(v) {
      inputEl.value = v;
    },
  });
  widget.inputEl = inputEl;

  inputEl.addEventListener("input", () => {
    callback?.(widget.value);
    widget.callback?.(widget.value);
  });
  widget.onRemove = () => {
    inputEl.remove();
  };

  return { minWidth: 400, minHeight: 200, widget };
}

export let logoImageCache = null;

let iconsCache = {};
async function loadIcons() {
  iconsCache["Strings"] = await fetchImage(`/ps/icons/message.svg`);
  iconsCache["Seed"] = await fetchImage(`/ps/icons/seed.svg`);
  iconsCache["Images"] = await fetchImage(`/ps/icons/image.svg`);
  iconsCache["Floats"] = await fetchImage(`/ps/icons/slider.svg`);
  iconsCache["rgthree"] = await fetchImage(`/ps/icons/folder.svg`);
  iconsCache["default"] = await fetchImage(`/ps/icons/logo.svg`);
}

await loadIcons();
export const brandStyle = async (n) => {
  const originalOnAdded = n.onAdded;
  n.onAdded = async function (...args) {
    if (this.title.startsWith("🔹")) this.title = this.title.replace(/^🔹/, "");

    if (this.title === "PS Seed") this.title = "SEED";
    else if (this.title === "PS Strings") this.title = "+ PROMPT";
    else if (this.title === "Reroute - Anything Everywhere") this.title = "route";
    else if (this.title === "PS Images") this.title = "MAIN DOC";



    this.shape = LiteGraph.ROUND_SHAPE;

    this.color = "#000000";
    this.bgcolor = "#1A1E24";

    let icon = null;
    if (n.comfyClass === "🔹Reroute - Anything Everywhere") icon = null;
    else if (n.comfyClass === "🔹Photoshop Strings") icon = iconsCache["Strings"];
    else if (n.comfyClass === "🔹Photoshop Images") icon = iconsCache["Images"];
    else if (n.comfyClass === "🔹Floats") icon = iconsCache["Floats"];
    else if (n.comfyClass === "🔹SeedManager") icon = iconsCache["Seed"];
    else if (n.comfyClass.endsWith("(rgthree)")) icon = iconsCache["rgthree"];
    else icon = iconsCache["default"];

    const onDrawForeground = n.onDrawBackground;
    n.onDrawForeground = async function (ctx, graphcanvas) {
      if (app.canvas.ds.scale > 0.5) {
        if (icon) ctx.drawImage(icon, 5, -25, 20, 20);
        if (this.flags?.collapsed) return;
        if (!this.bgcolor || this.bgcolor === "#353535") setTimeout(() => (this.bgcolor = "#1A1E24"), 10);

        const borderRadius = 14;
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 3;

        if (this.constructor.title_mode !== LiteGraph.TRANSPARENT_TITLE) {
          ctx.fillStyle = ctx.strokeStyle;
          ctx.fillRect(0, 0, 4, 4.5);
          ctx.fillRect(this.size[0] - 4, 0, 4, 4.5);
        }

        ctx.beginPath();
        ctx.roundRect(-1.5, -0.5, this.size[0] + 3, this.size[1] + 3 - 1, borderRadius);
        ctx.stroke();

        if (this.mode && this.mode !== 0) return;
        ctx.lineWidth = 1;

        ctx.strokeStyle = "#FFFFFF10";
        ctx.beginPath();
        ctx.roundRect(0.5, 1.5, this.size[0] - 1, this.size[1] - 2, borderRadius - 2);
        ctx.stroke();
        onDrawForeground?.call(this, ctx, graphcanvas);
      }
    };

    originalOnAdded?.call(this, args);
  };
};

export function pinElementToNode(node, options = {}) {
  const {
    html = "",
    offsetX = 0,
    offsetY = 0,
    position = "overlay",
    matchNodeWidth = false,
    matchNodeHeight = false,
    id = "pinned-element-" + Math.random().toString(36).substr(2, 9),
    style = {},
  } = options;
  const targetElement = document.querySelector(".graph-canvas-container");
  if (!targetElement) return;

  let pinnedElement;

  const updateElement = () => {
    const [x, y] = node.pos;
    const [w, h] = node.size;
    const [left, top] = app.canvasPosToClientPos([x, y]);
    const scale = app.canvas.ds.scale;
    const titleHeight = LiteGraph.NODE_TITLE_HEIGHT;
    const offY = offsetY * scale;
    const offX = offsetX * scale;

    const rect = targetElement.getBoundingClientRect();
    const nodeRealWidth = w;
    const nodeRealHeight = h + titleHeight;

    if (!pinnedElement) {
      pinnedElement = document.createElement("div");
      pinnedElement.id = id;
      pinnedElement.style.position = "absolute";
      pinnedElement.innerHTML = html;
      targetElement.appendChild(pinnedElement);
    }

    let finalTop = top - titleHeight * scale - rect.top + offY;
    let finalLeft = left - rect.left + offX;

    switch (position) {
      case "top":
        finalTop = top - titleHeight * scale - rect.top - pinnedElement.offsetHeight * scale + offY;
        break;
      case "bottom":
        finalTop = top - rect.top + nodeRealHeight * scale + offY;
        break;
      case "left":
        finalLeft = left - rect.left - pinnedElement.offsetWidth * scale + offX;
        break;
      case "right":
        finalLeft = left - rect.left + nodeRealWidth * scale + offX;
        break;
    }

    pinnedElement.style.top = `${finalTop}px`;
    pinnedElement.style.left = `${finalLeft}px`;
    if (matchNodeWidth) pinnedElement.style.width = `${nodeRealWidth}px`;
    if (matchNodeHeight) pinnedElement.style.height = `${nodeRealHeight}px`;
    pinnedElement.style.pointerEvents = `none`;

    Object.assign(pinnedElement.style, style, {
      transform: `scale(${scale})`,
      transformOrigin: "top left",
      zIndex: "1000",
    });
  };

  const observer = new MutationObserver(updateElement);
  observer.observe(targetElement, {
    attributes: true,
    childList: true,
    subtree: true,
  });

  updateElement();

  return {
    element: pinnedElement,
    remove: () => {
      const element = document.getElementById(id);
      if (element) element.remove();
      observer.disconnect();
    },
    update: (newOptions) => {
      Object.assign(options, newOptions);
      updateElement();
    },
  };
}
const fetchWithFallback = async (url, fallbackUrl) => {
  try {
    return await fetchImage(url);
  } catch (error) {
    console.warn(`Failed to load image from ${url}, trying fallback`);
    try {
      return await fetchImage(fallbackUrl);
    } catch (fallbackError) {
      console.warn(`Fallback image also failed: ${fallbackUrl}`);
      // Create a minimal placeholder image when both main and fallback fail
      const placeholder = new Image();
      placeholder.width = 100;
      placeholder.height = 100;
      return placeholder;
    }
  }
};
export const bgImg = async (node, canvasUrl, maskUrl) => {
  if (node.flags.collapsed || node.mode !== 0 || node.properties?.["Disable Preview"]) return;

  try {
    if (!canvasUrl) {
      console.warn("No valid canvas image URL provided");
      node.onDrawBackground = null;
      node.setDirtyCanvas(true, true);
      return;
    }
    
    const canvasImg = await fetchWithFallback(canvasUrl, "/ps/error.png");
    const maskImg = maskUrl ? await fetchWithFallback(maskUrl, "/ps/error.png") : null;

    const drawImage = () => {
      const { size } = node;
      const aspectRatio = canvasImg.width / canvasImg.height;
      const nodeAspectRatio = size[0] / size[1];

      let drawWidth, drawHeight, drawX, drawY;
      if (aspectRatio > nodeAspectRatio) {
        drawWidth = size[0];
        drawHeight = drawWidth / aspectRatio;
        drawX = 0;
        drawY = size[1] - drawHeight;
      } else {
        drawHeight = size[1];
        drawWidth = drawHeight * aspectRatio;
        drawX = (size[0] - drawWidth) / 2;
        drawY = 0;
      }

      node.onDrawBackground = (ctx) => {
        if (node.flags.collapsed || node.mode === 2 || node.properties?.["Disable Preview"]) return;

        ctx.save();
        const radius = 12;
        ctx.beginPath();
        ctx.moveTo(drawX + radius, drawY);
        ctx.arcTo(drawX + drawWidth, drawY, drawX + drawWidth, drawY + drawHeight, radius);
        ctx.arcTo(drawX + drawWidth, drawY + drawHeight, drawX, drawY + drawHeight, radius);
        ctx.arcTo(drawX, drawY + drawHeight, drawX, drawY, radius);
        ctx.arcTo(drawX, drawY, drawX + drawWidth, drawY, radius);
        ctx.closePath();
        ctx.clip();

        ctx.drawImage(canvasImg, drawX, drawY, drawWidth, drawHeight);

        if (maskImg) {
          ctx.filter = "opacity(0.7)";
          ctx.globalCompositeOperation = "darken";
          ctx.drawImage(maskImg, drawX, drawY, drawWidth, drawHeight);
          ctx.filter = "none";
          ctx.globalCompositeOperation = "source-over";
        }

        ctx.restore();
      };
    };

    drawImage();
    node.onResize = drawImage;
  } catch (error) {
    console.warn("🔹 Error loading images:", error);
    node.onDrawBackground = null;
    node.setDirtyCanvas(true, true);
  }
};

export function addModeChangeHandler(node) {
  let _mode = node.mode;

  Object.defineProperty(node, "mode", {
    get: function () {
      return _mode;
    },
    set: function (newMode) {
      if (newMode !== _mode) {
        const oldMode = _mode;
        _mode = newMode;
        if (typeof node.onModeChanged === "function") node.onModeChanged(newMode, oldMode);
      }
    },
    enumerable: true,
    configurable: true,
  });
}
let lastSentMessages = {};

export async function sendList(msgType, list, priority) {
  if (isWorkflowLoaded && isPsConnected) {
    if (!Array.isArray(priority)) priority = [priority];

    const orderedItems = priority
      .map((key) => {
        const index = list.findIndex((item) => item.title === key);
        return index !== -1 ? list.splice(index, 1)[0] : null;
      })
      .filter((item) => item !== null);

    const remainingItems = list.filter((item) => !priority.includes(item.title));

    list = [...orderedItems, ...remainingItems];
    list.forEach((item) => {
      if (item.ids && Array.isArray(item.ids)) item.active = item.ids.some((id) => app.graph.getNodeById(id).mode === LiteGraph.ALWAYS) ? 1 : 0;
    });

    const currentMessage = JSON.stringify(list);
    if (lastSentMessages[msgType] === currentMessage) return;
    lastSentMessages[msgType] = currentMessage;
    await sendMsg(msgType, list);
  }
}
