import { samplePath } from "./trail.js";

const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function closestOnSegment(point, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const fraction = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
  return { x: a.x + dx * fraction, y: a.y + dy * fraction };
}

export function pointInPolygon(point, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    if ((a.y > point.y) !== (b.y > point.y)
      && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

export function circleInsidePolygon(circle, polygon, clearance = 0) {
  if (!pointInPolygon(circle, polygon)) return false;
  for (let i = 0; i < polygon.length; i++) {
    if (distance(circle, closestOnSegment(circle, polygon[i], polygon[(i + 1) % polygon.length])) < circle.radius + clearance) return false;
  }
  return true;
}

/** Only the currently visible body can close a loop; discarded history cannot. */
export function findEnclosure(history, { bodyLength, bodyRadius, closureGap }, circles) {
  if (history.length < 3 || !circles.length || bodyLength <= 0) return null;
  const possible = circles.filter(circle => bodyLength + closureGap >= 2 * Math.PI * (circle.radius + bodyRadius));
  if (!possible.length) return null;
  const step = Math.max(6, bodyLength / 1600);
  const offsets = [];
  for (let offset = 0; offset < bodyLength; offset += step) offsets.push(offset);
  offsets.push(bodyLength);
  const path = samplePath(history, offsets), head = path[0];
  // Exclude the neck and very recent movement, which always touch the head.
  const minimumArc = Math.max(120, closureGap * 4, bodyRadius * 4);
  for (let index = Math.max(2, Math.ceil(minimumArc / step)); index < path.length - 1; index++) {
    const closure = closestOnSegment(head, path[index], path[index + 1]);
    if (distance(head, closure) > Math.min(closureGap, bodyRadius * 2)) continue;
    const polygon = [...path.slice(0, index + 1), closure];
    const enclosed = possible.filter(circle => circleInsidePolygon(circle, polygon, bodyRadius));
    if (enclosed.length) return { polygon, enclosed };
  }
  return null;
}
