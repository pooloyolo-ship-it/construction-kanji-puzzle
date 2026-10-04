import fs from 'node:fs';import {Game,validateStage} from '../js/engine.js';import {createDictionary} from '../js/generator.js';
const dictionary=createDictionary(JSON.parse(fs.readFileSync(new URL('../data/construction_terms_200.json',import.meta.url))));
const fallbacks=JSON.parse(fs.readFileSync(new URL('../data/fallbacks.json',import.meta.url)));for(const s of fallbacks){validateStage(s,dictionary);console.log(`OK: ${s.name} — ${s.solutionRoute.length}操作の全消し証明`);}
