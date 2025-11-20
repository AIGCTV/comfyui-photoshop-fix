import e, { isWorkflowLoaded } from "./event.js";
import { pinElementToNode } from "./utils.js";
import { app } from "../../../scripts/app.js";

const titleInfoMap = {};

const html = (strings, ...values) => strings.reduce((result, str, i) => result + str + (values[i] || ""), "");

const updateTitleInfo = (node, newTitle, msgType) => {
  if (!titleInfoMap[msgType]) titleInfoMap[msgType] = [];

  const titleInfoList = titleInfoMap[msgType];
  const existingTitleIndex = titleInfoList.findIndex((info) => info.ids.includes(node.id));

  if (existingTitleIndex !== -1) {
    const titleInfo = titleInfoList[existingTitleIndex];
    titleInfo.ids = titleInfo.ids.filter((id) => id !== node.id);

    if (!titleInfo.ids.length) titleInfoList.splice(existingTitleIndex, 1);
  }

  if (newTitle) {
    const existingTitle = titleInfoList.find((info) => info.title === newTitle);

    if (existingTitle && !existingTitle.ids.includes(node.id)) existingTitle.ids.push(node.id);
    else if (!existingTitle)
      titleInfoList.push({
        title: newTitle,
        ids: [node.id],
      });
  }
};

const createDropdownContent = (node, msgType) => {
  const titleInfoList = titleInfoMap[msgType] || [];
  const suggestedItems = suggestedItemsMap[msgType] || [];

  const suggestedTitles = new Set(suggestedItems.map((item) => item.title));

  return html`
      <div class="BluePixeldiv">
        <span class="BluePixelH1">ID Selector</span>
        <span class="BluePixelP">Nodes with the same name will sync</br>with each other and the plugin</span>
      </div>
      <div class="dropdown-menu" style="background: ${node.color || "#000"}">
        <div class="BluePixeldiv">
          <div class="dropdown-items">
            ${suggestedItems.map((info) => `<div class="dropdown-item suggested" data-title="${info.title}">${info.title}</div>`).join("")}
            ${titleInfoList
              .filter((info) => !suggestedTitles.has(info.title))
              .map((info) => `<div class="dropdown-item" data-title="${info.title}">${info.title}</div>`)
              .join("")}
          </div>
          <input class="blupixl-text-input textarea" placeholder="Type to add a new item" />
        </div>
      </div>
    `;
};

const handleTitleChange = (node, newTitle, pinnedElement, msgType) => {
  const originalTitle = node.title;
  node.title = newTitle;

  // آپدیت عنوان در dataset اگر آیتمی با عنوان اصلی وجود دارد
  const existingItem = document.querySelector(`[data-original-title="${originalTitle}"]`);
  if (existingItem) {
    existingItem.dataset.title = newTitle;
    existingItem.removeAttribute("data-original-title");
  }

  if (typeof node.onTitleChanged === "function") node.onTitleChanged(newTitle);
  updateTitleInfo(node, newTitle, msgType);
  pinnedElement?.remove();
};

