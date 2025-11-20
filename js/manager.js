import { app as app } from "../../../scripts/app.js";
import { api as api } from "../../../scripts/api.js";
import { sendMsg, msg } from "./connection.js";
import e, { BluePixelExist } from "./event.js";

export const nodever = "1.0.3";

msg("alert", (data) => {
  try {
    alert(data);
  } catch (error) {
    console.error("🔹 Error in alert listener:", error);
  }
});

msg("queue", (data) => {
  try {
    if (!isProcessing) {
      if (BluePixelExist) {
        isProcessing = true;
        (function processQueue() {
          if (genrateStatus == "genrated") {
            app.queuePrompt();
            isProcessing = false;
          } else {
            setTimeout(processQueue, 100);
          }
        })();
      } else {
        console.log("🔹 Photoshop Node doesn't Exist");
      }
    }
  } catch (error) {
    console.error("🔹 Error in queue listener:", error);
  }
});

e.on("onProgressUpdate", (event) => {
  try {
    if (!this.connected) return;
    let prompt = event.detail.prompt;
    this.currentPromptExecution = prompt;
    if (prompt?.errorDetails) {
      let errorText = `${prompt.errorDetails?.exception_type} ${prompt.errorDetails?.node_id || ""} ${prompt.errorDetails?.node_type || ""}`;
      this.progressTextEl.innerText = errorText;
      this.progressNodesEl.classList.add("-error");
      this.progressStepsEl.classList.add("-error");
      return;
    }
  } catch (error) {
    console.error("🔹 Error in onProgressUpdate:", error);
  }
});

async function getWorkflow(name) {
  try {
    console.log("name: ", name);
    const response = await api.fetchApi(`/ps/workflows/${encodeURIComponent(name)}`, { cache: "no-store" });
    return await response.json();
  } catch (error) {
    console.error("🔹 Error in getWorkflow:", error);
  }
}

export async function loadWorkflow(workflowName) {
  const supportedLocales = ["ja-JP", "ko-KR", "zh-TW", "zh-CN"];
  let currentLocale = localStorage.getItem("AGL.Locale");

  if (!supportedLocales.includes(currentLocale)) {
    currentLocale = "en-US";
  }

  console.log("🔹 Load workflow for this language:", currentLocale);
  workflowName = workflowName + "_" + currentLocale;
  try {
    const workflowData = await getWorkflow(workflowName);
    app.loadGraphData(workflowData);
  } catch (error) {
    console.error(`Failed to load workflow ${workflowName}:`, error);
    alert(`Failed to load workflow ${workflowName}`);
  }
}

let genrateStatus = "genrated";
let isProcessing = false;

api.addEventListener("execution_start", ({ detail }) => {
  try {
    genrateStatus = "genrating";
    sendMsg("render_status", "genrating");
  } catch (error) {
    console.error("🔹 Error in execution_start listener:", error);
  }
});
api.addEventListener("executing", ({ detail }) => {
  try {
    if (!detail) {
      genrateStatus = "genrated";
      isProcessing = false;
      sendMsg("render_status", "genrated");
    }
  } catch (error) {
    console.error("🔹 Error in executing listener:", error);
  }
});
api.addEventListener("execution_error", ({ detail }) => {
  try {
    genrateStatus = "genrate_error";
    sendMsg("render_status", "genrate_error");
  } catch (error) {
    console.error("🔹 Error in execution_error listener:", error);
  }
});
api.addEventListener("progress", ({ detail: { value, max } }) => {
  try {
    let progress = Math.floor((value / max) * 100);
    if (!isNaN(progress) && progress >= 0 && progress <= 100) {
      sendMsg("progress", progress);
    }
  } catch (error) {
    console.error("🔹 Error in progress listener:", error);
  }
});

export function appendMenuOption(nodeType, callbackFn) {
  const originalMenuOptions = nodeType.prototype.getExtraMenuOptions;
  nodeType.prototype.getExtraMenuOptions = function () {
    const options = originalMenuOptions.apply(this, arguments);
    callbackFn.apply(this, arguments);
    return options;
  };
}
