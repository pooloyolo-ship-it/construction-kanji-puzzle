import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
export function validateImportedTerms(records){
 if(!Array.isArray(records)||!records.length)throw new Error('用語データは空でない配列が必要です');
 const seen=new Set();
 for(const [i,record]of records.entries()){
  if(!record||typeof record.term!=='string'||!record.term.trim()||record.term!==record.term.trim())throw new Error(`${i+1}件目: 用語が不正です`);
  if(!Number.isInteger(record.length)||record.length!==Array.from(record.term).length)throw new Error(`${record.term}: 文字数が一致しません`);
  if(typeof record.level!=='string'||!record.level.trim()||typeof record.description!=='string'||!record.description.trim())throw new Error(`${record.term}: 分類または解説がありません`);
  if(seen.has(record.term))throw new Error(`用語が重複しています: ${record.term}`);seen.add(record.term);
 }
 return records;
}
export function importTerms(){
 const source=validateImportedTerms(JSON.parse(fs.readFileSync(new URL('../data/construction_terms_200.json',import.meta.url),'utf8').replace(/^\uFEFF/,'')));
 const target=new URL('../data/terms.json',import.meta.url),existing=JSON.parse(fs.readFileSync(target,'utf8').replace(/^\uFEFF/,''));
 const byWord=new Map(Object.entries(existing).map(([id,value])=>[value.word,{id,value}])),result={};
 for(const record of source){
  const old=byWord.get(record.term),id=old?.id||`term-${Array.from(record.term).map(c=>c.codePointAt(0).toString(16)).join('-')}`;
  result[id]={...record,word:record.term,...(old?.value.reading?{reading:old.value.reading}:{}),source:'construction_terms_200.json'};
 }
 const words=new Set(source.map(r=>r.term));
 for(const [id,value]of Object.entries(existing))if(!words.has(value.word)&&value.source!=='construction_terms_200.json')result[id]={...value,term:value.word,length:Array.from(value.word).length,source:'stage-support'};
 const stageFile=new URL('../data/stages.json',import.meta.url),stageData=JSON.parse(fs.readFileSync(stageFile,'utf8').replace(/^\uFEFF/,''));
 for(const stage of stageData.stages){
  if(stage.allowedTerms.some(t=>!result[t.termId]))throw new Error(`${stage.name}: 必要な用語が辞書にありません`);
  stage.terms=stage.correctTerms.map(termId=>({termId,term:result[termId].word,description:result[termId].description}));
 }
 fs.writeFileSync(target,JSON.stringify(result,null,2)+'\n');
 fs.writeFileSync(stageFile,JSON.stringify(stageData,null,2)+'\n');
 console.log(`取り込み: ${source.length}語、ステージ用補助語: ${Object.keys(result).length-source.length}語、合計: ${Object.keys(result).length}語`);
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url)importTerms();
