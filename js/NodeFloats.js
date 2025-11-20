import { AddHtmlWidget, sendList } from "./utils.js";
import { msg } from "./connection.js";
import { manageNameList } from "./TitleManager.js";
import e from "./event.js";

const NodeID = "🔹Floats";
const msgType = "FloatSlots";

// Node tracking with WeakMap and Map
const nodesByTitle = new Map();
const nodeTitleMap = new WeakMap();

const getCurrentNodesWithTitle = (title) => nodesByTitle.get(title) || [];

function updateNodeTitle(node, newTitle) {
  const currentTitle = nodeTitleMap.get(node);

  if (currentTitle) {
    const currentNodes = nodesByTitle.get(currentTitle);
    if (currentNodes) {
      const index = currentNodes.indexOf(node);
      if (index > -1) currentNodes.splice(index, 1);
      if (currentNodes.length === 0) nodesByTitle.delete(currentTitle);
    }
  }

  if (!nodesByTitle.has(newTitle)) nodesByTitle.set(newTitle, []);
  nodesByTitle.get(newTitle).push(node);
  nodeTitleMap.set(node, newTitle);
}

const generateId = () => `_${Math.random().toString(36).substr(2, 9)}`;

const initializeWidgetOptions = (node) => {
  node.widgets[0].options ??= {};
  node.properties.slidermin ??= 0;
  node.properties.slidermax ??= 1;
  node.properties.sliderstep ??= 0.01;
};

const getHtmlContent = (ids, node) => {
  initializeWidgetOptions(node);
  return `
    <div style="display: flex; flex-direction: column; overflow: hidden; height: 44px;">
      <div style="display: flex;">
        <input type="range" id="${ids.slider}" class="blupixl-slider-input" min="0" max="1" step="0.01" style="flex: 1;height: 26px;"/>
        <input type="number" id="${ids.value}" class="blupixl-text-input-ghost" style="width: 32px; margin-right:6px;" step="0.01"/>
      </div>
      <div style=" margin: 0 1px; gap:8px; display: flex; justify-content: space-between; align-items: center;">
        <input type="number" id="${ids.min}" class="blupixl-align-center blupixl-text-input" placeholder="min" style="flex: 1;" step="0.01"/>
        <span class="BluePixelP" >TO</span>
        <input type="number" id="${ids.max}" class="blupixl-align-center blupixl-text-input" placeholder="max" style="flex: 1;" step="0.01"/>
      </div>
      <div style=" margin: 4px 1px; gap:8px; display: flex; justify-content: space-between; align-items: center;">
        <label for="${ids.step}" class="blupixl-align-center BluePixelP">Steps</label>
        <input type="number" id="${ids.step}" class="blupixl-align-center blupixl-text-input" placeholder="step" style="flex: 1;" step="0.01"/>
      </div>
    </div>
  `;
};

function syncNodesWithSameTitle(
  sourceNode,
  value,
  minValue,
  maxValue,
  stepValue
) {
  const currentTitle = nodeTitleMap.get(sourceNode);
  if (!currentTitle) return;

  const nodesWithSameTitle = getCurrentNodesWithTitle(currentTitle);

  nodesWithSameTitle.forEach((node) => {
    if (node !== sourceNode) {
      node.widgets[0].value = value;

      const slider = document.getElementById(node.sliderId);
      const valueInput = document.getElementById(node.valueId);
      const minInput = document.getElementById(node.minId);
      const maxInput = document.getElementById(node.maxId);
      const stepInput = document.getElementById(node.stepId);

      if (slider && valueInput) {
        slider.value = value;
        valueInput.value = value;

        // Get current min/max values
        const min =
          minValue !== undefined ? minValue : node.properties.slidermin;
        const max =
          maxValue !== undefined ? maxValue : node.properties.slidermax;

        // Update min/max if provided
        if (minValue !== undefined && maxValue !== undefined) {
          node.properties.slidermin = minValue;
          node.properties.slidermax = maxValue;
          node.properties.sliderstep = stepValue;

          if (minInput && maxInput) {
            slider.min = minValue;
            slider.max = maxValue;
            slider.step = stepValue;
            minInput.value = minValue;
            maxInput.value = maxValue;
            stepInput.value = stepValue;
          }
        }

        // Always update gradient for all synced nodes
        const percentage = ((value - min) / (max - min)) * 100;
        slider.style.setProperty(
          "--bluePixel-track-bg",
          `linear-gradient(to right, var(--bluePixel-color-primary) 0%, var(--bluePixel-color-primary) ${percentage}%, var(--bluePixel-color-secondary) ${percentage}%, var(--bluePixel-color-secondary) 100%)`
        );
      }
    }
  });
}

const syncGrad = (slider, percentage) =>
  slider.style.setProperty(
    "--bluePixel-track-bg",
    `linear-gradient(to right, var(--bluePixel-color-primary) 0%, var(--bluePixel-color-primary) ${percentage}%, var(--bluePixel-color-secondary) ${percentage}%, var(--bluePixel-color-secondary) 100%)`
  );

