import { msg, sendMsg } from "./connection.js";
import e, { BluePixelExist, isPsConnected, isWorkflowLoaded } from "./event.js";
import { brandStyle } from "./utils.js";
import { app } from "../../../scripts/app.js";
const msgType = "switchers";
const NodeID = [
  "Fast Groups Muter (rgthree)",
  "Fast Groups Bypasser (rgthree)",
  "Fast Muter (rgthree)",
  "Fast Bypasser (rgthree)",
];

const nodeDataList = new Map();
const eventTarget = new EventTarget();

async function toggleButton(node) {
  node.customDisplayText = "Multi";
  node.customRect = { x: 0, y: 0, width: 0, height: 0 };

  function updateButtonText(node) {
    const state = node.properties?.toggleRestriction || "default";
    node.customDisplayText =
      state === "default" ? "Multi" : state === "max one" ? "Max 1" : "Single";
  }

  node.onDrawForeground = function (ctx) {
    if (!node.flags.collapsed) {
      const paddingHorizontal = 4;
      const paddingVertical = 4;
      const borderRadius = 5;
      const bgcolor = LiteGraph.WIDGET_BGCOLOR;

      ctx.globalAlpha = isPointInsideRect(
        node.mouseX,
        node.mouseY,
        this.customRect
      )
        ? 0.6
        : 1;

      ctx.font = "400 9px Arial";
      const textWidth = ctx.measureText(this.customDisplayText).width;

      const contentWidth = textWidth;
      const totalWidth = contentWidth + paddingHorizontal * 2;

      const rectPadding = 8;
      const rectY = -22;
      const rectX = node.size[0] - totalWidth - rectPadding;
      const rectHeight = 8 + paddingVertical * 2;

      this.customRect = {
        x: rectX,
        y: rectY,
        width: totalWidth,
        height: rectHeight,
      };

      ctx.fillStyle = bgcolor;
      ctx.beginPath();
      ctx.roundRect(rectX, rectY, totalWidth, rectHeight, borderRadius);
      ctx.fill();

      ctx.globalAlpha = 0.8;

      const textX = rectX + (totalWidth - textWidth) / 2;
      const textY = rectY + paddingVertical + 7;
      ctx.fillStyle = LiteGraph.WIDGET_SECONDARY_TEXT_COLOR;
      ctx.fillText(this.customDisplayText, textX, textY);
    }
  };

  node.onMouseDown = function (event, pos) {
    if (isPointInsideRect(pos[0], pos[1], this.customRect)) {
      const states = ["default", "max one", "always one"];
      const currentState = this.properties?.toggleRestriction || "default";
      const nextState =
        states[(states.indexOf(currentState) + 1) % states.length];

      this.properties.toggleRestriction = nextState;
      updateButtonText(this);

      eventTarget.dispatchEvent(
        new CustomEvent("toggleStateChanged", { detail: nextState })
      );
      send();
    }
  };

  updateButtonText(node);
}

function isPointInsideRect(x, y, rect) {
  return (
    x >= rect.x &&
    x <= rect.x + rect.width &&
    y >= rect.y &&
    y <= rect.y + rect.height
  );
}

function styleIt(node) {
  toggleButton(node);
  node.title = node.title
    .replace("(rgthree)", "ʳᵍᵗʰʳᵉᵉ")
    .replace("Fast", "")
    .replace("Groups ", "Group");
  if (node.outputs[0]) {
    if (node.outputs[0].name == "OPT_CONNECTION") node.outputs[0].name = " ";
    node.outputs[0].color_on = "#1A1E24";
    node.outputs[0].color_off = "#1A1E24";
  }
}

function onRemoved(node) {
  const originalonRemoved = node.onRemoved;
  node.onRemoved = function (...args) {
    originalonRemoved?.apply(node, args);
    if (nodeDataList.has(node.id)) {
      const nodeData = nodeDataList.get(node.id);
      nodeDataList.delete(node.id);
      emitChange("remove", nodeData);
      return true;
    }
    return false;
  };
}

function getAllNodesData() {
  const data = Array.from(nodeDataList.values());
  return data;
}

function emitChange(type, data) {
  const event = new CustomEvent("nodeDataChanged", {
    detail: { type, data, timestamp: Date.now() },
  });
  eventTarget.dispatchEvent(event);
}

function onNodeChange(callback) {
  eventTarget.addEventListener("nodeDataChanged", callback);
}

function EventMaker(node) {
  if (node.__setterGetterInitialized) {
    return;
  }

  let titleValue = node.title;
  Object.defineProperty(node, "title", {
    get: function () {
      return titleValue;
    },
    set: function (newValue) {
      if (titleValue !== newValue) {
        titleValue = newValue;
        updateNodeData(node);
      }
    },
  });

  const originalPush = node.widgets.push;
  const originalSplice = node.widgets.splice;

  Object.defineProperty(node.widgets, "push", {
    value: function (...items) {
      const result = originalPush.apply(this, items);
      items.forEach((widget, index) => {
        defineWidgetValueGetterSetter(
          widget,
          this.length - items.length + index
        );
      });
      updateNodeData(node);
      return result;
    },
  });

  Object.defineProperty(node.widgets, "splice", {
    value: function (...args) {
      const result = originalSplice.apply(this, args);
      updateNodeData(node);
      return result;
    },
  });

  function defineWidgetValueGetterSetter(widget, index) {
    if (widget.hasOwnProperty('toggle')) {
      let toggleValue = widget.toggle;
      Object.defineProperty(widget, "toggle", {
        get: function () {
          return toggleValue;
        },
        set: function (newValue) {
          if (toggleValue !== newValue) {
            toggleValue = newValue;
            updateNodeData(node);
          }
        },
      });
    }

    if (widget.hasOwnProperty('value')){
      let valueValue = widget.value;
      Object.defineProperty(widget, "value", {
        get: function () {
          return valueValue;
        },
        set: function (newValue) {
          if (valueValue !== newValue) {
            valueValue = newValue;
            updateNodeData(node);
          }
        },
      });
    }

    if (widget.value && widget.value.hasOwnProperty('toggled')) {
      let toggledValue = widget.value.toggled;
      
      try {
        Object.defineProperty(widget.value, "toggled", {
          get: function () {
            return toggledValue;
          },
          set: function (newValue) {
            if (toggledValue !== newValue) {
              toggledValue = newValue;
              updateNodeData(node);
            }
          }
        });
      } catch (error) {
        console.error(`Error defining getter/setter for widget.value.toggled: ${error.message}`);
      }
    }
  }

  node.widgets.forEach(defineWidgetValueGetterSetter);
  node.__setterGetterInitialized = true;

  updateNodeData(node);
}

