let socket = null;
let listeners = {};
const clinetid = generateClientId();
function connect() {
  if (!socket)
    try {
      socket = new WebSocket("ws://" + window.location.hostname + ":" + window.location.port + "/ps/ws?platform=cm&clientId=" + clinetid);

      socket.addEventListener("open", () => {
        console.log("🔹 Connected to the server.");
        sendQueuedMessages();
      });

      socket.addEventListener("message", (event) => {
        try {
          let message = JSON.parse(event.data);
          handleMessage(message);
        } catch (error) {
          console.error("🔹 Error parsing message:", error, event.data);
        }
      });

      socket.addEventListener("close", (event) => {
        console.warn("🔹 Connection closed. Reconnecting...", event);
        socket = null; // Reset socket to allow reconnection
        setTimeout(connect, 5000);
      });

      socket.addEventListener("error", (error) => {
        console.error("🔹 WebSocket error:", error);
        socket.close(); // Close the socket and trigger the reconnect logic
      });
    } catch (error) {
      console.error("🔹 Error establishing WebSocket connection:", error);
      setTimeout(connect, 5000);
    }
}

// Function to generate a unique client ID
function generateClientId() {
  return "cm-" + Math.random().toString(36).substr(2, 9);
}

function handleMessage(message) {
  for (let [type, callback] of Object.entries(listeners)) {
    if (message[type] !== undefined) {
      try {
        callback(message[type]);
      } catch (error) {
        console.error(`🔹 Error handling message of type ${type}:`, error);
      }
    }
  }
}

const messageQueue = [];

function sendQueuedMessages() {
  while (socket && socket.readyState === WebSocket.OPEN && messageQueue.length > 0) {
    const { type, data } = messageQueue.shift();
    socket.send(JSON.stringify({ [type]: data }));
  }
}

const lastSendTimes = {};
let timeoutIds = {};

async function sendMsg(type, data) {
  if (!data) data = true;

  // لغو تایم‌اوت قبلی برای این نوع پیام
  if (timeoutIds[type]) clearTimeout(timeoutIds[type]);

  // تنظیم تایم‌اوت جدید
  timeoutIds[type] = setTimeout(() => {
    try {
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ [type]: data }));
        lastSendTimes[type] = Date.now(); // به‌روزرسانی زمان آخرین ارسال
      } else {
        console.warn("🔹 WebSocket is not open. Queueing message:", type, data);
        messageQueue.push({ type, data });
      }
    } catch (error) {
      console.error("🔹 Error sending message:", error);
    }
  }, 500); // 1 ثانیه صبر کن
}

function msg(type, callback) {
  listeners[type] = callback;
}

// Export functions for external use
export { connect, sendMsg, msg, clinetid };
