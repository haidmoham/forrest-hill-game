const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
// These DOM/audio/render doubles verify control flow, not real GPU or physical-device behavior.
const THREE = Object.fromEntries(['Clock','BoxGeometry','SphereGeometry','ConeGeometry','CylinderGeometry'].map(name=>[name,class {}]));
const source = fs.readFileSync(path.join(__dirname, '../src/battle.js'), 'utf8');

function game() {
  const elements = new Map(), listeners = new Map(), timers = new Map();
  let timerId = 0, paints = 0;
  const drawing = new Proxy({ createLinearGradient: () => ({addColorStop(){}}) }, {get:(o,k)=>o[k]??(()=>{if(k==='clearRect')paints++}),set:(o,k,v)=>(o[k]=v,true)});
  const document = {hidden:false, activeElement:null};
  function element(id) {
    if(elements.has(id))return elements.get(id);
    const classes = new Set();
    const e = {id,hidden:false,disabled:false,checked:false,style:{},dataset:{},children:[],textContent:'',innerHTML:'',scrollTop:99,
      classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x),toggle:(x,v)=>v?classes.add(x):classes.delete(x)},
      setAttribute(k,v){this[k]=v}, getAttribute(k){return this[k]}, focus(){document.activeElement=this}, matches(s){return s==='button' && id!=='body'},
      replaceChildren(...children){this.children=children}, appendChild(child){this.children.push(child)},
      getBoundingClientRect:()=>({width:800,height:400}), getContext:()=>drawing,
      querySelector:()=>element(id+'-span'), querySelectorAll:()=>[], closest:()=>null, click(){this.onclick?.()}, setPointerCapture(){}, offsetWidth:800};
    elements.set(id,e);return e;
  }
  const directions=['w','a','s','d'].map(d=>{const e=element('direction-'+d);e.dataset.direction=d;return e});
  document.getElementById=element;document.body=element('body');document.activeElement=document.body;
  document.querySelector=s=>s.startsWith('#')?element(s.slice(1)):element(s);
  document.querySelectorAll=s=>s==='[data-direction]'?directions:s==='header, main, footer'?['header','main','footer'].map(element):[];
  document.createElement=tag=>element(tag+'-'+Math.random());
  document.addEventListener=(name,fn)=>listeners.set(name,[...(listeners.get(name)||[]),fn]);
  element('battle').parentElement=element('.arena');element('roster').hidden=true;
  const sandbox={THREE,document,window:{},devicePixelRatio:1,matchMedia:()=>({matches:false}),requestAnimationFrame(){},console:{warn(){},log(){}},
    addEventListener:document.addEventListener, setTimeout:fn=>{timers.set(++timerId,fn);return timerId},clearTimeout:id=>timers.delete(id)};
  const ctx=vm.createContext(sandbox);
  vm.runInContext(source.replace(/^import[^\n]*\n/,'').replace("init();reset();resize();frame();openRoster();$('boot-note').hidden=true;",''),ctx);
  const run=s=>vm.runInContext(s,ctx);run('reset()');
  return {run,element,document,timers,directions,listeners,sandbox,paints:()=>paints};
}

