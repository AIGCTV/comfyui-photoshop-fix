import { getTitleInfoMap, manageNameList } from "./TitleManager.js";
import { bgImg, sendList } from "./utils.js";
import { api } from "../../../scripts/api.js";
import e from "./event.js";

const NodeID = "🔹Photoshop Images";
let thisNode = [];
const msgType = "ImageSlots";
const DefaultName = "MAIN DOC";

async function styleIt(node) {
  const stringWidget = node.widgets[0];
  node.computeSize = () => [120, 120];
  node.size = [160, 160];

  const intervalId = setInterval(() => {
    if (stringWidget.value != node.title) stringWidget.value = node.title;
  }, 5000);

  stringWidget.value = node.title;
  stringWidget.computeSize = () => [0, -12];
  stringWidget.type = "hidden";

  api.addEventListener("execution_start", () => previewOnTheNode(node));
  const previewOnTheNode = async (node) => {
    try {
      // Check if images exist before setting them on the node
      const imagePath = `/ps/inputs/${stringWidget.value}.png?v=${Date.now()}`;
      const selectionPath = `/ps/inputs/SELECTION.png?v=${Date.now()}`;
      
      // Use fetch with Promise.all to check if images exist
      const imgPromise = fetch('/api' + imagePath, { method: 'HEAD' })
        .then(response => response.ok ? imagePath : null)
        .catch(() => {
          console.warn(`Image not found: ${imagePath}`);
          return null;
        });
      
      const selectionPromise = stringWidget.value === DefaultName ? 
        fetch('/api' + selectionPath, { method: 'HEAD' })
          .then(response => response.ok ? selectionPath : null)
          .catch(() => {
            console.warn(`Selection image not found: ${selectionPath}`);
            return null;
          }) : 
        Promise.resolve(null);
      
      const [imgSrc, selectionSrc] = await Promise.all([imgPromise, selectionPromise]);
      bgImg(node, imgSrc, selectionSrc);
    } catch (error) {
      console.warn("Failed to load preview images:", error.message);
    }
  };

  previewOnTheNode(node);

  const orgOnTitleChanged = node.onTitleChanged;
  node.onTitleChanged = async function (newTitle) {
    if (typeof orgOnTitleChanged === "function") orgOnTitleChanged.call(node, newTitle);
    stringWidget.value = node.title;
    previewOnTheNode(node);

    const defaultLinks = node.outputs[2].links;
    if (newTitle === DefaultName) {
      node.outputs[2].color_off = "#81c784";
      node.outputs[2].color_on = "#81c784";
      node.outputs[2].label = "SELECTION";
      node.outputs[2].links = defaultLinks;
    } else if (node.outputs.length > 2) {
      node.outputs[2].color_on = "#1A1E24";
      node.outputs[2].color_off = "#1A1E24";
      node.outputs[2].label = " ";
      node.outputs[2].links = [];
    }
  };

  const onRemoved = node.onRemoved;
  node.onRemoved = function () {
    if (typeof onRemoved === "function") onRemoved.call(this);
    // thisNode.splice(thisNode.indexOf(node), 1);
    clearInterval(intervalId);
    send();
    api.removeEventListener("execution_start", previewOnTheNode);
  };
}

e.on("beforeRegister", (node, nodeData, app) => {
  if (node.comfyClass === NodeID) {
    manageNameList(node, "ImageSlots", [DefaultName]);

    const n = node.prototype;
    const originalOnAdded = n.onAdded;
    n.onAdded = function () {
      this.onModeChanged = async (oldMode, newMode) => send();

      const orgOnTitleChanged = this.onTitleChanged;
      this.onTitleChanged = async function (newTitle) {
        orgOnTitleChanged?.call(this, newTitle);
        send();
      };

      thisNode.push(this);

      styleIt(this);
      this.onTitleChanged(this.title);
      if (originalOnAdded) originalOnAdded.call(this);
    };

    n.constructor = {
      ...n.constructor,
      size: [200, 200],
    };
  }
});

e.on("afterWorkflowLoaded", async () => await send());
e.on("psConnected", async () => await send());
const send = async () => await sendList(msgType, await getTitleInfoMap(msgType), DefaultName);
