// Local-only library. No network requests or account required.
const KEY='philosophia-library-v1';
const MAX=1000;
const validId=x=>typeof x==='string'&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(x)&&x.length<=160;
const safeDate=x=>typeof x==='string'&&x.length<=32&&Number.isFinite(Date.parse(x));
export function emptyLibrary(){return {version:1,historyEnabled:true,saved:[],watched:[],history:[]};}
export function validateLibrary(input){
 if(!input||input.version!==1||typeof input.historyEnabled!=='boolean')throw Error('Unsupported library format');
 const out=emptyLibrary();out.historyEnabled=input.historyEnabled;
 for(const key of ['saved','watched','history']){
  if(!Array.isArray(input[key])||input[key].length>MAX)throw Error('Invalid library list: '+key);
  const seen=new Set();
  for(const x of input[key]){
   if(!x||!validId(x.id)||typeof x.title!=='string'||!x.title.trim()||x.title.length>300||!safeDate(x.at))throw Error('Invalid library record');
   if(seen.has(x.id))continue;seen.add(x.id);
   const item={id:x.id,title:x.title,at:x.at};
   if(key==='watched'){if(typeof x.revision!=='string'||!/^[a-f0-9]{64}$/.test(x.revision))throw Error('Invalid revision');item.revision=x.revision;}
   out[key].push(item);
  }
 }
 return out;
}
export function loadLibrary(){const raw=localStorage.getItem(KEY);return raw===null?emptyLibrary():validateLibrary(JSON.parse(raw));}
export function saveLibrary(value){const next=validateLibrary(value);localStorage.setItem(KEY,JSON.stringify(next));window.dispatchEvent(new Event('philosophia-library-change'));return next;}
export function toggleEntry(key,article){
 if(!['saved','watched'].includes(key))throw Error('Invalid list');
 const s=loadLibrary(),existing=s[key].some(x=>x.id===article.id);
 if(existing)s[key]=s[key].filter(x=>x.id!==article.id);
 else{s[key].unshift({id:article.id,title:article.title,at:new Date().toISOString(),...(key==='watched'?{revision:article.revision}:{})});s[key]=s[key].slice(0,MAX);}
 return saveLibrary(s);
}
export function recordVisit(article){const s=loadLibrary();if(!s.historyEnabled)return s;s.history=[{id:article.id,title:article.title,at:new Date().toISOString()},...s.history.filter(x=>x.id!==article.id)].slice(0,MAX);return saveLibrary(s);}
export function mergeLibrary(current,incoming){const a=validateLibrary(current),b=validateLibrary(incoming);for(const k of ['saved','watched','history']){const m=new Map(a[k].map(x=>[x.id,x]));for(const x of b[k]){const prev=m.get(x.id);if(!prev||Date.parse(x.at)>Date.parse(prev.at))m.set(x.id,x);}a[k]=[...m.values()].sort((x,y)=>Date.parse(y.at)-Date.parse(x.at)).slice(0,MAX);}return a;}

export function removeEntry(key,id){if(!['saved','watched','history'].includes(key))throw Error('Invalid list');const s=loadLibrary();s[key]=s[key].filter(x=>x.id!==id);return saveLibrary(s);}
export function setHistoryEnabled(enabled){const s=loadLibrary();s.historyEnabled=Boolean(enabled);return saveLibrary(s);}
export function clearHistory(){const s=loadLibrary();s.history=[];return saveLibrary(s);}
export function acknowledgeRevision(article){const s=loadLibrary();s.watched=s.watched.map(x=>x.id===article.id?{...x,title:article.title,revision:article.revision}:x);return saveLibrary(s);}
export function resetLibrary(){return saveLibrary(emptyLibrary());}
export function watchStatus(item,current){return !current?'missing':item.revision===current.revision?'current':'changed';}