test('resizing a paused fallback repaints without advancing combat',()=>{const g=game();g.run('state.paused=true;state.age=12;resize()');assert.equal(g.paints(),1);assert.equal(g.run('state.age'),12);assert.equal(g.run('state.paused'),true)});
test('resizing WebGL redraws without advancing combat',()=>{const g=game();g.run('renderer={setSize(){},render(){this.draws=(this.draws||0)+1}};camera={updateProjectionMatrix(){}};scene={};state.paused=true;resize()');assert.equal(g.run('renderer.draws'),1);assert.equal(g.run('camera.aspect'),2)});
test('new splash replaces its previous timer',()=>{const g=game();g.run("splash('FIRST')");const first=[...g.timers.keys()][0];g.run("splash('SECOND')");assert.equal(g.timers.has(first),false);assert.equal(g.timers.size,1);assert.equal(g.element('battle-splash-span').textContent,'SECOND')});
test('rematch cancels pending splash and confetti work',()=>{const g=game();g.run('celebrate();reset()');assert.equal(g.timers.size,0);assert.equal(g.element('confetti').children.length,0);assert.equal(g.element('battle-splash').classList.contains('on'),false)});
test('missing audio support cannot prevent an attack',()=>{const g=game();g.run("soundOn=true;move('water')");assert.equal(g.run('state.phase'),'attack');assert.equal(g.run('soundOn'),false);assert.equal(g.element('sound')['aria-pressed'],'false')});
test('audio constructor failure cannot prevent an attack',()=>{const g=game();g.sandbox.window.AudioContext=function(){throw new Error('unavailable')};g.run("soundOn=true;move('water')");assert.equal(g.run('state.phase'),'attack');assert.equal(g.run('soundOn'),false)});
test('audio resume rejection is handled',async()=>{const g=game();g.sandbox.window.AudioContext=function(){return {currentTime:0,destination:{},resume:()=>Promise.reject(new Error('blocked')),createOscillator:()=>({frequency:{},connect(){},start(){},stop(){}}),createGain:()=>({gain:{setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){}})}};g.run("soundOn=true;move('water')");await new Promise(resolve=>setImmediate(resolve));assert.equal(g.run('state.phase'),'attack');assert.equal(g.run('soundOn'),false)});
test('picker reopens with hero selection and restores exact opener',()=>{const g=game();g.document.activeElement=g.element('combat-mode');g.run("pickSide='enemy';openRoster()");assert.equal(g.run('pickSide'),'hero');assert.equal(g.document.activeElement.id,'pick-hero');g.run('closeRoster()');assert.equal(g.document.activeElement.id,'combat-mode')});
test('Back discards setup and preserves paused fight',()=>{const g=game();g.run("state.paused=true;state.hp=77;openRoster();chosenHero='princess';chosenTeams=true;chosenRealtime=false;closeRoster()");assert.equal(g.run('state.hero'),'greninja');assert.equal(g.run('state.hp'),77);assert.equal(g.run('state.paused'),true);assert.equal(g.run('teamsEnabled'),false);assert.equal(g.run('realtime'),true)});
test('mirror match picker labels both sides',()=>{const g=game();g.run("chosenHero='greninja';chosenEnemy='greninja';drawRoster()");assert.match(g.element('roster-grid').innerHTML,/1P \+ CPU/)});
test('movement buttons support keyboard hold, release, and blur',()=>{const g=game(),b=g.directions[0],event={key:' ',preventDefault(){}};b.onkeydown(event);assert.equal(g.run("directionHeld('w')"),true);b.onkeyup(event);assert.equal(g.run("directionHeld('w')"),false);b.onkeydown(event);b.onblur();assert.equal(g.run("directionHeld('w')"),false);g.run('state.paused=true');b.onkeydown(event);assert.equal(g.run("directionHeld('w')"),false)});
test('final result has no extra promotional panel',()=>{const g=game();g.run("state.phase='won';state.enemyReserve=null;ui()");assert.equal(g.run('state.phase'),'won');assert.equal(source.includes("$('end-note')"),false)});
test('rematch preserves configured starters and reserves',()=>{const g=game();g.run("teamsEnabled=true;heroReserveChoice='eevee';enemyReserveChoice='venusaur';reset('thermal','princess');state.hero='eevee';state.enemy='venusaur';state.heroReserve=null;state.enemyReserve=null;reset()");assert.equal(g.run('state.hero'),'princess');assert.equal(g.run('state.enemy'),'thermal');assert.equal(g.run('state.heroReserve'),'eevee');assert.equal(g.run('state.enemyReserve'),'venusaur')});
test('fallback fighter names stay in separate label columns',()=>{assert.match(source,/c\.fillText\(names\[kind\],w\*\(side===-1\?\.25:\.75\),h\*\.9,w\*\.43\)/)});
test('only quiet creator links remain, without contact or sales prompts',()=>{const html=fs.readFileSync(path.join(__dirname,'../src/battle.html'),'utf8');const links=[...html.matchAll(/<a ([^>]+)>/g)];assert.equal(links.length,2);for(const [,attrs] of links){assert.match(attrs,/href="https:\/\/mhaider\.dev\/(?:contact\.html)?"/);assert.match(attrs,/rel="noopener noreferrer"/);assert.match(attrs,/opens in a new tab/)}assert.match(source,/querySelectorAll\('button,select,input,a\[href\]'\)/);assert.equal(html.includes('contact.html'),false);assert.equal(html.includes('parent-links'),false);assert.equal(html.includes('end-note'),false);assert.equal(html.includes('FOR PARENTS'),false);assert.equal([...html.matchAll(/>Mohammad Haider<\/a>/g)].length,2)});

// Compile the produced offline script: replacement-string $& expansion once corrupted this artifact.
test('online and offline builds contain the same executable bundle',()=>{
  require('node:child_process').execFileSync(process.execPath,[path.join(__dirname,'../scripts/build.js')]);
  const html=fs.readFileSync(path.join(__dirname,'../public/forrest-hill-game-offline.html'),'utf8');
  assert.equal(html.includes('src="battle.js"'),false);
  const inline=html.match(/<script>([\s\S]*)<\/script>/)[1];
  const bundle=fs.readFileSync(path.join(__dirname,'../public/battle.js'),'utf8');
  assert.equal(inline,bundle.replace(/<\/script/gi,'<\\/script'));
  assert.doesNotThrow(()=>new vm.Script(inline));
});