async function getEnhancedTitleInfoMap() {
  const titleInfo = [];
  let mainExists = false;

  for (const [title, nodes] of nodesByTitle.entries()) {
    if (nodes.length > 0) {
      const ids = nodes.map((node) => node.id);
      const value = nodes[0].widgets[0].value;
      const min = nodes[0].properties.slidermin;
      const max = nodes[0].properties.slidermax;
      const step = nodes[0].properties.sliderstep;

      titleInfo.push({ title, ids, value, min, max, step });
      if (title === "MAIN") {
        mainExists = true;
      }
    }
  }

  // Ensure "MAIN" entry exists
  if (!mainExists) {
    titleInfo.push({
      title: "MAIN",
      ids: [],
      value: 0.5, // Default value
      min: 0, // Default min
      max: 1, // Default max
      step: 0.01, // Default step
    });
  }

  return titleInfo;
}

function handleTitleChange(node, newTitle, oldTitle) {
  updateNodeTitle(node, newTitle);

  const existingNodes = getCurrentNodesWithTitle(newTitle);
  if (existingNodes.length > 1) {
    const sourceNode = existingNodes[0];
    const value = sourceNode.widgets[0].value;
    const min = sourceNode.properties.slidermin;
    const max = sourceNode.properties.slidermax;
    const step = sourceNode.properties.sliderstep;

    node.widgets[0].value = value;
    node.properties.slidermin = min;
    node.properties.slidermax = max;
    node.properties.sliderstep = step;

    const slider = document.getElementById(node.sliderId);
    const valueInput = document.getElementById(node.valueId);
    const minInput = document.getElementById(node.minId);
    const maxInput = document.getElementById(node.maxId);
    const stepInput = document.getElementById(node.stepId);

    if (slider && valueInput && minInput && maxInput) {
      valueInput.value = value;
      minInput.value = min;
      maxInput.value = max;
      stepInput.value = step;

      slider.min = min;
      slider.max = max;
      slider.step = step;
      slider.value = value;

      const percentage = ((value - min) / (max - min)) * 100;
      syncGrad(slider, percentage);
    }
  }
}
async function removeNode(node) {
  const currentTitle = nodeTitleMap.get(node);
  if (currentTitle) {
    const nodes = nodesByTitle.get(currentTitle);
    if (nodes) {
      const index = nodes.indexOf(node);
      if (index > -1) {
        nodes.splice(index, 1);
        if (nodes.length === 0) {
          nodesByTitle.delete(currentTitle);
        }
      }
    }
  }
  nodeTitleMap.delete(node);
}

function setupEventListeners(node, ids) {
  const elements = {
    slider: document.getElementById(ids.slider),
    value: document.getElementById(ids.value),
    min: document.getElementById(ids.min),
    max: document.getElementById(ids.max),
    step: document.getElementById(ids.step),
  };

  // Check if all elements exist
  if (
    !elements.slider ||
    !elements.value ||
    !elements.min ||
    !elements.max ||
    !elements.step
  ) {
    // Try again after a delay if any element is missing
    setTimeout(() => setupEventListeners(node, ids), 100);
    return;
  }

  const el = elements; // Rename for clarity with existing code

  // Store IDs in node for later access
  node.sliderId = ids.slider;
  node.valueId = ids.value;
  node.minId = ids.min;
  node.maxId = ids.max;
  node.stepId = ids.step;

  const preventScrollChange = (event) => event.preventDefault();
  el.value.addEventListener("wheel", preventScrollChange);
  el.min.addEventListener("wheel", preventScrollChange);
  el.max.addEventListener("wheel", preventScrollChange);
  el.step.addEventListener("wheel", preventScrollChange);

  const updateSliderRange = () => {
    const minValue = parseFloat(el.min.value);
    const maxValue = parseFloat(el.max.value);
    const stepValue = parseFloat(el.step.value);

    if (isNaN(stepValue) || stepValue === 0)
      el.step.value = node.properties.sliderstep = el.slider.step = 0.01;
    if (
      !isNaN(minValue) &&
      !isNaN(maxValue) &&
      minValue < maxValue &&
      !isNaN(stepValue)
    ) {
      node.properties.slidermin = minValue;
      node.properties.slidermax = maxValue;
      node.properties.sliderstep = stepValue;

      el.slider.min = minValue;
      el.slider.max = maxValue;
      el.slider.step = stepValue;

      const currentValue = parseFloat(el.value.value);
      if (currentValue < minValue) updateValue(minValue);
      else if (currentValue > maxValue) updateValue(maxValue);
      else {
        const percentage =
          ((currentValue - minValue) / (maxValue - minValue)) * 100;
        syncGrad(el.slider, percentage);
      }

      syncNodesWithSameTitle(node, currentValue, minValue, maxValue, stepValue);
    }
  };

  const updateValue = (value) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue)) {
      const min = parseFloat(el.slider.min);
      const max = parseFloat(el.slider.max);
      const step = parseFloat(el.slider.step);

      const stepsFromMin = Math.round((numValue - min) / step);
      const clampedValue = Math.min(
        Math.max(min + stepsFromMin * step, min),
        max
      );

      el.slider.value = clampedValue;
      el.value.value = clampedValue.toFixed(2);
      node.widgets[0].value = clampedValue;

      const percentage = ((clampedValue - min) / (max - min)) * 100;
      syncGrad(el.slider, percentage);

      syncNodesWithSameTitle(node, clampedValue);
    }
  };

  el.slider.addEventListener("input", (e) => updateValue(e.target.value));
  el.value.addEventListener("blur", (e) => updateValue(e.target.value));
  el.min.addEventListener("input", updateSliderRange);
  el.max.addEventListener("input", updateSliderRange);
  el.step.addEventListener("input", updateSliderRange);

  el.step.addEventListener("change", () => send());
  el.slider.addEventListener("change", () => send());
  el.value.addEventListener("change", () => send());

  setTimeout(() => {
    el.min.value = node.properties.slidermin;
    el.max.value = node.properties.slidermax;
    el.step.value = node.properties.sliderstep;
    updateSliderRange();
    updateValue(node.widgets[0].value);
  }, 500);
}

