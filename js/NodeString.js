import { AddHtmlWidget, sendList } from "./utils.js";
import { msg } from "./connection.js";
import { manageNameList } from "./TitleManager.js";
import e from "./event.js";

const NodeID = "🔹Photoshop Strings";
const msgType = "StringSlots";

function generateUniqueId(prefix) {
  return `${prefix}_${Math.random().toString(36).substr(2, 9)}`;
}

// Improved title management with WeakMap
const nodesByTitle = new Map();
const nodeTitleMap = new WeakMap();

function getCurrentNodesWithTitle(title) {
  return nodesByTitle.get(title) || [];
}

function updateNodeTitle(node, newTitle) {
  const currentTitle = nodeTitleMap.get(node);

  // Remove from old title group
  if (currentTitle) {
    const currentNodes = nodesByTitle.get(currentTitle);
    if (currentNodes) {
      const index = currentNodes.indexOf(node);
      if (index > -1) {
        currentNodes.splice(index, 1);
      }
      if (currentNodes.length === 0) {
        nodesByTitle.delete(currentTitle);
      }
    }
  }

  // Add to new title group
  if (!nodesByTitle.has(newTitle)) {
    nodesByTitle.set(newTitle, []);
  }
  nodesByTitle.get(newTitle).push(node);
  nodeTitleMap.set(node, newTitle);
}

function updateNodesFromMessage(data) {
  try {
    // If data is received as a string, parse it
    const updates = typeof data === "string" ? JSON.parse(data) : data;

    // Ensure updates is an array
    const updatesArray = Array.isArray(updates) ? updates : [updates];

    updatesArray.forEach((update) => {
      const { title, value } = update;
      if (!title) return;

      const nodes = nodesByTitle.get(title);
      if (!nodes || nodes.length === 0) return;

      // Update all nodes with matching title
      nodes.forEach((node) => {
        // Update the widget value
        if (node.widgets[0]) {
          node.widgets[0].value = value;
        }

        // Update textarea if it exists
        const textarea = document.getElementById(node.textareaId);
        if (textarea) {
          textarea.value = value;
        }
      });
    });
  } catch (error) {
    console.error("Error updating nodes from message:", error);
  }
}

// Register message handler
msg(msgType, (data) => {
  console.log("🚀 ~ msg ~ data:", data);
  updateNodesFromMessage(data);
});

async function getEnhancedTitleInfoMap() {
  const titleInfo = [];

  for (const [title, nodes] of nodesByTitle.entries()) {
    if (nodes.length > 0) {
      const ids = nodes.map((node) => node.id);
      const value = nodes[0].widgets[0].value || "";

      titleInfo.push({
        title,
        ids,
        value,
      });
    }
  }

  return titleInfo;
}

function syncNodesWithSameTitle(sourceNode, value) {
  const currentTitle = nodeTitleMap.get(sourceNode);
  if (!currentTitle) return;

  const nodesWithSameTitle = getCurrentNodesWithTitle(currentTitle);

  nodesWithSameTitle.forEach((node) => {
    if (node !== sourceNode) {
      node.widgets[0].value = value;

      const textarea = document.getElementById(node.textareaId);
      if (textarea) {
        textarea.value = value;
      }
    }
  });
}

function handleTitleChange(node, newTitle, oldTitle) {
  // Update title mappings
  updateNodeTitle(node, newTitle);

  // Sync with existing nodes of the same new title
  const existingNodes = getCurrentNodesWithTitle(newTitle);
  if (existingNodes.length > 1) {
    // More than 1 because current node is already added
    const existingValue = existingNodes[0].widgets[0].value || "";

    node.widgets[0].value = existingValue;
    const textarea = document.getElementById(node.textareaId);
    if (textarea) {
      textarea.value = existingValue;
    }
  }
}

function removeNode(node) {
  const currentTitle = nodeTitleMap.get(node);
  if (currentTitle) {
    const nodes = nodesByTitle.get(currentTitle);
    if (nodes) {
      const index = nodes.indexOf(node);
      if (index > -1) {
        nodes.splice(index, 1);
      }
      if (nodes.length === 0) {
        nodesByTitle.delete(currentTitle);
      }
    }
  }
  nodeTitleMap.delete(node);
  send();
}

async function styleIt(node) {
  if (!node.widgets[1]) {
    node.computeSize = () => [110, 20];
    node.size = [200, 75];

    const stringWidget = node.widgets[0];
    stringWidget.computeSize = () => [0, -LiteGraph.NODE_WIDGET_HEIGHT - LiteGraph.NODE_SLOT_HEIGHT + 8];
    stringWidget.type = "hidden";

    const textareaId = generateUniqueId("textarea");
    node.textareaId = textareaId;

    const htmlContent = `
      <textarea
        style="width: calc(100% - 2px); height: calc(100% + 2px); margin-left:-4px"
        autocomplete="off"
        spellcheck="false"
        class="blupixl-text-input"
        id="${textareaId}"
        placeholder="Type here"
        type="text"></textarea>
    `;

    const widget = AddHtmlWidget(node, "BluePixelHtml", htmlContent);
    
    // Add a delay to ensure the element is rendered before accessing it
    setTimeout(() => {
      const textarea = document.getElementById(textareaId);

      if (!textarea) {
        console.error("🔹Failed to find elements for node:", node.id);
        return;
      }

      e.on("workflowLoaded", () => (textarea.value = stringWidget.value));

      textarea.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        textarea.focus();
      });

      textarea.addEventListener("input", async () => {
        const newValue = textarea.value;
        stringWidget.value = newValue;
        syncNodesWithSameTitle(node, newValue);
      });

      textarea.addEventListener("change", () => send());
      node.textareaId = textareaId;
      updateNodeTitle(node, node.title);
    }, 50); // 50ms delay, adjust if needed
  }
}
const send = async () => await sendList(msgType, await getEnhancedTitleInfoMap(), ["+ PROMPT", "- PROMPT"]);

e.on("beforeRegister", (node, nodeData, app) => {
  if (node.comfyClass === NodeID) {
    const n = node.prototype;
    manageNameList(node, msgType, ["+ PROMPT", "- PROMPT"]);

    const originalOnAdded = n.onAdded;
    n.onAdded = async function () {
      const originalOnTitleChanged = this.onTitleChanged;
      this.onTitleChanged = async function (newTitle) {
        originalOnTitleChanged?.call(this, newTitle);
        const oldTitle = this.title;
        handleTitleChange(this, newTitle, oldTitle);
        send();
      };

      this.onRemoved = () => removeNode(this);
      this.onModeChanged = () => send();

      await styleIt(this);
      send();

      if (typeof originalOnAdded === "function") originalOnAdded.call(this);
    };
  }
});

e.on("afterWorkflowLoaded", async () => send());
e.on("psConnected", async () => send());
