import { AddHtmlWidget, sendList } from "./utils.js";
import { msg, sendMsg } from "./connection.js";
import e from "./event.js";
import { api } from "../../../scripts/api.js";

const NodeID = "🔹SeedManager";
const msgType = "SeedSlot";
const DEBUG_PREFIX = "[SeedManager]"; // Added prefix for clarity

// Simple array to track all nodes of this type
const nodes = [];
const generateId = () => `_${Math.random().toString(36).slice(2, 11)}`;
function generateRandomSeed(min = 1, max = 999999) {
  const seed = Math.floor(Math.random() * (max - min + 1)) + min;
  console.log(DEBUG_PREFIX, `Generated random seed: ${seed}`);
  return seed;
}

function initializeWidgetOptions(node) {
  console.log(DEBUG_PREFIX, `Initializing widget options for node ${node.id}`);
  if (!node.widgets[1].options) node.widgets[1].options = {};
  if (!node.widgets[0].options) node.widgets[0].options = {};
}

function addHtmlWidget(ids, node) {
  initializeWidgetOptions(node);

  return AddHtmlWidget(
    node,
    "BluePixelHtml",
    `<div style="display: flex; flex-direction: column; overflow: hidden; margin-left: -6px">
      <div style="display: flex; margin-top: 1px;">
        <button id="${ids.autobtn}" class="blupixl-align-center blupixl-button" style="margin-right:4px;width: 18px; height: 18px; border-radius: 24px;"> 
          <svg viewBox="1 3 32 32" xmlns="http://www.w3.org/2000/svg" width="16" height="16">
            <g fill="#EAF3FF55">
              <path d="M8 10.7h2.9c1.6 0 2.9 0.7 3.7 2L18 18c0.5 0.8 1.1 1.2 2 1.2h0.8v-1.6c0-0.2 0-0.4 0.3-0.5l0.6 0.1 1.7 1.4 1.4 1.2c0.2 0.2 0.3 0.4 0.2 0.6l-0.2 0.3-3.1 2.6c-0.2 0.1-0.4 0.2-0.6 0c-0.2 0-0.3-0.2-0.3-0.4v-1.6h-0.4l-1.7-0.1c-1-0.4-1.9-1-2.5-2L12.8 14c-0.3-0.5-0.7-0.8-1.2-1L7.9 10.7v-2.2Z"/>
              <path d="M8 19.2h2.9c0.8 0 1.5-0.4 2-1l0.6-1.2l0.2 0.2 1 1.7v0.2c-0.8 1.4-2.1 2.1-3.6 2.2H8v-2.1Z"/>
              <path d="M20.8 10.7V9c0-0.4 0.4-0.6 0.7-0.5l0.2 0.2 3 2.5c0.5 0.3 0.5 0.6 0 1c-1.1 0.9-2.1 1.7-3.2 2.6c-0.3 0.1-0.7-0.1-0.7-0.5v-1.6c-1.2 0-2 0-2.8 1.1l-0.7 1l-1.2-1.8v-0.2c0.7-1.3 1.8-2 3-2.1l1.4-0.1h0.3Z"/>
            </g>
          </svg>
        </button>
        <button id="${ids.randbtn}" class="blupixl-align-center blupixl-button" style="width: 60px; height: 18px; border-radius: 24px;"> Random </button>
        <input id="${ids.value}" class="blupixl-text-input-ghost" style="flex: 1; width: 32px; margin-right:6px; height: 18px;" step="1" value="55555555" type="number"/>
      </div>
    </div>`
  );
}

function updateAllNodes(value, autorand, seed) {
  console.log(DEBUG_PREFIX, `Updating all nodes. Value: ${value}, Autorand: ${autorand}`);
  nodes.forEach((targetNode) => {
    targetNode.widgets[1].value = autorand;
    targetNode.widgets[0].value = value;

    const valueInput = document.getElementById(targetNode.valueId);
    const autobtnInput = document.getElementById(targetNode.autobtnId);

    if (valueInput && autobtnInput) {
      valueInput.value = value;
      autobtnInput.value = autorand;
    }
    activestyleRefresh(targetNode);
  });
}

