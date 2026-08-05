(function () {
  const scripts = document.querySelectorAll("script[data-product-id]");
  const currentScript = scripts[scripts.length - 1] || document.currentScript;
  if (!currentScript) return;

  const productId = currentScript.getAttribute("data-product-id");
  if (!productId) return;

  const targetContainer = currentScript.parentElement || document.body;

  // Create styled "View in 3D AR" button
  const btn = document.createElement("button");
  btn.type = "button";
  btn.style.cssText = `
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    color: #ffffff;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 14px;
    font-weight: 700;
    padding: 12px 20px;
    border-radius: 12px;
    border: none;
    cursor: pointer;
    box-shadow: 0 4px 14px rgba(16, 185, 129, 0.35);
    transition: all 0.2s ease-in-out;
  `;

  btn.innerHTML = `<span>📱</span> View in 3D AR (RoomAI)`;

  btn.onmouseover = function () {
    btn.style.transform = "scale(1.03)";
    btn.style.boxShadow = "0 6px 20px rgba(16, 185, 129, 0.5)";
  };
  btn.onmouseout = function () {
    btn.style.transform = "scale(1.0)";
    btn.style.boxShadow = "0 4px 14px rgba(16, 185, 129, 0.35)";
  };

  btn.onclick = function () {
    const host = currentScript.src ? new URL(currentScript.src).origin : "https://roomai.uz";
    const arUrl = `${host}/ar?place=${encodeURIComponent(productId)}`;
    window.open(arUrl, "_blank");
  };

  targetContainer.appendChild(btn);
})();
