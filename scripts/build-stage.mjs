import fs from 'node:fs';
import {initialState,resolveSwap,isClear,validateStage} from '../js/engine.js';
const dictionary=JSON.parse(fs.readFileSync(new URL('../data/terms.json',import.meta.url)));
const specs=[
 {board:'督圧丁測基転平監削量掛来筋水形張器矢掘配図準点出員',correct:['level','reference','supervisor','asbuilt','reinforcement','chohari','mallet','survey','excavation','compaction'],warnings:['horizontal','standard','supervision','rebar','surveyPoint']},
 {board:'水床点土測筋工面型生準枠切施鉄点路盛養路足法盤土場',correct:['benchmark','roadbed','roadbase','slope','formwork','scaffold','steel','surveyPoint','construction','curing','fill','cut'],warnings:['waterLevel','roadSurface','earthwork']},
 {board:'量径舗杭養面厚出盤枠路筋来法工装足施測型高鉄場図生',correct:['progress','surveyStake','rebarDiameter','pavementThickness','constructionDrawing','slope','roadbase','formwork','curing','scaffold'],warnings:['survey','steel','pavement','construction']}
];
function permutations(items){if(!items.length)return [[]];return items.flatMap((item,i)=>permutations(items.filter((_,j)=>i!==j)).map(rest=>[item,...rest]));}
function make(spec,number){
 const correctTerms=spec.correct;
 const stage={id:`stage-0${number}`,name:`初級${number}`,difficulty:'beginner',size:5,initialBoard:Array.from(spec.board),correctTerms,warningTerms:spec.warnings,terms:correctTerms.map(termId=>({termId,term:dictionary[termId].word,description:dictionary[termId].description})),allowedTerms:[...correctTerms,...spec.warnings].map(termId=>({termId,maxUses:1})),solutionRoute:[]};
 function route(state,index){
  if(isClear(state))return [];
  if(index>=correctTerms.length)return null;
  const termId=correctTerms[index];if(state.used[termId])return route(state,index+1);
  const word=Array.from(dictionary[termId].word);
  for(const step of [1,5])for(let start=0;start<25;start++){
   if(step===1?start%5+word.length>5:Math.floor(start/5)+word.length>5)continue;
   const cells=word.map((_,i)=>start+i*step);
   for(const order of permutations(word.map((_,i)=>i)).reverse()){
    let next=state,actions=[],valid=true;const placed=new Set();
    for(const offset of order){if(next.used[termId])break;const to=cells[offset];if(next.board[to]===word[offset]){placed.add(to);continue;}const from=next.board.findIndex((c,i)=>c===word[offset]&&!placed.has(i));if(from<0){valid=false;break;}
     const result=resolveSwap(next,stage,dictionary,from,to);
     if(result.cleared.some(m=>!correctTerms.includes(m.termId))){valid=false;break;}
     actions.push({type:'swap',from,to,cleared:result.cleared.map(m=>({termId:m.termId,cells:m.cells}))});next=result.state;placed.add(to);
    }
    if(valid&&next.used[termId]){const rest=route(next,index+1);if(rest!==null)return [...actions,...rest];}
   }
  }
  return null;
 }
 const solution=route(initialState(stage),0);if(!solution)throw new Error(`${stage.name}: 全消しルートが見つかりません`);stage.solutionRoute=solution;validateStage(stage,dictionary);console.log(`${stage.name}: ${solution.length}回の交換で全消し`);return stage;
}
fs.writeFileSync(new URL('../data/stages.json',import.meta.url),JSON.stringify({schemaVersion:3,progression:{unlockMode:'all'},stages:specs.map((spec,i)=>make(spec,i+1))},null,2)+'\n');