function setupEventListeners(node, ids) {
  console.log(DEBUG_PREFIX, `Setting up event listeners for node ${node.id}`, ids);
  const el = {
    value: document.getElementById(ids.value),
    autobtn: document.getElementById(ids.autobtn),
    randbtn: document.getElementById(ids.randbtn),
  };

  node.valueId = ids.value;
  node.autobtnId = ids.autobtn;
  node.randbtnId = ids.randbtn;

  const preventScrollChange = (event) => event.preventDefault();
  el.value.addEventListener("wheel", preventScrollChange);

  // Generate random seed and update all nodes
  const handleRandomSeed = () => {
    const randomSeed = generateRandomSeed();
    console.log(DEBUG_PREFIX, `Handle Random Seed Clicked. New Seed: ${randomSeed}`);
    el.value.value = randomSeed;
    node.widgets[0].value = randomSeed;
    updateAllNodes(randomSeed, node.widgets[1].value, randomSeed);
    send();
  };

  el.randbtn.addEventListener("click", handleRandomSeed);

  // Toggle auto mode between enable and disable
  const handleAutoToggle = (e) => {
    const currentMode = node.widgets[1].value;
    const newMode = currentMode === "enable" ? "disable" : "enable";
    console.log(DEBUG_PREFIX, `Handle Auto Toggle Clicked. New Mode: ${newMode}`);
    node.widgets[1].value = newMode;
    // Update nodes
    activestyleRefresh(node);
    updateAllNodes(el.value.value, newMode, node.widgets[0].value);
    send();
  };

  el.autobtn.addEventListener("click", handleAutoToggle);

  el.value.addEventListener("change", () => {
    console.log(DEBUG_PREFIX, `Seed value changed to: ${el.value.value}`);
    updateAllNodes(el.value.value, el.autobtn.value, el.value.value);
    node.widgets[0].value = el.value.value;
    send();
  });
}
const activestyleRefresh = async (node) => {
  console.log(DEBUG_PREFIX, `Refreshing active style for node ${node.id}, Auto mode: ${node.widgets[1].value}`);
  const retryOnce = async () => {
    try {
      const autobtn = document.getElementById(node.ids.autobtn)
      if (!autobtn) throw new Error("Button not found")
      console.log(DEBUG_PREFIX, `Style Refresh: Button found. Setting class based on mode: ${node.widgets[1].value}`);
      if (node.widgets[1].value === "enable") autobtn.classList.add("blupixl-button-active")
      else autobtn.classList.remove("blupixl-button-active")
    } catch (err) {
      console.warn(DEBUG_PREFIX, `Style Refresh: Error - ${err}. Retrying in 1s...`);
      await new Promise(resolve => setTimeout(resolve, 1000))
      try {
        const autobtn = document.getElementById(node.ids.autobtn)
        if (!autobtn) throw new Error("Button not found after retry")
        console.log(DEBUG_PREFIX, `Style Refresh (Retry): Button found. Setting class based on mode: ${node.widgets[1].value}`);
        if (node.widgets[1].value === "enable") autobtn.classList.add("blupixl-button-active")
        else autobtn.classList.remove("blupixl-button-active")
      } catch (err) {
        console.error(DEBUG_PREFIX, "Failed to refresh button style after retry:", err)
      }
    }
  }
  await retryOnce()
}

async function styleit(node) {
  console.log(DEBUG_PREFIX, `Styling node ${node.id}`);
  if (node.widgets[2]) {
      console.log(DEBUG_PREFIX, `Node ${node.id} already styled (widget 2 exists).`);
      return;
  }
  const widgetAuto = node.widgets[1];
  const widgetseed = node.widgets[0];

  widgetAuto.computeSize = () => [0, -LiteGraph.NODE_SLOT_HEIGHT - LiteGraph.NODE_WIDGET_HEIGHT];
  widgetAuto.type = "hidden";
  widgetseed.type = "hidden";
  widgetseed.computeSize = () => [0, 0];
  const ids = {
    value: generateId(),
    autobtn: generateId(),
    randbtn: generateId(),
  };
  console.log(DEBUG_PREFIX, `Generated IDs for node ${node.id}:`, ids);
  node.ids = ids;

  const htmlwidget = addHtmlWidget(ids, node);
  htmlwidget.computeSize = () => [0, 16];

  // Delay setup until next event loop cycle to ensure DOM elements exist
  setTimeout(() => {
    console.log(DEBUG_PREFIX, `Setting up listeners and loading data for node ${node.id} after timeout.`);
    setupEventListeners(node, ids);

    // Add node to tracking array
    console.log(DEBUG_PREFIX, `Adding node ${node.id} to tracked nodes.`);

    const keys = Object.keys(nodes);
    if (keys.length > 0) {
      const firstKey = keys[0];
      console.log(DEBUG_PREFIX, `Syncing new node ${node.id} with existing node ${nodes[firstKey].id}'s widgets.`);
      node.widgets[0] = nodes[firstKey].widgets[0];
      node.widgets[1] = nodes[firstKey].widgets[1];
    } else {
        console.log(DEBUG_PREFIX, `Node ${node.id} is the first, no existing widgets to sync from.`);
    }

    nodes.push(node);
    loadData(node, ids);
  }, 0);
}

