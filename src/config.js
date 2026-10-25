export const CONFIG_KEY = "flystar.movement.v1";
export const CONFIG_FIELDS = Object.freeze([
  { key: "mapSize", group: "地图", label: "地图边长", min: 3200, max: 25600, step: 400, integer: true, value: 12800, unit: "单位", help: "方形地图的宽和高；调整后立即生效，并自动保存在本机。" },
  { key: "speed", group: "移动与转向", label: "前进速度", min: 0, max: 600, step: 1, value: 201, unit: "单位/秒", help: "0 可以停在原地观察转向。" },
  { key: "turnSpeed", group: "移动与转向", label: "最大转向速度", min: 30, max: 1440, step: 10, value: 1000, unit: "度/秒", help: "转向速度上限，同时受最小转弯半径限制。" },
  { key: "turnRadius", group: "移动与转向", label: "最小转弯半径", min: 0, max: 160, step: 1, value: 20, unit: "单位", help: "越大弯道越圆，但掉头需要更多空间；0 恢复很急的小弯。" },
  { key: "keyboardTurnSpeed", group: "移动与转向", label: "Q / E 连续转向速度", min: 30, max: 720, step: 5, value: 180, unit: "度/秒", help: "按住 Q 向左绕弯，E 向右绕弯；松开保持当前朝向。" },
  { key: "turnGain", group: "移动与转向", label: "方向对准速度", min: 1, max: 60, step: 0.5, value: 50, unit: "", help: "越大越快对准目标方向，减少快到位时的拖沓。" },
  { key: "turnResponse", group: "移动与转向", label: "转向响应", min: 1, max: 120, step: 1, value: 120, unit: "", help: "越大惯性越小，按键或反向拖动后更快响应。" },
  { key: "pointerDeadzone", group: "移动与转向", label: "拖动死区", min: 0, max: 80, step: 1, value: 6, unit: "单位", help: "指针距离头部多近时不再追逐，避免原地打转。" },
  { key: "gamepadDeadzone", group: "手柄", label: "摇杆死区", min: 0.05, max: 0.6, step: 0.01, value: 0.2, unit: "", help: "过滤摇杆漂移；越小越灵敏。左、右摇杆均可转向，左摇杆优先。" },
  { key: "cameraFollow", group: "镜头与显示", label: "镜头跟随速度", min: 1, max: 60, step: 1, value: 12, unit: "", help: "越大镜头越紧跟主角，越小越有拖尾感。" },
  { key: "zoom", group: "镜头与显示", label: "画面缩放", min: 0.4, max: 2, step: 0.05, value: 1, unit: "倍", help: "在当前屏幕自适应缩放的基础上放大或缩小。" },
  { key: "headSize", group: "镜头与显示", label: "头部宽度", min: 48, max: 240, step: 1, value: 128, unit: "单位", help: "调整小飞星的显示大小。" },
  { key: "headBank", group: "镜头与显示", label: "转弯倾斜幅度", min: 0, max: 15, step: 0.5, value: 4, unit: "度", help: "0 表示转弯时头部不倾斜。" },
  { key: "hover", group: "镜头与显示", label: "头部上下浮动", min: 0, max: 10, step: 0.5, value: 1.5, unit: "单位", help: "0 表示关闭上下浮动。" },
  { key: "spacing", group: "身体与模拟", label: "星星中心间距", min: 16, max: 200, step: 1, value: 16, unit: "单位", help: "越小身体越紧密，会立即调整已有队伍。" },
  { key: "leadGap", group: "身体与模拟", label: "头部与首节距离", min: 20, max: 260, step: 1, value: 50, unit: "单位", help: "调整头部和第一颗身体星星的距离。" },
  { key: "bodySize", group: "身体与模拟", label: "身体星星大小", min: 24, max: 160, step: 1, value: 74, unit: "单位", help: "与中心间距一起调整重叠程度。" },
  { key: "physicsHz", group: "身体与模拟", label: "移动更新频率", min: 30, max: 240, step: 1, value: 120, unit: "次/秒", help: "一般保持 120；每步距离等于前进速度除以此值。" },
  { key: "smallVirusValue", group: "病毒与成长", label: "小病毒成长值", min: 1, max: 100, step: 1, integer: true, value: 1, unit: "点", help: "吃到小病毒获得的成长点数。" },
  { key: "mediumVirusValue", group: "病毒与成长", label: "中病毒成长值", min: 1, max: 100, step: 1, integer: true, value: 3, unit: "点", help: "吃到中病毒获得的成长点数。" },
  { key: "largeVirusValue", group: "病毒与成长", label: "大病毒成长值", min: 1, max: 100, step: 1, integer: true, value: 5, unit: "点", help: "吃到大病毒获得的成长点数。" },
  { key: "superVirusValue", group: "病毒与成长", label: "超级病毒成长值", min: 1, max: 500, step: 1, integer: true, value: 30, unit: "点", help: "用身体围成闭环吞下超级病毒后获得；直接碰到无奖励。" },
  { key: "enclosureGap", group: "病毒与成长", label: "圈吃闭合容差", min: 8, max: 60, step: 1, value: 32, unit: "单位", help: "头部离自己身体多近时算闭环；还需要把整个超级病毒包在圈内。" },
  { key: "virusDriftSpeed", group: "病毒与成长", label: "病毒原地摆动速度", min: 0, max: 80, step: 1, value: 22, unit: "节奏", help: "病毒固定在原地，各自随机地轻轻转动；0 表示暂停摆动。" },
  { key: "growthPerSegment", group: "病毒与成长", label: "长一节所需成长值", min: 1, max: 200, step: 1, integer: true, value: 10, unit: "点", help: "满值长一节，余数保留；调低时，已有点数会按新门槛结算。" },
  { key: "virusSnakeCount", group: "病毒蛇", label: "病毒蛇数量", min: 0, max: 20, step: 1, integer: true, value: 5, unit: "条", help: "立即增减场上的病毒蛇；0 表示暂时关闭。下次打开会沿用保存的数量。" },
  { key: "virusSnakeSpeed", group: "病毒蛇", label: "病毒蛇移动速度", min: 0, max: 180, step: 1, value: 35, unit: "单位/秒", help: "缓慢游走并寻找普通病毒；0 表示停止移动，暂停游戏也会一起停住。" },
  { key: "damageCooldown", group: "碰撞与受伤", label: "连续受伤间隔", min: 0.25, max: 3, step: 0.05, value: 1, unit: "秒", help: "持续顶住边界或碰到危险怪物时，每隔这段时间再掉两节尾巴。" },
]);
export const DEFAULT_CONFIG = Object.freeze(Object.fromEntries(CONFIG_FIELDS.map((field) => [field.key, field.value])));
export const PRESETS = Object.freeze({
  responsive: { label: "灵敏", values: { speed: 136, turnSpeed: 600, turnRadius: 24, keyboardTurnSpeed: 240, turnGain: 20, turnResponse: 40, cameraFollow: 12, pointerDeadzone: 6 } },
  smooth: { label: "顺滑", values: { speed: 136, turnSpeed: 600, turnRadius: 48, keyboardTurnSpeed: 180, turnGain: 20, turnResponse: 40, cameraFollow: 12, pointerDeadzone: 6 } },
  previous: { label: "旧版对照", values: { speed: 136, turnSpeed: 2.15 * 180 / Math.PI, turnRadius: 0, keyboardTurnSpeed: 180, turnGain: 4.6, turnResponse: 10, cameraFollow: 4, pointerDeadzone: 12 } },
});

export function normalizeConfig(patch, base = DEFAULT_CONFIG) {
  const source = patch && typeof patch === "object" && !Array.isArray(patch) ? patch : {};
  return Object.fromEntries(CONFIG_FIELDS.map(({ key, min, max, integer }) => {
    const value = typeof source[key] === "number" && Number.isFinite(source[key]) ? source[key] : base[key] ?? DEFAULT_CONFIG[key];
    return [key, Math.max(min, Math.min(max, integer ? Math.round(value) : value))];
  }));
}

export function loadConfig(storage) {
  try { return normalizeConfig(JSON.parse(storage.getItem(CONFIG_KEY))); }
  catch { return { ...DEFAULT_CONFIG }; }
}

export function saveConfig(storage, values) {
  try { storage.setItem(CONFIG_KEY, JSON.stringify(normalizeConfig(values))); return true; }
  catch { return false; }
}