onNodeChange((event) => {
  const { type, data } = event.detail;
  send();
});

function send() {
  const allNodeData = getAllNodesData();
  if (isPsConnected) {
    sendMsg("switchers", allNodeData);
  }
}

e.on("psConnected", () => {
  if (isWorkflowLoaded) {
    send();
  }
});

e.on("beforeConfigureGraph", (event) => {
  try {
    NodeID.forEach((id) => {
      const node = LiteGraph.getNodeType(id);
      if (!node) {
        return;
      }

      const n = node.prototype;
      const originalOnAdded = n.onAdded;

      n.onAdded = function (...args) {
        try {
          originalOnAdded?.apply(this, args);
          setup(this);
        } catch (error) {
          console.error(
            `Error during patched onAdded execution for node ${this.id} (type ${id}):`,
            error
          );
        }
      };
    });
  } catch (error) {
    console.error(
      "Error in beforeConfigureGraph event handler:",
      error
    );
  }
});

e.on("afterWorkflowLoaded", () => {
  app.graph._nodes
    .filter((n) => NodeID.includes(n.type))
    .forEach((n) => {
      setup(n);
      if (n.properties?.toggleRestriction) {
        toggleButton(n);
      }
    });
});

function setup(node) {
  if (isWorkflowLoaded && BluePixelExist) {
    EventMaker(node);
    NodeID.forEach((id) => {
      const nodeType = LiteGraph.getNodeType(id);
      if (node.type === id && nodeType) {
        brandStyle(node, nodeType);
      }
    });
    styleIt(node);
    onRemoved(node);
  }
}
msg(msgType, async (data) => {
  const { switcherId, widgets } = data;
  const node = app.graph.getNodeById(switcherId);

  if (!node) {
    console.warn(`Node connection message: Node with ID ${switcherId} not found.`);
    return;
  }

  widgets.forEach(async (receivedWidget) => {
    const localWidget = node.widgets.find((w) => {
      if (String(w.name).startsWith("RGTHREE_")) {
        const cleanLabel = String(w.label)
          .replace("Enable ", "")
          .replace("Disable ", "");
        return cleanLabel === receivedWidget.name;
      } else {
        const cleanName = String(w.name)
          .replace("Enable ", "")
          .replace("Disable ", "");
        return cleanName === receivedWidget.name;
      }
    });

    if (localWidget) {
      let currentState;
      if (localWidget.hasOwnProperty('toggle')) {
          currentState = !!localWidget.toggle;
      } else if (localWidget.value && localWidget.value.hasOwnProperty('toggled')) {
          currentState = !!localWidget.value.toggled;
      } else if (localWidget.hasOwnProperty('value')) {
          currentState = !!localWidget.value;
      }

      if (currentState !== receivedWidget.selected) {
          localWidget.doModeChange(receivedWidget.selected, true);
      }
    } else {
        console.warn(`Node connection message: Local widget corresponding to received widget '${receivedWidget.name}' not found on node ${node.id}.`);
    }

  });

  updateNodeData(node);
});

const updateNodeData = (node) => {
  let retryUpdateNeeded = false; // Flag to track if a retry is needed

  const nodeData = {
    id: node.id,
    title: node.title,
    type: node.properties?.toggleRestriction || "default",
    widgets: node.widgets.map((widget) => {
      const isRgthreeWidget = String(widget.name).startsWith("RGTHREE_");
      const nameIdentifier = isRgthreeWidget
        ? String(widget.label || '').replace("Enable ", "").replace("Disable ", "") // Use empty string if label is null/undefined initially
        : String(widget.name).replace("Enable ", "").replace("Disable ", "");

      // Check if an RGTHREE widget ended up with no identifier
      if (isRgthreeWidget && !nameIdentifier) {
        retryUpdateNeeded = true;
      }

      let selectedState = false;
      let stateSource = "unknown";
      
      if (widget.hasOwnProperty('toggle')) {
        selectedState = !!widget.toggle;
        stateSource = "toggle";
      } else if (widget.value && widget.value.hasOwnProperty('toggled')) {
        selectedState = !!widget.value.toggled;
        stateSource = "value.toggled";
      } else if (widget.hasOwnProperty('value')) {
        selectedState = !!widget.value;
        stateSource = "value";
      }
      
      return {
        name: nameIdentifier,
        selected: selectedState,
      };
    }),
  };

  // If any RGTHREE widget identifier was missing, schedule a retry
  if (retryUpdateNeeded) {
    console.warn(`updateNodeData: Widget label potentially missing for node ${node.id}. Scheduling retry in 200ms.`);
    setTimeout(() => {
      updateNodeData(node); // Retry the update for this specific node
    }, 200);
  }

  // Proceed with the current data (even if potentially incomplete)
  nodeDataList.set(node.id, nodeData);
  emitChange("update", nodeData);
  return nodeData;
};
