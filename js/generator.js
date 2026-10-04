import {initialState,resolveSwap,matches,isClear,validateStage,dictionaryIndex,gridSize} from './engine.js';
const beginner={gridSize:5,cellCount:25,allowedLevels:['beginner1','beginner2'],allowedLengths:[2,3,4],deadEndWarning:true};
const intermediate={gridSize:6,cellCount:36,allowedLevels:['beginner1','beginner2','intermediate']};
const advanced={gridSize:7,cellCount:49,allowedLevels:['beginner1','beginner2','intermediate','advanced'],deadEndWarning:false};
export const MODES=[{...beginner,id:'beginner1',name:'初級1',subtitle:'2文字中心・ヒントあり',hint:true},{...beginner,id:'beginner2',name:'初級2',subtitle:'2～4文字・ヒントあり',hint:true},{...beginner,id:'beginner3',name:'初級3',subtitle:'2～4文字・ヒントなし',hint:false},
 {...intermediate,id:'intermediate1',name:'中級1',subtitle:'6×6・2～4文字・ヒントあり・手詰まり警告あり',allowedLengths:[2,3,4],hint:true,deadEndWarning:true},
 {...intermediate,id:'intermediate2',name:'中級2',subtitle:'6×6・2～5文字・ヒントあり・手詰まり警告なし',allowedLengths:[2,3,4,5],hint:true,deadEndWarning:false},
 {...intermediate,id:'intermediate3',name:'中級3',subtitle:'6×6・2～5文字・ヒントなし・手詰まり警告なし',allowedLengths:[2,3,4,5],hint:false,deadEndWarning:false},
 {...advanced,id:'advanced1',name:'上級1',subtitle:'7×7・2～5文字・ヒントあり・手詰まり警告なし',allowedLengths:[2,3,4,5],hint:true},
 {...advanced,id:'advanced2',name:'上級2',subtitle:'7×7・2～6文字・ヒントあり・手詰まり警告なし',allowedLengths:[2,3,4,5,6],hint:true},
 {...advanced,id:'advanced3',name:'上級3',subtitle:'7×7・2～6文字・ヒントなし・手詰まり警告なし',allowedLengths:[2,3,4,5,6],hint:false}].map(m=>({...m,hintEnabled:m.hint}));
