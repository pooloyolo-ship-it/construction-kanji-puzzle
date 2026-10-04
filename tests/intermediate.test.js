import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {MODES,createDictionary,generateProblem,seededRandom,remainingHint,allowedTermsFor} from '../js/generator.js';
import {Game,initialState,matches,isClear,validateStage,solveRemaining} from '../js/engine.js';
const dictionary=createDictionary(JSON.parse(fs.readFileSync(new URL('../data/construction_terms_200.json',import.meta.url))));
const fallbacks=JSON.parse(fs.readFileSync(new URL('../data/fallbacks.json',import.meta.url)));
test('中級150問題:36文字・レベル・長さ・初期成立なし・異なる出題・全消し証明',()=>{
 for(const mode of MODES.filter(m=>m.gridSize===6)){let previousHash=null,previousBoard=null;let five=0;const patterns=new Set();
  for(let i=0;i<50;i++){const s=generateProblem(mode.id,dictionary,{rng:seededRandom(12000+i),previousHash,previousBoard,fallbacks});assert.equal(s.initialBoard.length,36);assert.equal(s.gridSize,6);assert.equal(new Set(s.correctTerms).size,s.correctTerms.length);assert.equal(s.deadEndWarning,mode.deadEndWarning);assert.notEqual(s.setHash,previousHash);assert.notEqual(JSON.stringify(s.initialBoard),previousBoard);assert.equal(matches(initialState(s),s,dictionary).length,0);
   const lengths=s.correctTerms.map(id=>{assert.ok(mode.allowedLevels.includes(dictionary[id].level));assert.ok(mode.allowedLengths.includes(dictionary[id].length));return dictionary[id].length;});if(lengths.includes(5))five++;patterns.add(lengths.sort().join(''));
   validateStage(s,dictionary);const g=new Game(s,dictionary);for(const a of s.solutionRoute)assert.equal(g.move(a.from,a.to).blocked,false);assert.ok(isClear(g.state));while(g.undo()){}assert.deepEqual(g.state,initialState(s));previousHash=s.setHash;previousBoard=JSON.stringify(s.initialBoard);
  }assert.ok(patterns.size>=4);assert.equal(five>0,mode.id!=='intermediate1');
 }
});
test('中級1は危険な同時消去を全体で拒否、中級2・3は消去して完全に戻せる',()=>{
 const d={long:{word:'水平器'},short:{word:'水平'},other:{word:'測量'}};
 for(const mode of MODES.filter(m=>m.gridSize===6)){const board=Array(36).fill(null);board[0]='水';board[35]='平';board[20]='器';board[12]='測';board[13]='量';const s={id:mode.id,name:mode.name,gridSize:6,difficulty:'intermediate',deadEndWarning:mode.deadEndWarning,solverScope:'dictionary',correctTerms:['long','other'],initialBoard:board,allowedTerms:allowedTermsFor(board,d,6)};const g=new Game(s,d),before=structuredClone(g.state),r=g.move(35,1);
  assert.equal(r.blocked,mode.deadEndWarning);if(mode.deadEndWarning){assert.deepEqual(g.state,before);assert.equal(g.history.length,0);}else{assert.equal(r.cleared.length,2);assert.equal(solveRemaining(g.state,s,d),null);assert.ok(g.undo());assert.deepEqual(g.state,before);}g.reset();assert.deepEqual(g.state,before);
 }
});
test('6×6長い語を優先し空白へ移動できる、ヒントを連続重複しない',()=>{
 const d={long:{word:'施工管理'},short:{word:'施工'}};const board=Array(36).fill(null);board[0]='施';board[1]='工';board[2]='管';board[35]='理';const s={gridSize:6,difficulty:'intermediate',deadEndWarning:false,initialBoard:board,allowedTerms:allowedTermsFor(board,d,6)};const g=new Game(s,d);assert.deepEqual(g.move(35,3).cleared.map(m=>m.termId),['long']);assert.ok(isClear(g.state));g.undo();assert.equal(g.move(35,34).state.board[35],null);g.undo();assert.deepEqual(g.state.board,board);
 const stage=fallbacks.find(s=>s.id==='intermediate1'),state=initialState(stage);const first=remainingHint(state,stage,dictionary,()=>0);assert.notEqual(remainingHint(state,stage,dictionary,()=>0,first),first);
});
