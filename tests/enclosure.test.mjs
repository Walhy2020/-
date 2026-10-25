import test from "node:test";
import assert from "node:assert/strict";
import { circleInsidePolygon, findEnclosure } from "../src/enclosure.js";
import { VirusField, nextTarget } from "../src/world.js";

function circlePath(radius, arc = Math.PI * 2, sign = 1) {
  return Array.from({length:241}, (_,i) => ({x:Math.cos(arc*i/240)*radius, y:Math.sin(arc*i/240*sign)*radius}));
}
const boss = {id:"boss",x:0,y:0,radius:72};
const settings = {bodyLength:1000,bodyRadius:26,closureGap:32};

test("the visible body captures a wholly enclosed giant in either turning direction", () => {
  for (const sign of [-1,1]) {
    const result = findEnclosure(circlePath(140, Math.PI*2, sign), settings, [boss]);
    assert.deepEqual(result?.enclosed.map(item=>item.id), ["boss"]);
  }
});

test("a direct touch, an open arc, or a virus only partially inside never captures", () => {
  assert.equal(findEnclosure([{x:0,y:0},{x:100,y:0},{x:200,y:0}], settings, [boss]), null);
  assert.equal(findEnclosure(circlePath(140, Math.PI*1.6), settings, [boss]), null);
  assert.equal(findEnclosure(circlePath(80), settings, [boss]), null);
  assert.equal(findEnclosure(circlePath(140), settings, [{...boss,x:110}]), null);
});

test("history behind the visible tail cannot complete a capture", () => {
  assert.equal(findEnclosure(circlePath(140), {...settings,bodyLength:500}, [boss]), null);
  assert.equal(findEnclosure(circlePath(140), {...settings,bodyLength:178}, [boss]), null);
});

test("a nearly joined head and body can close a loop but a wide gap cannot", () => {
  assert.ok(findEnclosure(circlePath(140, Math.PI*2-0.1), settings, [boss]));
  assert.equal(findEnclosure(circlePath(140, Math.PI*2-0.5), settings, [boss]), null);
});

test("noncircular loops can enclose multiple whole viruses without rewarding outside ones", () => {
  const polygon = [{x:-220,y:-180},{x:220,y:-180},{x:220,y:180},{x:-220,y:180},{x:-220,y:-180}];
  const circles = [{...boss,id:'a',x:-90}, {...boss,id:'b',x:90}, {...boss,id:'outside',x:300}];
  const result = findEnclosure(polygon, {...settings,bodyLength:1700}, circles);
  assert.deepEqual(result?.enclosed.map(item=>item.id), ['a','b']);
  assert.equal(circleInsidePolygon({...boss,x:220},polygon),false);
});

test("the only character target stays separate from super viruses, which remain consumed nearby", () => {
  const field = new VirusField({seed:12345});
  field.sync({x:0,y:0});
  const bosses = field.nearby().filter(item=>item.tier==='super');
  assert.ok(bosses.length>0);
  for (let index=0;index<24;index++) {
    const target = nextTarget({x:0,y:0},index, index,'山',bosses);
    assert.ok(bosses.every(b=>Math.hypot(b.x-target.x,b.y-target.y)>=217));
  }
  const id = bosses[0].id;
  field.consume(id);
  field.sync({x:0,y:0});
  assert.ok(!field.nearby().some(item=>item.id===id));
});
