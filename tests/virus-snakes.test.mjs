import test from "node:test";
import assert from "node:assert/strict";
import { VirusSnakes } from "../src/virus-snakes.js";
import { VirusField, VIRUS_COLORS } from "../src/world.js";
import { DEFAULT_CONFIG, loadConfig, saveConfig } from "../src/config.js";

const player={x:0,y:0};
test("random virus placement varies density and location while each streamed region stays stable",()=>{
  const first=new VirusField({seed:12345}),same=new VirusField({seed:12345}),other=new VirusField({seed:67890});
  for(const field of [first,same,other])field.sync(player);
  assert.deepEqual(first.nearby(),same.nearby());
  assert.notDeepEqual(first.nearby(),other.nearby());
  assert.ok(new Set([...first.cells.values()].map(items=>items.length)).size>=3);
  const before=first.nearby();first.sync(player);
  assert.deepEqual(first.nearby(),before);
  const locations=before.filter(item=>item.tier!=='super').map(item=>((item.x%310)+310)%310);
  assert.ok(Math.min(...locations)<75&&Math.max(...locations)>245);
  first.reset(67890);first.sync(player);
  assert.deepEqual(first.nearby(),other.nearby());
});

test("all virus tiers mix four stable colors across the map",()=>{
  const found=new Map(["small","medium","large","super"].map(tier=>[tier,new Set()]));
  for(const seed of [12345,6789,22222]) {
    const field=new VirusField({seed});
    for(const point of [{x:0,y:0},{x:1500,y:1500},{x:-1500,y:1000}]) {
      field.sync(point,1200);
      for(const virus of field.nearby()) found.get(virus.tier).add(virus.color);
    }
  }
  for(const colors of found.values()) assert.deepEqual(colors,new Set(VIRUS_COLORS));
  const field=new VirusField({seed:12345});
  field.sync(player);
  const before=new Map(field.nearby().map(virus=>[virus.id,virus.color]));
  field.sync({x:4000,y:4000});field.sync(player);
  assert.ok(field.nearby().every(virus=>virus.color===before.get(virus.id)));
});

test("map viruses sway at individual rhythms without changing position",()=>{
  const field=new VirusField({seed:12345});field.sync(player);
  const before=new Map(field.nearby().map(virus=>[virus.id,{x:virus.x,y:virus.y}]));
  const sample=field.nearby().slice(0,2);
  assert.notEqual(sample[0].swayRate,sample[1].swayRate);
  const firstPose=field.pose(sample[0]);
  field.advance(1,22);
  assert.notDeepEqual(field.pose(sample[0]),firstPose);
  assert.ok(field.nearby().every(virus=>virus.x===before.get(virus.id).x&&virus.y===before.get(virus.id).y));
  const still=field.nearby().map(virus=>({id:virus.id,pose:field.pose(virus)}));
  field.advance(4,0);
  assert.deepEqual(field.nearby().map(virus=>({id:virus.id,pose:field.pose(virus)})),still);
  field.advance(1,44);
  assert.notDeepEqual(field.pose(sample[0]),firstPose);
  assert.ok(field.nearby().every(virus=>virus.x===before.get(virus.id).x&&virus.y===before.get(virus.id).y));
  const same=new VirusField({seed:12345});same.sync(player);same.advance(1,22);same.advance(1,44);
  assert.deepEqual(field.nearby().map(virus=>field.pose(virus)),same.nearby().map(virus=>same.pose(virus)));
});

test("defeated enemy becomes a cluster of consumable swaying viruses",()=>{
  const field=new VirusField({seed:6789});field.sync(player);
  const pile=field.spill({x:80,y:100},10);
  assert.ok(pile.length>=6&&pile.length<=10);
  assert.ok(pile.some(virus=>virus.tier==='large'));
  assert.ok(pile.every(virus=>Math.hypot(virus.x-80,virus.y-100)<100));
  assert.ok(pile.every(virus=>field.nearby().includes(virus)));
  const first=pile[0],before={x:first.x,y:first.y,pose:field.pose(first)};
  field.advance(1,22);
  assert.equal(first.x,before.x);assert.equal(first.y,before.y);
  assert.notDeepEqual(field.pose(first),before.pose);
  field.consume(first.id);
  assert.ok(!field.nearby().includes(first));
  field.sync({x:3000,y:3000});
  assert.ok(!field.nearby().some(virus=>virus.id===pile[1].id));
  field.sync(player);
  assert.ok(field.nearby().some(virus=>virus.id===pile[1].id));
});

test("configured speed changes actual travel immediately and zero speed freezes head and body",()=>{
  const swarm=new VirusSnakes({count:1});swarm.reset(player,12345);
  const initial=swarm.getState();
  swarm.advance(1,{speed:0,player});assert.deepEqual(swarm.getState(),initial);
  let moved=0;
  for(let index=0;index<120;index++) {
    const before=swarm.snakes[0].head;
    swarm.advance(1/120,{speed:35,player});
    const after=swarm.snakes[0].head;moved+=Math.hypot(after.x-before.x,after.y-before.y);
  }
  assert.ok(Math.abs(moved-35)<1e-7);
  const still=swarm.getState();swarm.advance(5,{speed:0,player});assert.deepEqual(swarm.getState(),still);
  const before=swarm.snakes[0].head;swarm.advance(0.1,{speed:70,player});
  assert.ok(Math.abs(Math.hypot(swarm.snakes[0].head.x-before.x,swarm.snakes[0].head.y-before.y)-7)<1e-7);
});

