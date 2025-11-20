import e from "./event.js";
import { clinetid } from "./connection.js";

const NodeID = "🔹SendTo Photoshop Plugin";
let thisNode = [];

const widgetChanges = (node) => {
  console.log('node', node)
  const uidWidget = node.widgets[0];
  if (uidWidget.value !== clinetid) uidWidget.value = clinetid;
  uidWidget.computeSize = () => [0, -LiteGraph.NODE_SLOT_HEIGHT - LiteGraph.NODE_WIDGET_HEIGHT - 8];
  uidWidget.disabled = true;
  uidWidget.type = "hidden";
  uidWidget.options.inputIsOptional = false;



}

const styleIt = (node) => {
  node.computeSize = () => [120, 120];
  node.size = [160, 160];
  widgetChanges(node);
};

e.on("beforeRegister", (node) => {
  if (node.comfyClass === NodeID) {
    const n = node.prototype;

    const originalonAdded = n.onAdded;
    n.onAdded = function () {
      originalonAdded?.call(this);
      thisNode.push(this);
      styleIt(this);
      this.onRemoved = () => thisNode.splice(thisNode.indexOf(this), 1);
    };
    n.constructor = {
      ...n.constructor,
      size: [100, 100],
    };
  }
});

e.on("afterWorkflowLoaded", () => thisNode.forEach(node => widgetChanges(node)));