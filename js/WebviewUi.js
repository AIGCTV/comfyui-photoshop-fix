const messageHandler = (e) => {
  if (e.data === "im uxp") {

    window.removeEventListener("message", messageHandler);

    const menu = document.querySelector(".comfyui-menu");
    if (menu) Array.from(menu.children).forEach((child) => (child.style.zoom = "0.8"));

    const otherSelectors = [".comfyui-body-left", ".p-panel", "span.p-buttongroup.p-component.p-buttongroup-vertical", ".bottom-panel"];
    otherSelectors.forEach((selector) => {
      const element = document.querySelector(selector);
      if (element) element.style.zoom = "0.8";
      else console.error(`Element not found for selector: ${selector}`);
    });

    const dropdownButton = document.querySelector(".p-splitbutton-dropdown");
    if (dropdownButton) {
      dropdownButton.remove();
    } else {
      console.error("Dropdown button not found");
    }

    const comfyuiLogo = document.querySelector(".comfyui-logo");
    if (comfyuiLogo) comfyuiLogo.remove();
    else console.error("کلاس comfyui-logo یافت نشد.");

    const menuRight = document.querySelector(".comfyui-menu-right");
    if (menuRight) {
      menuRight.remove();
    } else {
      console.error("کلاس comfyui-menu-right یافت نشد.");
    }
  }
};

window.addEventListener("message", messageHandler);
