// events.js
import { app } from "../../../scripts/app.js";
import { connect, msg } from "./connection.js";
import { addModeChangeHandler, brandStyle } from "./utils.js";

let BluePixelNodes = [];
export let isPsConnected = false;

export let isWorkflowLoaded = false;
export let BluePixelExist = false;

const e = {
  listeners: {
    workflowLoaded: [],
    nodeCreated: [],
    afterWorkflowLoaded: [],
    beforeConfigureGraph: [],
    onProgressUpdate: [],
    psConnected: [],
    bluePixelAdded: [],
    beforeRegister: [],
    init: [],
    setup: [],
  },

  on(eventName, callback) {
    if (!this.listeners.hasOwnProperty(eventName)) {
      console.error(`⚠️ Event "${eventName}" is not defined.`);
      return false;
    }

    if (typeof callback !== 'function') {
      console.error(`⚠️ Callback for "${eventName}" must be a function. Received ${typeof callback}`);
      return false;
    }

    this.listeners[eventName].push(callback);
    return true;
  },

  emit(eventName, ...args) {
    if (!this.listeners.hasOwnProperty(eventName)) {
      console.error(`⚠️ Cannot emit undefined event "${eventName}"`);
      return false;
    }

    let success = true;
    this.listeners[eventName].forEach((callback, index) => {
      try {
        if (typeof callback !== 'function') {
          console.error(`⚠️ Invalid callback found for "${eventName}" at index ${index}`);
          success = false;
          return;
        }
        callback(...args);
      } catch (error) {
        console.error(`⚠️ Error in "${eventName}" callback at index ${index}:`, error);
        success = false;
      }
    });
    return success;
  },

  off(eventName, callback) {
    if (!this.listeners.hasOwnProperty(eventName)) {
      console.error(`⚠️ Cannot remove listener for undefined event "${eventName}"`);
      return false;
    }

    const index = this.listeners[eventName].indexOf(callback);
    if (index !== -1) {
      this.listeners[eventName].splice(index, 1);
      return true;
    }
    return false;
  }
};

app.registerExtension({
  name: "🔹BluePixel",

  init() {
    try {
      e.emit("init");
    } catch (error) {
      console.error("❌ Error initializing BluePixel extension:", error);
    }
  },
  setup() {
    try {
      e.emit("setup");
    } catch (error) {
      console.error("❌ Error setting up BluePixel extension:", error);
    }
  },

  onProgressUpdate(event) {
    try {
      e.emit("onProgressUpdate", event);
    } catch (error) {
      console.error("❌ Error updating progress:", error);
    }
  },

  async beforeRegisterNodeDef(node, nodeData, app) {
    try {
      e.emit("beforeRegister", node, nodeData, app);

      if (node.comfyClass.startsWith("🔹")) {
        const n = node.prototype;

        await brandStyle(n);
        const originalOnAdded = n.onAdded;
        n.onAdded = function (...args) {
          try {
            originalOnAdded?.call(this, args);

            addModeChangeHandler(this);

            BluePixelNodes.push(this);
            BluePixelExist = true;
            if (BluePixelNodes.length == 1) e.emit("bluePixelAdded", node);
            connect();

            const originalonRemoved = this.onRemoved;
            this.onRemoved = () => {
              try {
                originalonRemoved?.apply(this, args);
                BluePixelNodes.splice(BluePixelNodes.indexOf(node), 1);
                if (BluePixelNodes.length === 0) BluePixelExist = false;
              } catch (error) {
                console.error("❌ Error removing node:", error);
              }
            };
          } catch (error) {
            console.error("❌ Error adding node:", error);
          }
        };
      }
    } catch (error) {
      console.error("❌ Error registering node:", error);
    }
  },
  beforeConfigureGraph(event) {
    try {
      e.emit("beforeConfigureGraph", event);
    } catch (error) {
      console.error("❌ Error configuring graph:", error);
    }
  },
  afterConfigureGraph(event) {
    try {
      e.emit("workflowLoaded", event);
      isWorkflowLoaded = true;
      e.emit("afterWorkflowLoaded", event);
    } catch (error) {
      console.error("❌ Error loading workflow:", error);
    }
  },

  nodeCreated(node, nodeData) {
    try {
      e.emit("nodeCreated", node, nodeData);
    } catch (error) {
      console.error("❌ Error creating node:", error);
    }
  },
});

msg("psConnected", () => {
  try {
    isPsConnected = true;
    console.log("isPsConnected", isPsConnected);
    e.emit("psConnected");
  } catch (error) {
    console.error("❌ Error connecting to Photoshop:", error);
  }
});

export default e;