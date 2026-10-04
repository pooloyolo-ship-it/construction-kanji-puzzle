import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateImportedTerms} from '../scripts/import-terms.mjs';
const records=JSON.parse(fs.readFileSync(new URL('../data/construction_terms_200.json',import.meta.url)));
const dictionary=JSON.parse(fs.readFileSync(new URL('../data/terms.json',import.meta.url)));
const {stages}=JSON.parse(fs.readFileSync(new URL('../data/stages.json',import.meta.url)));
test('提供された200語の表記・文字数・分類・解説をすべて保持',()=>{
  assert.equal(records.length,200);validateImportedTerms(records);
  for(const r of records){const term=Object.values(dictionary).find(t=>t.word===r.term);assert.ok(term,r.term);for(const key of ['term','length','level','description'])assert.equal(term[key],r[key]);}
});
test('不足する警告用語4語を保持し、ステージごとの解説も同期',()=>{
  assert.deepEqual(Object.values(dictionary).filter(t=>t.source==='stage-support').map(t=>t.word).sort(),['水平','監督','施工','路面'].sort());
  for(const stage of stages)for(const t of stage.terms)assert.equal(t.description,dictionary[t.termId].description);
});
test('辞書追加後もステージの許可語は正解語・警告語だけ',()=>{
  for(const s of stages)assert.deepEqual(new Set(s.allowedTerms.map(t=>t.termId)),new Set([...s.correctTerms,...s.warningTerms]));
  assert.equal(dictionary.chohari.word,'丁張');assert.equal(dictionary.chohari.description,records.find(t=>t.term==='丁張').description);
});
test('文字数不一致、重複、解説・分類欠落を拒否',()=>{
  const valid=records[0];for(const list of [[],{},[valid,valid],[{...valid,length:99}],[{...valid,description:''}],[{...valid,level:null}],[{...valid,term:' 丁張'}]])assert.throws(()=>validateImportedTerms(list));
});