const setupNameChanger = (node, msgType) => {
  node.onNodeTitleDblClick = function () {
    const pinnedElement = pinElementToNode(this, {
      position: "top",
      offsetY: LiteGraph.NODE_TITLE_HEIGHT - 4,
      matchNodeWidth: true,
      html: createDropdownContent(this, msgType),
    });

    if (!pinnedElement?.element) return;

    const element = pinnedElement.element;
    const input = element.querySelector(".blupixl-text-input");
    const dropdownItems = element.querySelector(".dropdown-items");
    let hoveringOnItems = false;
    let previewItem = null;

    // اضافه کردن هندلر برای input
    input?.addEventListener("input", (event) => {
      const value = event.target.value.trim();
      const currentTitle = node.title;

      const isLastNode = titleInfoMap[msgType]?.some((info) => info.title === currentTitle && info.ids.length === 1 && info.ids[0] === node.id);

      if (previewItem) {
        previewItem.remove();
        previewItem = null;
      }

      if (isLastNode) {
        const existingItem = element.querySelector(`.dropdown-item[data-title="${currentTitle}"]`);
        if (existingItem) {
          // فقط متن را آپدیت میکنیم و dataset.title را دست نمیزنیم
          existingItem.textContent = value;

          // ذخیره عنوان اصلی در attribute جدید
          existingItem.setAttribute("data-original-title", currentTitle);
        }
      } else if (value) {
        // ساخت آیتم پیش‌نمایش جدید فقط اگر آخرین نود نباشد
        previewItem = document.createElement("div");
        previewItem.className = "dropdown-item preview-item";
        previewItem.textContent = value;
        previewItem.dataset.title = value;
        dropdownItems.appendChild(previewItem);

        // اضافه کردن event listener برای آیتم پیش‌نمایش
        previewItem.addEventListener("mouseenter", () => (hoveringOnItems = true));
        previewItem.addEventListener("mouseleave", () => (hoveringOnItems = false));
        previewItem.addEventListener("click", () => handleTitleChange(node, value, pinnedElement, msgType));
      }
    });

    element.querySelectorAll(".dropdown-item").forEach((item) => {
      item.addEventListener("mouseenter", () => (hoveringOnItems = true));
      item.addEventListener("mouseleave", () => (hoveringOnItems = false));
      item.addEventListener("click", () => handleTitleChange(this, item.dataset.title, pinnedElement, msgType));
    });

    setTimeout(() => input?.focus(), 100);

    input?.addEventListener("keydown", (event) => event.key === "Enter" && input.blur());

    input?.addEventListener("blur", () => {
      if (input.value) handleTitleChange(this, input.value, pinnedElement, msgType);
      if (!hoveringOnItems) pinnedElement.remove();
    });
  };
};

const setup = (node, msgType) => {
  const originalOnRemoved = node.onRemoved;
  node.onRemoved = function () {
    if (typeof originalOnRemoved === "function") originalOnRemoved.call(node);
    updateTitleInfo(node, null, msgType);
  };

  updateTitleInfo(node, node.title, msgType);
  setupNameChanger(node, msgType);
};

const suggestedItemsMap = {};

export const manageNameList = (node, msgType, suggestedItems = []) => {
  const n = node.prototype;

  if (!suggestedItemsMap[msgType]) {
    suggestedItemsMap[msgType] = suggestedItems.map((title) => ({ title, ids: [], active: false }));
  }

  const originalOnAdded = n.onAdded;
  n.onAdded = function () {
    if (typeof originalOnAdded === "function") originalOnAdded.call(this);
    hovertext(this, "Double Click on TITLE to chnage the ID");
    if (isWorkflowLoaded) {
      setup(this, msgType);
      updateTitleInfo(this, this.title, msgType);
    }
  };

  e.on("workflowLoaded", () => app.graph._nodes.filter((n) => n.type === node.type).forEach((n) => setup(n, msgType)));
  return titleInfoMap[msgType];
};

export const getTitleInfoMap = async (msgType) => {
  if (msgType) return titleInfoMap[msgType] || [];
  return titleInfoMap;
};

function hovertext(node, text) {
  let isHovered = false;

  node.onMouseEnter = () => {
    isHovered = true;
    node.setDirtyCanvas(true);
  };

  node.onMouseLeave = () => {
    isHovered = false;
    node.setDirtyCanvas(true);
  };

  const orgonDrawBackground = node.onDrawBackground;
  node.onDrawBackground = function (ctx) {
    if (typeof orgonDrawBackground === "function") orgonDrawBackground.call(this, ctx);

    if (isHovered) {
      ctx.fillStyle = "#ffffff33";
      ctx.font = "9px Arial";
      ctx.fillText(text, 6, -LiteGraph.NODE_TITLE_HEIGHT - 6);
    }
  };
}
