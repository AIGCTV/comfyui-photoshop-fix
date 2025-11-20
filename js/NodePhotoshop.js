import e from "./event.js";
import { AddHtmlWidget } from "./utils.js";
import { app } from "../../../scripts/app.js";
const NodeID = "🔹Photoshop ComfyUI Plugin";
let thisNode = [];
const styleIt = (node) => {
  node.btnid = `switchBtn_${Math.random().toString(36).slice(2, 11)}`;

  const btn = document.querySelector(`#${node.btnid}`);
  btn.addEventListener("click", () => {
    const connections = [];
    if (node.outputs) {
      node.outputs.forEach((output, index) => {
        if (output.links && output.links.length > 0) {
          output.links.forEach((linkId) => {
            const link = app.graph.links[linkId];
            if (link) {
              connections.push({
                sourceIndex: index,
                targetNode: app.graph.getNodeById(link.target_id),
                targetSlot: link.target_slot,
              });
            }
          });
        }
      });
    }

    const pos = [...node.pos];
    const size = [...node.size];
    app.graph.remove(node);

    const imageNode = addNode("🔹Photoshop Images", node, { side: "right", offset: 0 });
    imageNode.pos = pos;
    imageNode.size = size;

    const floatNode = addNode("🔹Floats", imageNode, { side: "right", offset: 10 });
    const seedNode = addNode("🔹SeedManager", floatNode, { side: "right", offset: -floatNode.size[0], shiftY: 40 });
    const stringNode1 = addNode("🔹Photoshop Strings", seedNode, { side: "right", offset: -seedNode.size[0], shiftY: 40 });
    const stringNode2 = addNode("🔹Photoshop Strings", stringNode1, { side: "right", offset: -stringNode1.size[0], shiftY: 40 });

    [floatNode, seedNode, stringNode1, stringNode2].forEach((n) => {
      n.size = [130, 28];
      n.flags.collapsed = true;
      n.onResize();
    });

    connections.forEach((conn) => {
      if (conn.sourceIndex === 0) imageNode.connect(0, conn.targetNode, conn.targetSlot);
      else if (conn.sourceIndex === 1) imageNode.connect(2, conn.targetNode, conn.targetSlot);
      else if (conn.sourceIndex === 2) floatNode.connect(0, conn.targetNode, conn.targetSlot);
      else if (conn.sourceIndex === 3) seedNode.connect(0, conn.targetNode, conn.targetSlot);
      else if (conn.sourceIndex === 4) stringNode1.connect(0, conn.targetNode, conn.targetSlot);
      else if (conn.sourceIndex === 5) stringNode2.connect(0, conn.targetNode, conn.targetSlot);
      else if (conn.sourceIndex === 6) imageNode.connect(3, conn.targetNode, conn.targetSlot);
      else if (conn.sourceIndex === 7) imageNode.connect(4, conn.targetNode, conn.targetSlot);
    });
    
    stringNode2.title = "- PROMPT";
    stringNode2.onTitleChanged("- PROMPT");
    stringNode1.onTitleChanged("+ PROMPT");

    [floatNode, seedNode, stringNode1, stringNode2].forEach((n) => {
      n.size = [130, 28];
      n.flags.collapsed = true;
      n.onResize();
    });

    app.graph.setDirtyCanvas(true, true);
  });
};

const addNode = (name, nextTo, options) => {
  options = { side: "left", select: true, shiftY: 0, shiftX: 0, ...(options || {}) };
  const node = LiteGraph.createNode(name);
  app.graph.add(node);

  node.pos = [options.side === "left" ? nextTo.pos[0] - (node.size[0] + options.offset) : nextTo.pos[0] + nextTo.size[0] + options.offset, nextTo.pos[1] + options.shiftY];
  if (options.select) app.canvas.selectNode(node, false);
  return node;
};

e.on("beforeRegister", (node) => {
  if (node.comfyClass === NodeID) {
    const n = node.prototype;
    const originalonAdded = n.onAdded;
    n.onAdded = function () {
      originalonAdded?.call(this);
      thisNode.push(node);
      this.onRemoved = () => thisNode.splice(thisNode.indexOf(node), 1);
      styleIt(this);
    };
  }
});
