export const SIZE=5;
export const DIFFICULTY_RULES=Object.freeze({beginner:{preventDeadEnd:true},intermediate:{preventDeadEnd:false},advanced:{preventDeadEnd:false}});
export function difficultyRules(stage){const rules=DIFFICULTY_RULES[stage.difficulty||'intermediate'];if(!rules)throw new Error('難易度設定が不正です');return {...rules,preventDeadEnd:stage.deadEndWarning??rules.preventDeadEnd};}
export const gridSize=stage=>stage.gridSize||stage.size||SIZE;
export function canSelectStage(stages,index,completed,unlockMode='all'){return index>=0&&index<stages.length&&(unlockMode==='all'||index===0||completed.has(stages[index-1].id));}
export function initialState(stage){return {board:[...stage.initialBoard],used:{},completed:[]};}
const indexes=new WeakMap();
export function dictionaryIndex(dictionary){
 if(indexes.has(dictionary))return indexes.get(dictionary);
 const index={first:new Map(),length:new Map(),level:new Map(),terms:[]};
 for(const [termId,t]of Object.entries(dictionary)){const letters=Array.from(t.word),needs={};letters.forEach(c=>needs[c]=(needs[c]||0)+1);const item={termId,letters,needs,length:letters.length};index.terms.push(item);for(const [map,key]of [[index.first,letters[0]],[index.length,letters.length],[index.level,t.level]]){if(!map.has(key))map.set(key,[]);map.get(key).push(item);}}
 indexes.set(dictionary,index);return index;
}
export function matches(state,stage,dictionary){
 const n=gridSize(stage),allowed=new Map(stage.allowedTerms.map(t=>[t.termId,t.maxUses])),found=[];
 for(let start=0;start<state.board.length;start++)for(const item of dictionaryIndex(dictionary).first.get(state.board[start])||[]){
  if(!allowed.has(item.termId)||(state.used[item.termId]||0)>=allowed.get(item.termId))continue;
  for(const direction of ['horizontal','vertical']){if(direction==='horizontal'?start%n+item.length>n:Math.floor(start/n)+item.length>n)continue;const cells=item.letters.map((_,i)=>start+i*(direction==='horizontal'?1:n));if(cells.every((c,i)=>state.board[c]===item.letters[i]))found.push({termId:item.termId,cells,direction});}
 }
 return found.sort((a,b)=>b.cells.length-a.cells.length||a.cells[0]-b.cells[0]||a.direction.localeCompare(b.direction));
}
export function swap(state,from,to){if(![from,to].every(i=>Number.isInteger(i)&&i>=0&&i<state.board.length))throw new Error('交換位置が不正です');if(from===to||state.board[from]===state.board[to])return state;const next=structuredClone(state);[next.board[from],next.board[to]]=[next.board[to],next.board[from]];return next;}
// Reserve one assembly location per remaining selected word. Prefer the most
// advanced prefix; a separate occurrence remains eligible for normal erasure.
export function pendingPrefixes(state,stage,dictionary,found){
 const n=gridSize(stage),held=new Set(),counts={};state.board.filter(Boolean).forEach(c=>counts[c]=(counts[c]||0)+1);
 for(const id of stage.correctTerms||[]){if(state.used[id])continue;const letters=Array.from(dictionary[id].word),need={};letters.forEach(c=>need[c]=(need[c]||0)+1);if(!Object.entries(need).every(([c,k])=>(counts[c]||0)>=k))continue;
  const candidates=found.filter(m=>m.cells.length<=letters.length&&dictionary[id].word.startsWith(dictionary[m.termId].word)).map(m=>{const start=m.cells[0],step=m.direction==='horizontal'?1:n;if(m.direction==='horizontal'?start%n+letters.length>n:Math.floor(start/n)+letters.length>n)return null;let progress=0;while(progress<letters.length&&state.board[start+progress*step]===letters[progress])progress++;return {start,direction:m.direction,progress};}).filter(Boolean).sort((a,b)=>b.progress-a.progress||a.start-b.start||a.direction.localeCompare(b.direction));
  const anchor=candidates[0];if(!anchor)continue;
  for(const m of found)if(m.cells[0]===anchor.start&&m.direction===anchor.direction&&m.cells.length<letters.length&&dictionary[id].word.startsWith(dictionary[m.termId].word))held.add(m);
 }return held;
}
export function resolveSwap(state,stage,dictionary,from,to){
 const exchanged=swap(state,from,to);if(exchanged===state)return {state,changed:false,cleared:[],exchangedBoard:state.board};
 const next=structuredClone(exchanged),cleared=[],limits=new Map(stage.allowedTerms.map(t=>[t.termId,t.maxUses]));
 const found=matches(exchanged,stage,dictionary),held=pendingPrefixes(exchanged,stage,dictionary,found);
 for(const m of found){if(held.has(m))continue;if(cleared.some(long=>long.cells.length>m.cells.length&&m.cells.every(i=>long.cells.includes(i))))continue;if((next.used[m.termId]||0)>=limits.get(m.termId))continue;next.used[m.termId]=(next.used[m.termId]||0)+1;next.completed.push(m.termId);cleared.push(m);}
 for(const m of cleared)for(const i of m.cells)next.board[i]=null;return {state:next,changed:true,cleared,exchangedBoard:exchanged.board};
}
export function isClear(state){return state.board.every(c=>c===null);}
export class Game{
 constructor(stage,dictionary){this.stage=stage;this.dictionary=dictionary;this.reset();}
 reset(){this.state=initialState(this.stage);this.history=[];}
 move(from,to){const r=resolveSwap(this.state,this.stage,this.dictionary,from,to);if(r.cleared.length&&difficultyRules(this.stage).preventDeadEnd&&solveRemaining(r.state,this.stage,this.dictionary)===null)return {state:this.state,changed:false,blocked:true,cleared:[],attemptedClears:r.cleared,exchangedBoard:this.state.board};if(r.changed){this.history.push(this.state);this.state=r.state;}return {...r,blocked:false};}
 undo(){if(!this.history.length)return false;this.state=this.history.pop();return true;}
}
const solutionCaches=new WeakMap();
export function solveRemaining(state,stage,dictionary){
 const counts={};state.board.filter(Boolean).forEach(c=>counts[c]=(counts[c]||0)+1);
 const scope=stage.solverScope==='dictionary'?stage.allowedTerms:stage.allowedTerms.filter(t=>!stage.correctTerms||stage.correctTerms.includes(t.termId));
 const all=new Map(dictionaryIndex(dictionary).terms.map(t=>[t.termId,t]));
 const terms=scope.map(t=>({...all.get(t.termId),cap:t.maxUses-(state.used[t.termId]||0)})).filter(t=>t.cap>0&&Object.entries(t.needs).every(([c,n])=>(counts[c]||0)>=n));
 let cache=solutionCaches.get(stage);if(!cache||cache.dictionary!==dictionary){cache={dictionary,memo:new Map()};solutionCaches.set(stage,cache);}if(cache.memo.size>10000)cache.memo.clear();
 const letters=Object.keys(counts).sort(),caps=terms.map(t=>t.cap);
 function search(remaining,capacities,total){
  if(total===0)return [];
  const key=letters.map(c=>c+':'+(remaining[c]||0)).join(',')+'|'+terms.map((t,i)=>t.termId+':'+capacities[i]).join(',');if(cache.memo.has(key))return cache.memo.get(key);
  const possible=[];for(let i=0;i<terms.length;i++)if(capacities[i]>0&&terms[i].length<=total&&Object.entries(terms[i].needs).every(([c,n])=>(remaining[c]||0)>=n))possible.push(i);
  let options=null;for(const c of letters)if(remaining[c]>0){const candidates=possible.filter(i=>terms[i].needs[c]);if(!candidates.length){cache.memo.set(key,null);return null;}if(!options||candidates.length<options.length)options=candidates;}
  for(const i of options||[]){const next={...remaining};for(const [c,n]of Object.entries(terms[i].needs))next[c]-=n;const nextCaps=[...capacities];nextCaps[i]--;const rest=search(next,nextCaps,total-terms[i].length);if(rest!==null){const result=[terms[i].termId,...rest];cache.memo.set(key,result);return result;}}
  cache.memo.set(key,null);return null;
 }
 return search(counts,caps,state.board.filter(Boolean).length);
}
export function validateStage(stage,dictionary){
 if(!stage||typeof stage.id!=='string'||!stage.id||typeof stage.name!=='string')throw new Error('ステージID・名前が不正です');difficultyRules(stage);const n=gridSize(stage);
 if(!Number.isInteger(n)||n<2||!Array.isArray(stage.initialBoard)||stage.initialBoard.length!==n*n||stage.initialBoard.some(c=>typeof c!=='string'||Array.from(c).length!==1||!/^\p{Script=Han}$/u.test(c)))throw new Error('初期盤面のサイズ・漢字が不正です');
 if(!Array.isArray(stage.allowedTerms)||!stage.allowedTerms.length)throw new Error('使用可能用語がありません');const ids=new Set();for(const t of stage.allowedTerms){const d=dictionary[t.termId];if(ids.has(t.termId)||!d||!/^\p{Script=Han}+$/u.test(d.word)||Array.from(d.word).length<2||Array.from(d.word).length>n||!d.description||!Number.isInteger(t.maxUses)||t.maxUses<1||t.maxUses>n*n)throw new Error('用語または使用上限が不正です');ids.add(t.termId);}
 if(stage.correctTerms&&(!Array.isArray(stage.correctTerms)||new Set(stage.correctTerms).size!==stage.correctTerms.length||stage.correctTerms.some(id=>!ids.has(id))))throw new Error('正解用語の設定が不正です');
 if(!Array.isArray(stage.solutionRoute)||!stage.solutionRoute.length)throw new Error('正解ルートがありません');const game=new Game(stage,dictionary);
 for(const a of stage.solutionRoute){if(a.type!=='swap')throw new Error('ルートの操作種別が不正です');const r=game.move(a.from,a.to);if(!r.changed)throw new Error('無効または手詰まりの交換です');if(a.cleared&&JSON.stringify(a.cleared)!==JSON.stringify(r.cleared.map(m=>({termId:m.termId,cells:m.cells}))))throw new Error('保存された消去結果が一致しません');}if(!isClear(game.state))throw new Error('正解ルートで全消しできません');return true;
}
