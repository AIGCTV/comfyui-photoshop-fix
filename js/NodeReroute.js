import e, { isWorkflowLoaded } from "./event.js";
import { app } from "../../../scripts/app.js";

const NodeID = "🔹Reroute - Anything Everywhere";

let definitions,
  nodeTypes = [],
  comboTypes = [],
  dataTypes = new Set();
const handleTypeChange = (node, newType) => {
  if (node.lastType === newType) return;

  const inputLink = node.inputs[0].link;
  const outputLinks = [...(node.outputs[0].links || [])];

  inputLink && app.graph.removeLink(inputLink);
  outputLinks.forEach((link) => app.graph.removeLink(link));

  updateType(node, newType);

  outputLinks.forEach((linkId) => {
    const link = app.graph.links[linkId];
    link && node.connect(0, app.graph.getNodeById(link.target_id), link.target_slot);
  });
};

const updateType = (node, newType) => {
  node.inputs[0].type = newType;
  node.outputs[0].type = newType;
  node.widgets[0].value = newType;
  node.lastType = newType;
  node.setDirtyCanvas(true, true);
};

async function styleIt(node) {
  const typeWidget = node.widgets[0];
  typeWidget.options.values = [...dataTypes];
  typeWidget.callback = (v, w, n) => handleTypeChange(node, v);
  typeWidget.y = 5;
  typeWidget.label = " ";
  node.computeSize = () => [80, 28];
  node.size = [120, 28];
}

e.on("beforeRegister", (node, nodeData, app) => {
  if (node.comfyClass === NodeID) {
    const n = node.prototype;
    const originalOnAdded = n.onAdded;

    n.onAdded = function () {
      originalOnAdded?.call(this);
      styleIt(this);

      // this.onConnectionsChange = (side, slot, connect, link_info) => {
      //   if (connect && link_info?.origin_id) {
      //     const originNode = app.graph.getNodeById(link_info.origin_id);
      //     const newType = originNode?.outputs?.[link_info.origin_slot]?.type;
      //     newType && updateType(this, newType);
      //   }
      // };
      if (isWorkflowLoaded) updateType(this, this.widgets[0].value);
      else e.on("afterWorkflowLoaded", async () => updateType(this, this.widgets[0].value));
    };

    const originalOnNodeCreated = n.onNodeCreated;
    n.onNodeCreated = function () {
      originalOnNodeCreated?.call(this);
      e.on("afterWorkflowLoaded", async () => updateType(this, this.widgets[0].value));
    };

    n.constructor = {
      ...n.constructor,
      size: [200, 200],
      title_mode: LiteGraph.TRANSPARENT_TITLE,
    };
  }
});

app.registerExtension({
  name: NodeID,
  addCustomNodeDefs(defs) {
    if (!Array.isArray(dataTypes)) {
      definitions = defs;

      for (let key in definitions) {
        for (let idx in definitions[key].output) if (!Array.isArray(definitions[key].output[idx])) dataTypes.add(definitions[key].output[idx]);
        for (let idx in definitions[key].input) for (let type in definitions[key].input[idx]) if (Array.isArray(definitions[key].input[idx][type][0])) comboTypes.push([key, idx, type]);
      }

      dataTypes = [...dataTypes.values()];
    }
  },
});