test("virus snake count changes immediately while keeping surviving snakes",()=>{
  const swarm=new VirusSnakes({count:2});swarm.reset(player,54321);
  const first=swarm.snakes[0];
  swarm.setCount(4,player);
  assert.equal(swarm.count,4);
  assert.deepEqual(swarm.snakes.map(snake=>snake.id),[0,1,2,3].map(index=>`virus-snake-${index}`));
  assert.equal(swarm.snakes[0],first);
  swarm.respawns.push({index:3,remaining:8});
  swarm.snakes=swarm.snakes.filter(snake=>snake.id!=="virus-snake-3");
  swarm.setCount(2,player);
  assert.deepEqual(swarm.snakes.map(snake=>snake.id),["virus-snake-0","virus-snake-1"]);
  assert.equal(swarm.respawns.length,0);
  swarm.setCount(0,player);
  assert.equal(swarm.snakes.length,0);
  swarm.setCount(3,player);
  assert.equal(swarm.snakes.length,3);
  swarm.reset(player,54321);
  assert.equal(swarm.snakes.length,3);
});

test("virus snakes eat ordinary viruses, grow after two meals, and leave super viruses alone",()=>{
  const swarm=new VirusSnakes({count:1});swarm.reset(player,54321);
  const snake=swarm.snakes[0],length=snake.trail.glyphs.length,consumed=[];
  for(let index=0;index<2;index++){
    const food={...snake.head,id:`food-${index}`,tier:'small'},boss={...snake.head,id:'boss',tier:'super'};
    const ids=swarm.advance(1/120,{speed:35,player,foods:[boss,food],consume:id=>consumed.push(id)});
    assert.deepEqual(ids,[food.id]);
  }
  assert.deepEqual(consumed,['food-0','food-1']);
  assert.equal(snake.trail.glyphs.length,length+1);
  assert.equal(snake.eaten,2);
  assert.ok(snake.trail.positions().every((point,index,points)=>!index||Math.hypot(point.x-points[index-1].x,point.y-points[index-1].y)>1));
});

test("roaming population stays bounded and follows exploration into distant map areas",()=>{
  const swarm=new VirusSnakes();swarm.reset(player,54321);
  swarm.advance(1/120,{speed:35,player:{x:4500,y:4500}});
  assert.equal(swarm.snakes.length,5);
  assert.ok(swarm.snakes.every(snake=>Math.hypot(snake.head.x-4500,snake.head.y-4500)<850));
});

test("an enemy head entering player body dies, then respawns after a delay",()=>{
  const swarm=new VirusSnakes({count:1});swarm.reset(player,333);
  const snake=swarm.snakes[0];
  snake.head={x:0,y:0};snake.previousHead={x:0,y:0};snake.angle=0;snake.desiredAngle=0;snake.decisionIn=10;
  snake.trail.reset([{x:0,y:0},{x:-500,y:0}]);
  const farHead={x:500,y:500},body=[{x:58,y:0}];
  assert.deepEqual(swarm.defeatOnBody(farHead,body),[]);
  swarm.advance(0.1,{speed:35,player:farHead,foods:[]});
  const dead=swarm.defeatOnBody(farHead,body);
  assert.equal(dead.length,1);
  assert.equal(dead[0].length,snake.trail.glyphs.length);
  assert.equal(swarm.snakes.length,0);
  assert.equal(swarm.defeated,1);
  swarm.advance(7,{speed:35,player:farHead});
  assert.equal(swarm.snakes.length,0);
  swarm.advance(1.1,{speed:35,player:farHead});
  assert.equal(swarm.snakes.length,1);
});

test("enemy head contact hurts player instead of killing the enemy",()=>{
  const swarm=new VirusSnakes({count:1});swarm.reset(player,333);
  const snake=swarm.snakes[0];
  snake.previousHead={x:snake.head.x-60,y:snake.head.y};
  assert.deepEqual(swarm.defeatOnBody({...snake.head},[{...snake.head}]),[]);
  assert.equal(swarm.snakes.length,1);
});

test("old configurations gain the slow default and custom virus snake speed persists",()=>{
  const data=new Map();const storage={getItem:key=>data.get(key),setItem:(key,value)=>data.set(key,value)};
  assert.equal(loadConfig(storage).virusSnakeSpeed,35);
  assert.equal(loadConfig(storage).virusSnakeCount,5);
  assert.equal(loadConfig(storage).virusDriftSpeed,22);
  saveConfig(storage,{...DEFAULT_CONFIG,virusSnakeSpeed:0});
  assert.equal(loadConfig(storage).virusSnakeSpeed,0);
  saveConfig(storage,{...DEFAULT_CONFIG,virusSnakeSpeed:70});
  assert.equal(loadConfig(storage).virusSnakeSpeed,70);
  saveConfig(storage,{...DEFAULT_CONFIG,virusSnakeCount:0});
  assert.equal(loadConfig(storage).virusSnakeCount,0);
  saveConfig(storage,{...DEFAULT_CONFIG,virusSnakeCount:30});
  assert.equal(loadConfig(storage).virusSnakeCount,20);
  saveConfig(storage,{...DEFAULT_CONFIG,virusDriftSpeed:0});
  assert.equal(loadConfig(storage).virusDriftSpeed,0);
});