export const PATTERNS=[{2:7,3:1,4:2},{2:6,3:3,4:1},{2:8,3:3,4:0}];
export const INTERMEDIATE_PATTERNS=[{2:6,3:4,4:3},{2:4,3:4,4:4},{3:4,4:6},{2:9,3:2,4:3},{2:3,3:5,5:3},{4:4,5:4},{2:4,3:1,5:5},{3:2,5:6}];
export const ADVANCED_PATTERNS=[{2:5,3:5,4:6},{2:3,3:5,4:7},{2:4,3:4,4:6,5:1},{3:3,4:5,5:4},{2:2,3:3,5:6,6:1},{3:1,4:5,5:4,6:1},{2:3,4:4,5:3,6:2},{3:3,4:4,6:4}];
export const THREE_LETTER_WORDS=['水平器','基準点','水準点','出来形','出来高','配筋図','平面図','断面図','位置図','地盤高','計画高'];
export function createDictionary(records){const result={};for(const r of records){if(typeof r.term!=='string'||Array.from(r.term).length!==r.length||!r.description||!r.level)throw new Error('用語辞書が不正です');const id='term-'+Array.from(r.term).map(c=>c.codePointAt(0).toString(16)).join('-');if(result[id])throw new Error('用語が重複しています');result[id]={...r,word:r.term};}return result;}
export function seededRandom(seed){return ()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t^=t+Math.imul(t^t>>>7,61|t);return ((t^t>>>14)>>>0)/4294967296;};}
export function shuffle(items,rng=Math.random){const a=[...items];for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
export const setHash=ids=>[...ids].sort().join('|');
export function allowedTermsFor(board,dictionary,n=5){const counts={};board.forEach(c=>counts[c]=(counts[c]||0)+1);return dictionaryIndex(dictionary).terms.filter(t=>t.length<=n&&/^\p{Script=Han}+$/u.test(dictionary[t.termId].word)).flatMap(t=>{const maxUses=Math.min(...Object.entries(t.needs).map(([c,k])=>Math.floor((counts[c]||0)/k)));return maxUses>0?[{termId:t.termId,maxUses}]:[];});}
const orders=new Map();function permutations(items){if(!items.length)return [[]];return items.flatMap((v,i)=>permutations(items.filter((_,j)=>i!==j)).map(rest=>[v,...rest]));}
// Search placements with the real erasure rule. A certificate, not just the
// selected character multiset, proves the generated board is playable.
export function certify(stage,dictionary,maxAttempts=2400){let attempts=0;const chosen=new Set(stage.correctTerms),n=gridSize(stage);
 function route(state,index){if(isClear(state))return [];if(index>=stage.correctTerms.length)return null;const id=stage.correctTerms[index];if(state.used[id])return route(state,index+1);const word=Array.from(dictionary[id].word);if(!orders.has(word.length))orders.set(word.length,permutations(word.map((_,i)=>i)).reverse());
  for(const step of [1,n])for(let start=0;start<n*n;start++){if(step===1?start%n+word.length>n:Math.floor(start/n)+word.length>n)continue;const cells=word.map((_,i)=>start+i*step);
   for(const order of orders.get(word.length)){if(++attempts>maxAttempts)return null;let next=state,actions=[],valid=true;const placed=new Set();
    for(const offset of order){if(next.used[id])break;const to=cells[offset];if(next.board[to]===word[offset]){placed.add(to);continue;}const from=next.board.findIndex((c,i)=>c===word[offset]&&!placed.has(i));if(from<0){valid=false;break;}const r=resolveSwap(next,stage,dictionary,from,to);if(r.cleared.some(m=>!chosen.has(m.termId)||r.state.used[m.termId]>1)){valid=false;break;}actions.push({type:'swap',from,to,cleared:r.cleared.map(m=>({termId:m.termId,cells:m.cells}))});next=r.state;placed.add(to);}
    if(valid&&next.used[id]){const rest=route(next,index+1);if(rest!==null)return [...actions,...rest];}
   }
  }return null;
 }return route(initialState(stage),0);
}
function makeStage(mode,ids,board,dictionary){const config=MODES.find(m=>m.id===mode);return {id:mode,name:config.name,difficulty:({5:'beginner',6:'intermediate',7:'advanced'})[config.gridSize],deadEndWarning:config.deadEndWarning,gridSize:config.gridSize,solverScope:'dictionary',correctTerms:ids,initialBoard:board,allowedTerms:allowedTermsFor(board,dictionary,config.gridSize),setHash:setHash(ids),solutionRoute:[]};}
export function generateProblem(mode,dictionary,{rng=Math.random,previousHash=null,previousBoard=null,maxSets=30,maxShuffles=35,maxCertificateAttempts=2400,maxDurationMs=null,fallbacks=[]}={}){
 const config=MODES.find(m=>m.id===mode);if(!config)throw new Error('モード設定が不正です');
 const deadline=Date.now()+(maxDurationMs??(config.gridSize===7?4500:Infinity));
 const pool=Object.entries(dictionary).filter(([,t])=>config.allowedLevels.includes(t.level)&&config.allowedLengths.includes(t.length)&&/^\p{Script=Han}+$/u.test(t.word));
 const patterns=(({5:PATTERNS,6:INTERMEDIATE_PATTERNS,7:ADVANCED_PATTERNS})[config.gridSize]).filter(p=>Object.entries(p).every(([length,count])=>config.allowedLengths.includes(Number(length))&&pool.filter(([,t])=>t.length===Number(length)).length>=count));
 sets: for(let attempt=0;attempt<maxSets;attempt++){
  if(Date.now()>=deadline)break;
  const pattern=mode==='beginner1'?{2:11,3:1,4:0}:patterns[Math.floor(rng()*patterns.length)],ids=[];if(!pattern)break;
  for(const length of config.allowedLengths){const choices=pool.filter(([,t])=>t.length===length&&(mode!=='beginner1'||(length===2?t.level==='beginner1':THREE_LETTER_WORDS.includes(t.word))));ids.push(...shuffle(choices,rng).slice(0,pattern[length]||0).map(([id])=>id));}
  const letters=ids.flatMap(id=>Array.from(dictionary[id].word));if(letters.length!==config.cellCount||new Set(ids).size!==ids.length||setHash(ids)===previousHash)continue;
  for(let trial=0;trial<maxShuffles;trial++){
   if(Date.now()>=deadline)break sets;
   const board=shuffle(letters,rng);if(JSON.stringify(board)===previousBoard)continue;const stage=makeStage(mode,ids,board,dictionary);if(matches(initialState(stage),stage,dictionary).length)continue;
   const route=certify(stage,dictionary,maxCertificateAttempts);if(!route)continue;stage.solutionRoute=route;validateStage(stage,dictionary);return stage;
  }
 }
 const options=fallbacks.filter(s=>s.id===mode&&s.setHash!==previousHash&&JSON.stringify(s.initialBoard)!==previousBoard);if(!options.length)throw new Error('検証済みの予備問題がありません');const stage=structuredClone(options[Math.floor(rng()*options.length)]);validateStage(stage,dictionary);return {...stage,fallback:true};
}
export function remainingHint(state,stage,dictionary,rng=Math.random,previous=null){const counts={};state.board.filter(Boolean).forEach(c=>counts[c]=(counts[c]||0)+1);let words=stage.correctTerms.filter(id=>(state.used[id]||0)<1).filter(id=>{const need={};Array.from(dictionary[id].word).forEach(c=>need[c]=(need[c]||0)+1);return Object.entries(need).every(([c,n])=>(counts[c]||0)>=n);});const other=words.filter(id=>dictionary[id].word!==previous);if(other.length)words=other;return words.length?dictionary[words[Math.floor(rng()*words.length)]].word:null;}
