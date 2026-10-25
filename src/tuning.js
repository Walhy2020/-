import { CONFIG_FIELDS, DEFAULT_CONFIG, PRESETS, normalizeConfig } from "./config.js";

export function setupTuning({ values, apply }) {
  const panel = document.getElementById("tuningPanel");
  const fields = document.getElementById("tuningFields");
  const toggle = document.getElementById("tuningToggle");
  const status = document.getElementById("tuningStatus");
  const json = document.getElementById("tuningJson");
  const controls = new Map();
  let current = { ...values };

  function sync(next, saved = true) {
    current = { ...next };
    for (const [key, { range, number }] of controls) {
      range.value = next[key];
      if (document.activeElement !== number) number.value = Number(next[key].toFixed(3));
    }
    if (document.activeElement !== json) json.value = JSON.stringify(next, null, 2);
    document.getElementById("tuningStep").textContent = `${(next.speed / next.physicsHz).toFixed(2)} 单位/步`;
    status.textContent = saved ? "即时生效 · 已保存在本机" : "即时生效 · 本次参数未能保存";
  }

  let currentGroup = "", groupDetails;
  for (const field of CONFIG_FIELDS) {
    if (field.group !== currentGroup) {
      currentGroup = field.group;
      groupDetails = document.createElement("details");
      groupDetails.className = "tuning-group";
      groupDetails.open = currentGroup === "地图";
      const summary = document.createElement("summary");
      const title = document.createElement("span");
      title.textContent = currentGroup;
      const count = document.createElement("span");
      count.className = "tuning-group-count";
      count.textContent = `${CONFIG_FIELDS.filter(item => item.group === currentGroup).length} 项`;
      summary.append(title, count);
      groupDetails.append(summary);
      fields.append(groupDetails);
      if (currentGroup === "移动与转向") {
        groupDetails.append(document.getElementById("tuningPresets"), document.querySelector(".tuning-meter"));
      }
    }
    const row = document.createElement("div");
    row.className = "tuning-row";
    const label = document.createElement("label");
    label.htmlFor = `tune-${field.key}`;
    label.textContent = field.label;
    const unit = document.createElement("span");
    unit.className = "tuning-unit";
    unit.textContent = field.unit;
    const number = document.createElement("input");
    number.type = "number";
    number.id = `tune-${field.key}`;
    number.inputMode = "decimal";
    number.setAttribute("aria-describedby", `help-${field.key}`);
    const range = document.createElement("input");
    range.type = "range";
    range.id = `tune-range-${field.key}`;
    range.setAttribute("aria-label", `${field.label}滑块`);
    for (const input of [number, range]) {
      input.min = field.min; input.max = field.max; input.step = field.step;
    }
    const help = document.createElement("p");
    help.id = `help-${field.key}`;
    help.textContent = field.help;
    row.append(label, number, unit, range, help);
    groupDetails.append(row);
    controls.set(field.key, { number, range });
    range.addEventListener("input", () => apply({ [field.key]: range.valueAsNumber }));
    number.addEventListener("input", () => {
      const value = number.valueAsNumber;
      // Let the user finish typing a number before clamping an out-of-range prefix.
      if (Number.isFinite(value) && value >= field.min && value <= field.max) apply({ [field.key]: value });
    });
    number.addEventListener("change", () => {
      apply({ [field.key]: number.valueAsNumber });
      number.value = Number(current[field.key].toFixed(3));
    });
  }

  const presets = document.getElementById("tuningPresets");
  for (const [key, preset] of Object.entries(PRESETS)) {
    const button = document.createElement("button");
    button.type = "button";
    button.id = `preset-${key}`;
    button.textContent = preset.label;
    button.addEventListener("click", () => apply(preset.values));
    presets.append(button);
  }
  function open(value) {
    panel.hidden = !value;
    toggle.setAttribute("aria-expanded", String(value));
  }
  toggle.addEventListener("click", () => open(panel.hidden));
  document.getElementById("tuningClose").addEventListener("click", () => { open(false); toggle.focus(); });
  document.getElementById("tuningReset").addEventListener("click", () => apply(DEFAULT_CONFIG));
  document.getElementById("tuningApplyJson").addEventListener("click", () => {
    try {
      const parsed = JSON.parse(json.value);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)
        || !CONFIG_FIELDS.some(({ key }) => Number.isFinite(parsed[key]))) throw new Error("invalid");
      apply(normalizeConfig(parsed, current));
      json.value = JSON.stringify(current, null, 2);
    } catch { status.textContent = "配置格式不正确，请使用下方示例中的数字字段。"; }
  });
  document.getElementById("tuningCopyJson").addEventListener("click", async () => {
    json.value = JSON.stringify(current, null, 2);
    try { await navigator.clipboard.writeText(json.value); status.textContent = "已复制参数，可粘贴保存或发给我。"; }
    catch { json.focus(); json.select(); status.textContent = "参数已选中，可按 Ctrl+C 复制。"; }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !panel.hidden) { open(false); toggle.focus(); }
  });
  open(new URLSearchParams(location.search).get("tuning") === "1");
  sync(values);
  return { sync };
}
