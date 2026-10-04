import fs from 'node:fs';import {createDictionary,generateProblem,seededRandom,MODES} from '../js/generator.js';
const dictionary=createDictionary(JSON.parse(fs.readFileSync(new URL('../data/construction_terms_200.json',import.meta.url))));const stages=[];
for(const mode of MODES.map(m=>m.id))for(let i=0;i<3;i++){const start=performance.now(),stage=generateProblem(mode,dictionary,{rng:seededRandom(873+i+stages.length*300),previousHash:stages.at(-1)?.setHash,maxDurationMs:Infinity});stages.push(stage);console.log(mode,i,Math.round(performance.now()-start)+'ms',stage.solutionRoute.length+' moves');}
fs.writeFileSync(new URL('../data/fallbacks.json',import.meta.url),JSON.stringify(stages,null,2)+'\n');