async function styleIt(node) {
  if (node.title === "PS Slider Float") node.title = "MAIN";

  if (node.widgets[1]) return;
  node.widgets[0].computeSize = () => [
    0,
    -LiteGraph.NODE_SLOT_HEIGHT - LiteGraph.NODE_WIDGET_HEIGHT,
  ];
  node.widgets[0].type = "hidden";

  const ids = {
    slider: generateId(),
    value: generateId(),
    min: generateId(),
    max: generateId(),
    step: generateId(),
  };

  AddHtmlWidget(node, "BluePixelHtml", getHtmlContent(ids, node));
  node.widgets[1].computeSize = () => [0, -50];

  // Add a small delay to ensure DOM elements are created before accessing them
  setTimeout(() => {
    ResizeDiv(node, ids);
    setupEventListeners(node, ids);
  }, 50);

  updateNodeTitle(node, node.title);
  node.size = [130, 45];
  node.computeSize = () => [120, 28];
}

const ResizeDiv = (node, ids) => {
  const sliderElement = document.getElementById(ids.slider);
  if (!sliderElement) {
    // Element doesn't exist yet, try again after a delay
    setTimeout(() => ResizeDiv(node, ids), 100);
    return;
  }

  const el = sliderElement.parentElement.parentElement;

  el.style.height = `${node.size[1] - 2}px`;

  const onResize = node.onResize;
  node.onResize = function () {
    el.style.height = `${node.size[1] - 2}px`;
    return onResize?.apply(this, arguments);
  };
};

msg(msgType, (data) => {
  try {
    const updates = typeof data === "string" ? JSON.parse(data) : data;
    const updatesArray = Array.isArray(updates) ? updates : [updates];

    updatesArray.forEach((update) => {
      const { title, value, min, max, step } = update;
      if (!title) return;

      const nodes = nodesByTitle.get(title);
      if (!nodes || nodes.length === 0) return;

      nodes.forEach((node) => {
        node.widgets[0].value = value;
        if (min !== undefined && max !== undefined) {
          node.properties.slidermin = min;
          node.properties.slidermax = max;
          node.properties.sliderstep = step;
        }

        const slider = document.getElementById(node.sliderId);
        const valueInput = document.getElementById(node.valueId);
        const minInput = document.getElementById(node.minId);
        const maxInput = document.getElementById(node.maxId);

        if (slider && valueInput && minInput && maxInput) {
          slider.value = value;
          valueInput.value = value;
          if (min !== undefined && max !== undefined) {
            slider.min = min;
            slider.max = max;
            minInput.value = min;
            maxInput.value = max;
          }
          const percentage =
            ((value - node.properties.slidermin) /
              (node.properties.slidermax - node.properties.slidermin)) *
            100;
          syncGrad(slider, percentage);
        }
      });
    });
  } catch (error) {
    console.error("Error updating nodes from message:", error);
  }
});

e.on("beforeRegister", (node, nodeData) => {
  if (node.comfyClass === NodeID) {
    manageNameList(node, msgType, ["MAIN"]);

    const n = node.prototype;
    const originalOnAdded = n.onAdded;
    n.onAdded = async function () {
      this.onModeChanged = async (oldMode, newMode) => send();

      const originalOnTitleChanged = this.onTitleChanged;
      this.onTitleChanged = async function (newTitle) {
        const oldTitle = this.title;
        originalOnTitleChanged?.call(this, newTitle);
        handleTitleChange(this, newTitle, oldTitle);
        send();
      };

      const onRemoved = this.onRemoved;
      this.onRemoved = async () => {
        if (typeof onRemoved === "function") onRemoved.call(this);
        removeNode(this);
        send();
      };

      await styleIt(this);
      this.onTitleChanged(this.title);

      if (originalOnAdded) originalOnAdded.call(this);
    };
  }
});

e.on("afterWorkflowLoaded", async () => send());
e.on("psConnected", async () => send());
const send = async () =>
  await sendList(msgType, await getEnhancedTitleInfoMap());