function loadData(node, ids) {
  console.log(DEBUG_PREFIX, `Loading data for node ${node.id}`, ids);
  const el = {
    value: document.getElementById(ids.value),
    autobtn: document.getElementById(ids.autobtn),
    randbtn: document.getElementById(ids.randbtn),
  };

  setTimeout(() => {
    console.log(DEBUG_PREFIX, `Applying loaded data to node ${node.id}. Seed: ${node.widgets[0].value}, Auto: ${node.widgets[1].value}`);
    if (node.widgets[0].value) el.value.value = node.widgets[0].value;
    activestyleRefresh(node, ids); // Removed ids, as it's not used in activestyleRefresh
  }, 200);
}

// Message handler for syncing nodes
msg(msgType, (data) => {
  console.log(DEBUG_PREFIX, `Received message (${msgType}):`, data);
  updateAllNodes(data.seed, data.autorandom ? "enable" : "disable");
});

e.on("beforeRegister", (node) => {
  console.log(DEBUG_PREFIX, `beforeRegister event for node type: ${node.comfyClass}`);
  if (node.comfyClass === NodeID) {
    const n = node.prototype;
    const originalOnAdded = n.onAdded;
    n.onAdded = async function () {
      console.log(DEBUG_PREFIX, `onAdded called for node ${this.id}`);
      this.computeSize = () => [120, 28];
      this.setSize(this.computeSize());

      this.onModeChanged = async () => await sendList(msgType, await send(), "MAIN");

      this.onRemoved = async () => {
        console.log(DEBUG_PREFIX, `onRemoved called for node ${this.id}`);
        const index = nodes.indexOf(this);
        if (index > -1) nodes.splice(index, 1);
        await send();
      };

      await styleit(this);
      console.log(DEBUG_PREFIX, `Node ${this.id} styling complete.`);

      // Check if similar nodes exist and get seed from them
      if (nodes.length > 0) {
        const firstNode = nodes[0];
        console.log(DEBUG_PREFIX, `Node ${this.id} inheriting state from node ${firstNode.id}.`);
        this.widgets[0].value = firstNode.widgets[0].value; // Set seed from existing node
        this.widgets[1].value = firstNode.widgets[1].value; // Set autorandom from existing node
      } else {
        console.log(DEBUG_PREFIX, `Node ${this.id} is the first SeedManager. Setting default state.`);
        this.widgets[0].value = 1379; // Default seed if no similar nodes exist
        this.widgets[1].value = "disable"; // Default autorandom state
      }

      // Update UI and send the seed value
      updateAllNodes(this.widgets[0].value, this.widgets[1].value);
      await send();

      if (originalOnAdded) originalOnAdded.call(this);
    };
  }
});
const send = async () => {
  const keys = Object.keys(nodes);
  if (keys.length > 0) {
    const firstKey = keys[0];
    const payload = { seed: nodes[firstKey].widgets[0].value, autorandom: nodes[firstKey].widgets[1].value };
    console.log(DEBUG_PREFIX, `Sending message (${msgType}):`, payload);
    return await sendMsg(msgType, payload);
  } else {
    console.log(DEBUG_PREFIX, `Send called, but no nodes exist. Skipping message send.`);
    return Promise.resolve(); // Return resolved promise if no nodes
  }
};

const apiQueuePrompt = api.queuePrompt.bind(api);
api.queuePrompt = async function (index, prompt) {
  console.log(DEBUG_PREFIX, `Intercepting queuePrompt. Index: ${index}, Prompt:`, JSON.stringify(prompt));
  const keys = Object.keys(nodes);
  if (keys.length > 0) {
    const firstKey = keys[0];
    if (nodes[firstKey].widgets[1].value === "enable") {
      console.log(DEBUG_PREFIX, `Auto-random enabled. Generating new seed for prompt.`);
      const randnum = generateRandomSeed();
      updateAllNodes(randnum, "enable");

      for (const key in prompt.output) {
        if (prompt.output[key]?.class_type === "🔹SeedManager") {
          console.log(DEBUG_PREFIX, `Updating prompt node ${key} with new seed: ${randnum}`);
          prompt.output[key].inputs.manual_seed = randnum;
        }
      }
    } else {
      console.log(DEBUG_PREFIX, `Auto-random disabled. Not modifying prompt seed.`);
    }
  } else {
      console.log(DEBUG_PREFIX, `No SeedManager nodes found. Not modifying prompt seed.`);
  }

  console.log(DEBUG_PREFIX, `Calling original queuePrompt...`);
  const response = await apiQueuePrompt(index, prompt);
  console.log(DEBUG_PREFIX, `Original queuePrompt returned:`, response);
  return response;
};

e.on("afterWorkflowLoaded", async () => {
    console.log(DEBUG_PREFIX, "afterWorkflowLoaded event triggered. Sending current state.");
    await send()
});
e.on("psConnected", async () => {
    console.log(DEBUG_PREFIX, "psConnected event triggered. Sending current state.");
    await send()
});
