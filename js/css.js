function appendCSS() {
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "/ps/bluepixel/css.css";
  document.head.appendChild(link);
}
appendCSS();
