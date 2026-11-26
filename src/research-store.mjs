// Local research database. No network requests or credentials.
const DB='philosophia-research',STORE='notes',MAX=1000;
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const articleId=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const revision=/^[a-f0-9]{64}$/;
const string=(v,max)=>{if(typeof v!=='string'||v.length>max)throw Error('Invalid text');return v;};
const time=v=>{if(typeof v!=='string'||v.length>32||!Number.isFinite(Date.parse(v)))throw Error('Invalid date');return new Date(v).toISOString();};
export function validateNote(n){
 if(!n||!uuid.test(n.id))throw Error('Invalid note ID');
 const title=string(n.title,300).trim(),body=string(n.body,20000);
 if(!title)throw Error('Empty title');
 if(!Array.isArray(n.tags)||n.tags.length>20||!Array.isArray(n.links)||n.links.length>100)throw Error('Invalid tags or links');
 const tags=[...new Set(n.tags.map(t=>string(t,60).trim().toLocaleLowerCase('vi')).filter(Boolean))];
 const links=[...new Set(n.links)];if(links.some(x=>typeof x!=='string'||!uuid.test(x)||x===n.id))throw Error('Invalid note link');
 let article=null,quote=null;
 if(n.article!==null){const a=n.article;if(!a||typeof a.id!=='string'||a.id.length>160||!articleId.test(a.id)||typeof a.revision!=='string'||!revision.test(a.revision))throw Error('Invalid source');article={id:a.id,title:string(a.title,300),revision:a.revision};}
 if(n.quote!==null){const q=n.quote;if(!article||!q||!Number.isSafeInteger(q.start)||q.start<0||q.start>10000000)throw Error('Invalid quote');const text=string(q.text,4000);if(!text.trim())throw Error('Empty quote');quote={text,start:q.start};}
 const created=time(n.created),updated=time(n.updated);if(Date.parse(updated)<Date.parse(created))throw Error('Invalid timestamps');
 return {id:n.id,title,body,tags,links,article,quote,created,updated};
}
export function validateBackup(input){if(!input||input.version!==1||!Array.isArray(input.notes)||input.notes.length>MAX)throw Error('Invalid backup');const seen=new Set();return input.notes.map(n=>{const v=validateNote(n);if(seen.has(v.id))throw Error('Duplicate note');seen.add(v.id);return v;});}
export function mergeNotes(current,incoming){const m=new Map(current.map(n=>[n.id,validateNote(n)]));for(const v of incoming.map(validateNote)){if(!m.has(v.id)||Date.parse(v.updated)>Date.parse(m.get(v.id).updated))m.set(v.id,v);}if(m.size>MAX)throw Error('Too many notes');return [...m.values()];}
export function locateQuote(text,quote,sameRevision){
 if(!quote)return {state:'none'};
 if(sameRevision&&text.slice(quote.start,quote.start+quote.text.length)===quote.text)return {state:'exact',start:quote.start};
 const start=text.indexOf(quote.text);if(start<0)return {state:'missing'};
 if(text.indexOf(quote.text,start+1)>=0)return {state:'ambiguous'};
 return {state:'relocated',start};
}
export function filterNotes(notes,query='',tag='',scope=''){const q=query.normalize('NFC').toLocaleLowerCase('vi').trim();return notes.filter(n=>(!scope||n.article?.id===scope)&&(!tag||n.tags.includes(tag))&&(!q||[n.title,n.body,n.quote?.text,n.article?.title,...n.tags].filter(Boolean).some(s=>s.normalize('NFC').toLocaleLowerCase('vi').includes(q)))).sort((a,b)=>Date.parse(b.updated)-Date.parse(a.updated)||a.id.localeCompare(b.id));}
let promise,channel;
function open(){if(!promise)promise=new Promise((resolve,reject)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>r.result.createObjectStore(STORE,{keyPath:'id'});r.onsuccess=()=>{const db=r.result;db.onversionchange=()=>{db.close();promise=undefined;};resolve(db);};r.onerror=()=>reject(r.error);r.onblocked=()=>reject(Error('Database blocked'));}).catch(e=>{promise=undefined;throw e;});return promise;}
function notify(){window.dispatchEvent(new Event('philosophia-research-change'));try{channel??=new BroadcastChannel(DB);channel.postMessage('change');}catch{}}
export function subscribe(fn){window.addEventListener('philosophia-research-change',fn);let ch;try{ch=new BroadcastChannel(DB);ch.onmessage=fn;}catch{}return ()=>{window.removeEventListener('philosophia-research-change',fn);ch?.close();};}
export async function listNotes(){const db=await open();return new Promise((resolve,reject)=>{const tx=db.transaction(STORE),r=tx.objectStore(STORE).getAll();r.onsuccess=()=>{try{resolve(r.result.map(validateNote));}catch(e){reject(e);}};r.onerror=()=>reject(r.error);});}
async function mutate(fn){const db=await open();const result=await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite'),s=tx.objectStore(STORE),r=s.getAll();let value,err;tx.oncomplete=()=>resolve(value);tx.onabort=()=>reject(err??tx.error??Error('Transaction aborted'));tx.onerror=()=>{};r.onsuccess=()=>{try{value=fn(r.result.map(validateNote),s);}catch(e){err=e;tx.abort();}};});notify();return result;}
export function saveNote(note,expectedUpdated=null){const v=validateNote(note);return mutate((all,s)=>{const prev=all.find(n=>n.id===v.id);if(prev&&prev.updated!==expectedUpdated)throw Error('Conflict');if(!prev&&expectedUpdated!==null)throw Error('Conflict');if(!prev&&all.length>=MAX)throw Error('Too many notes');s.put(v);return v;});}
export function deleteNote(id){return mutate((all,s)=>{s.delete(id);});}
export function importNotes(input){const incoming=validateBackup(input);return mutate((all,s)=>{const merged=mergeNotes(all,incoming);for(const v of merged)s.put(v);return merged.length;});}
export function clearNotes(){return mutate((all,s)=>s.clear());}
