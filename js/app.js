import {Game,isClear,validateStage,canSelectStage} from './engine.js';
import {MODES,createDictionary,remainingHint} from './generator.js';
const $=id=>document.getElementById(id);
let game,dictionary,stages,selected=null,drag=null,busy=false,version=0;
let unlockMode='all',screen='selection';const completedStages=new Set();
let lastHint=null;let fallbacks=[];const previousProblems=new Map();
function node(tag,className,text){const el=document.createElement(tag);if(className)el.className=className;if(text!==undefined)el.textContent=text;return el;}
const position=i=>{const n=game?.stage.gridSize||5;return `${Math.floor(i/n)+1}行${i%n+1}列`;};
function cancelDrag(){drag?.ghost?.remove();drag=null;document.querySelectorAll('.dragging,.hovered').forEach(t=>t.classList.remove('dragging','hovered'));}
function fallbackProblem(id){const previous=previousProblems.get(id);return structuredClone(fallbacks.find(s=>s.id===id&&s.setHash!==previous?.hash));}
function requestProblem(id){return new Promise(resolve=>{
  let worker,timer;const finish=stage=>{clearTimeout(timer);worker?.terminate();resolve(stage);};
  try{worker=new Worker(new URL('./generation-worker.js',import.meta.url),{type:'module'});timer=setTimeout(()=>finish(fallbackProblem(id)),5000);
    worker.onmessage=e=>finish(e.data.stage||fallbackProblem(id));worker.onerror=()=>finish(fallbackProblem(id));
    const previous=previousProblems.get(id);worker.postMessage({token:version,mode:id,dictionary,options:{previousHash:previous?.hash,previousBoard:previous?.board,fallbacks}});
  }catch{finish(fallbackProblem(id));}
});}
async function chooseStage(id){const index=stages.findIndex(s=>s.id===id);if(busy||!canSelectStage(stages,index,completedStages,unlockMode))return;version++;cancelDrag();busy=true;selected=null;$('generation-status').textContent='問題を準備しています…';document.querySelectorAll('.stage-button,.clear-controls button').forEach(b=>b.disabled=true);if(game)renderBoard();
  const stage=await requestProblem(id);game=new Game(stage,dictionary);lastHint=null;previousProblems.set(id,{hash:stage.setHash,board:JSON.stringify(stage.initialBoard)});busy=false;screen='play';$('generation-status').textContent='';$('hint-message').textContent='';document.querySelectorAll('.clear-controls button').forEach(b=>b.disabled=false);$('stage-name').textContent=stage.name;render();
}
function showSelection(){if(busy)return;version++;cancelDrag();selected=null;screen='selection';delete document.body.dataset.difficulty;$('play-screen').hidden=true;$('clear-screen').hidden=true;$('selection-screen').hidden=false;
  $('stage-buttons').replaceChildren(...stages.map((stage,index)=>{const button=node('button','stage-button');button.append(node('strong','',stage.name),node('small','',stage.subtitle));button.dataset.difficulty=({5:'beginner',6:'intermediate',7:'advanced'})[stage.gridSize];button.type='button';button.disabled=!canSelectStage(stages,index,completedStages,unlockMode);button.addEventListener('click',()=>chooseStage(stage.id));return button;}));window.scrollTo(0,0);$('selection-title').focus({preventScroll:true});
}
function renderBoard(board=game.state.board){
  const n=game.stage.gridSize||5;document.body.dataset.difficulty=game.stage.difficulty;$('play-screen').dataset.hint=MODES.find(m=>m.id===game.stage.id).hint;$('play-screen').dataset.gridSize=n;$('board').style.setProperty('--grid-size',n);$('board').setAttribute('aria-label',`${n}行${n}列の漢字盤面`);
  $('board').replaceChildren(...board.map((c,i)=>{const tile=node('button',`tile${c?'':' empty'}${selected===i?' selected':''}`);tile.append(node('span','',c||''));tile.dataset.index=i;tile.type='button';tile.disabled=busy;tile.setAttribute('aria-label',`${position(i)}、${c||'空白'}`);tile.setAttribute('aria-pressed',String(selected===i));tile.addEventListener('pointerdown',e=>startDrag(e,i));tile.addEventListener('click',e=>{if(e.detail===0)tap(i);});return tile;}));
  $('board').setAttribute('aria-busy',String(busy));$('undo').disabled=busy||!game.history.length;$('reset').disabled=busy;$('back-to-selection').disabled=busy;
  $('new-problem').disabled=busy;$('hint').disabled=busy;$('hint').hidden=!MODES.find(m=>m.id===game.stage.id).hint;
}
function render(){
  const clear=isClear(game.state);$('play-screen').hidden=clear;$('clear-screen').hidden=!clear;renderBoard();
  $('selection-screen').hidden=true;screen=clear?'clear':'play';
  if(clear){
    completedStages.add(game.stage.id);$('next').hidden=stages.findIndex(s=>s.id===game.stage.id)===stages.length-1;
    $('clear-stage').textContent=game.stage.name;
    const counts=new Map(game.stage.correctTerms.map(id=>[id,1]));
    $('learned').replaceChildren(...[...counts].map(([id,count])=>{const t=dictionary[id],article=node('article','learned-word');article.append(node('h3','',t.word+(count>1?` × ${count}`:'')),node('span','reading',t.reading),node('p','',t.description));return article;}));

    $('status').textContent='ステージクリア！';$('clear-title').focus({preventScroll:true});window.scrollTo(0,0);
  }
}
async function exchange(from,to){
  if(busy||screen!=='play')return;selected=null;$('hint-message').textContent='';cancelDrag();const result=game.move(from,to);
  if(result.blocked){renderBoard();$('status').textContent='移動前の盤面に戻しました。';$('dead-end-warning').showModal();return;}
  if(!result.changed){renderBoard();return;}
  const currentVersion=version;
  if(result.cleared.length){
    busy=true;renderBoard(result.exchangedBoard);
    const cells=new Set(result.cleared.flatMap(m=>m.cells));for(const i of cells)$('board').children[i].classList.add('clearing');
    $('status').textContent='用語が完成しました。';await new Promise(resolve=>setTimeout(resolve,650));
    if(currentVersion!==version)return;busy=false;
  }
  render();if(!isClear(game.state))$('status').textContent='交換しました。';
}
function tap(i){if(busy||!game||screen!=='play')return;if(selected===null){if(!game.state.board[i])return;selected=i;renderBoard();}else if(selected===i){selected=null;renderBoard();}else exchange(selected,i);}
function startDrag(e,i){if(e.button!==0||drag||busy||!game||screen!=='play')return;e.preventDefault();drag={from:i,x:e.clientX,y:e.clientY,pointerId:e.pointerId,moving:false,empty:!game.state.board[i]};}
 document.addEventListener('pointermove',e=>{
  if(!drag||drag.pointerId!==e.pointerId||drag.empty)return;
  if(!drag.moving&&Math.hypot(e.clientX-drag.x,e.clientY-drag.y)<8)return;e.preventDefault();
  if(!drag.moving){drag.moving=true;drag.ghost=node('div','drag-ghost',game.state.board[drag.from]);drag.ghost.setAttribute('aria-hidden','true');document.body.append(drag.ghost);$('board').children[drag.from].classList.add('dragging');}
  drag.ghost.style.left=`${e.clientX}px`;drag.ghost.style.top=`${e.clientY}px`;
  const target=document.elementFromPoint(e.clientX,e.clientY)?.closest('.tile');document.querySelectorAll('.hovered').forEach(t=>t.classList.remove('hovered'));target?.classList.add('hovered');
},{passive:false});
document.addEventListener('pointerup',e=>{
  if(!drag||drag.pointerId!==e.pointerId)return;
  const target=document.elementFromPoint(e.clientX,e.clientY)?.closest('.tile'),{from,moving}=drag,to=target?Number(target.dataset.index):null,token=version;cancelDrag();
  const apply=()=>{if(token!==version)return;if(moving){if(to!==null)exchange(from,to);}else if(to===from)tap(from);};
  if(e.pointerType==='touch')requestAnimationFrame(apply);else apply();
});
document.addEventListener('pointercancel',cancelDrag);window.addEventListener('blur',cancelDrag);
let controlTouch=null;
document.addEventListener('touchstart',e=>{const button=e.target.closest('button:not(.tile)'),t=e.touches[0];controlTouch=button&&e.touches.length===1?{button,x:t.clientX,y:t.clientY}:null;},{passive:true});
document.addEventListener('touchend',e=>{const start=controlTouch;controlTouch=null;if(!start||e.touches.length)return;const t=e.changedTouches[0],end=document.elementFromPoint(t.clientX,t.clientY)?.closest('button:not(.tile)');if(end===start.button&&Math.hypot(t.clientX-start.x,t.clientY-start.y)<10&&!end.disabled){e.preventDefault();end.click();}},{passive:false});
document.addEventListener('touchcancel',()=>{controlTouch=null;},{passive:true});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){cancelDrag();selected=null;if(game&&!busy)renderBoard();}});
function undo(){if(busy)return;version++;cancelDrag();game.undo();selected=null;$('hint-message').textContent='';render();$('status').textContent='一手戻しました。';}
function reset(){if(busy)return;version++;cancelDrag();game.reset();selected=null;$('hint-message').textContent='';render();$('status').textContent='初期配置に戻しました。';}
$('undo').addEventListener('click',undo);$('clear-undo').addEventListener('click',undo);$('reset').addEventListener('click',reset);$('replay').addEventListener('click',()=>chooseStage(game.stage.id));$('new-problem').addEventListener('click',()=>chooseStage(game.stage.id));
$('hint').addEventListener('click',()=>{if(busy)return;const word=remainingHint(game.state,game.stage,dictionary,Math.random,lastHint);lastHint=word;$('hint-message').textContent=word?`ヒント：『${word}』を作ってみよう`:'残りの文字から別の用語を探してみましょう。';});
$('back-to-selection').addEventListener('click',showSelection);$('clear-selection').addEventListener('click',showSelection);
$('next').addEventListener('click',()=>{const next=stages[stages.findIndex(s=>s.id===game.stage.id)+1];if(next)chooseStage(next.id);});
try{
  const responses=await Promise.all([fetch('./data/construction_terms_200.json'),fetch('./data/fallbacks.json')]);if(responses.some(r=>!r.ok))throw new Error('問題ファイルを取得できません');
  const data=await Promise.all(responses.map(r=>r.json()));dictionary=createDictionary(data[0]);fallbacks=data[1];for(const stage of fallbacks)validateStage(stage,dictionary);stages=MODES;showSelection();
}catch(error){$('error').hidden=false;$('error').textContent=`${error.message}。ローカルではHTTPサーバーで開いてください。`;console.error(error);}

