import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {createDictionary,generateProblem,seededRandom,MODES,PATTERNS,remainingHint,allowedTermsFor} from '../js/generator.js';
import {Game,initialState,matches,isClear,validateStage,solveRemaining} from '../js/engine.js';
const dictionary=createDictionary(JSON.parse(fs.readFileSync(new URL('../data/construction_terms_200.json',import.meta.url))));
const fallbacks=JSON.parse(fs.readFileSync(new URL('../data/fallbacks.json',import.meta.url)));
test('各モード50問題、計150問題の構成・初期一致なし・実際の全消し証明',()=>{
 for(const mode of MODES.filter(m=>m.gridSize===5)){let previousHash=null,previousBoard=null;const patterns=new Set();
  for(let i=0;i<50;i++){const s=generateProblem(mode.id,dictionary,{rng:seededRandom(i+12250),previousHash,previousBoard,fallbacks});assert.equal(s.initialBoard.length,25);assert.equal(new Set(s.correctTerms).size,s.correctTerms.length);assert.notEqual(s.setHash,previousHash);assert.notEqual(JSON.stringify(s.initialBoard),previousBoard);assert.equal(matches(initialState(s),s,dictionary).length,0);
   const counts={2:0,3:0,4:0};for(const id of s.correctTerms)counts[dictionary[id].length]++;
   if(mode.id==='beginner1'){assert.equal(counts[2],11);assert.equal(counts[3],1);assert.equal(counts[4],0);assert.ok(s.correctTerms.filter(id=>dictionary[id].length===2).every(id=>dictionary[id].level==='beginner1'));}
   else{assert.ok(PATTERNS.some(p=>JSON.stringify(p)===JSON.stringify(counts)));patterns.add(JSON.stringify(counts));}
   validateStage(s,dictionary);const g=new Game(s,dictionary);for(const a of s.solutionRoute)assert.equal(g.move(a.from,a.to).blocked,false);assert.equal(isClear(g.state),true);
   previousHash=s.setHash;previousBoard=JSON.stringify(s.initialBoard);
  }if(mode.id!=='beginner1')assert.equal(patterns.size,3);
 }
});
test('生成試行を使い切っても異なる安全な予備問題で開始',()=>{for(const mode of MODES){const a=generateProblem(mode.id,dictionary,{maxSets:0,fallbacks}),b=generateProblem(mode.id,dictionary,{maxSets:0,fallbacks,previousHash:a.setHash,previousBoard:JSON.stringify(a.initialBoard)});assert.equal(a.fallback,true);assert.notEqual(a.setHash,b.setHash);validateStage(b,dictionary);}});
test('ヒントは残る選択用語だけを表示し、位置や完成済み語を教えない',()=>{const s=fallbacks[0],g=new Game(s,dictionary);const initialHint=remainingHint(g.state,s,dictionary);assert.ok(s.correctTerms.some(id=>dictionary[id].word===initialHint));for(const a of s.solutionRoute){g.move(a.from,a.to);const word=remainingHint(g.state,s,dictionary);if(word){const id=s.correctTerms.find(id=>dictionary[id].word===word);assert.ok(!g.state.used[id]);}}assert.equal(remainingHint(g.state,s,dictionary),null);});
test('正解セット外の別ルートも辞書全体で許可する',()=>{
 const dictionary={long:{word:'施工管理'},short:{word:'施工'},rest:{word:'管理'}};
 const board=Array(25).fill(null);board[3]='施';board[10]='管';board[11]='理';board[24]='工';
 const s={id:'alt',name:'alt',difficulty:'beginner',gridSize:5,solverScope:'dictionary',correctTerms:['long'],initialBoard:board};s.allowedTerms=allowedTermsFor(s.initialBoard,dictionary);
 const g=new Game(s,dictionary),r=g.move(24,4);assert.equal(r.blocked,false);assert.ok(r.cleared.some(m=>m.termId==='short'));assert.notEqual(solveRemaining(g.state,s,dictionary),null);assert.ok(!s.correctTerms.includes('short'));
});
test('禁止語固定ではなく同じ辞書語でも残り文字で可否が変わる',()=>{
 const dictionary={short:{word:'水平'},long:{word:'水平器'},other:{word:'器械'}};
 for(const [extra,blocked]of [[false,true],[true,false]]){const board=Array(25).fill(null);board[3]='水';board[10]='器';board[24]='平';if(extra)board[11]='械';const s={id:'x',name:'x',difficulty:'beginner',gridSize:5,solverScope:'dictionary',correctTerms:['long'],initialBoard:board};s.allowedTerms=allowedTermsFor(s.initialBoard,dictionary);const g=new Game(s,dictionary);assert.equal(g.move(24,4).blocked,blocked);}
});
test('辞書の重複・文字数不一致を読み込みで検出',()=>{assert.throws(()=>createDictionary([{term:'丁張',length:3,description:'a',level:'beginner1'}]));});

