export const kinds=['article','category','note'];
export const relations=['link','membership','parent','source','note-link'];
const norm=s=>String(s).normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().replace(/đ/g,'d').trim();
export function assembleGraph(base,notes=[]){
 const nodes=new Map(),edges=new Map();
 const add=n=>{if(n&&kinds.includes(n.kind)&&typeof n.id==='string'&&typeof n.title==='string'&&n.id.startsWith(n.kind+':'))nodes.set(n.id,n);};
 const edge=(from,to,kind)=>{if(from!==to&&nodes.has(from)&&nodes.has(to)&&relations.includes(kind)){const key=JSON.stringify([from,to,kind]);edges.set(key,{from,to,kind});}};
 for(const n of base.nodes)add(n);
 for(const n of notes)add({id:'note:'+n.id,title:n.title,kind:'note',href:'/research/#note-'+n.id});
 for(const e of base.edges)edge(e.from,e.to,e.kind);
 for(const n of notes){const id='note:'+n.id;if(n.article)edge(id,'article:'+n.article.id,'source');for(const link of n.links)edge(id,'note:'+link,'note-link');}
 return {nodes:[...nodes.values()],edges:[...edges.values()]};
}
export function indexGraph(graph){
 const nodes=new Map(graph.nodes.map(n=>[n.id,n])),adj=new Map(graph.nodes.map(n=>[n.id,[]]));
 for(const e of graph.edges){adj.get(e.from)?.push({id:e.to,edge:e});adj.get(e.to)?.push({id:e.from,edge:e});}
 return {nodes,adj};
}
export function searchGraph(graph,q,types=kinds,limit=40){
 const needle=norm(q),allowed=new Set(types);
 return graph.nodes.filter(n=>allowed.has(n.kind)&&(!needle||norm(n.title).includes(needle)||norm(n.id).includes(needle))).sort((a,b)=>Number(norm(b.title)===needle)-Number(norm(a.title)===needle)||a.title.localeCompare(b.title,'vi')||a.id.localeCompare(b.id)).slice(0,limit);
}
export function neighborhood(graph,focus,{depth=1,types=kinds,edgeTypes=relations,limit=60}={}){
 const {nodes,adj}=indexGraph(graph),allowed=new Set(types),allowedEdges=new Set(edgeTypes),max=Math.max(1,Math.min(120,limit)),distance=new Map(),queue=[];
 const eligible=id=>nodes.has(id)&&allowed.has(nodes.get(id).kind);
 if(eligible(focus)){distance.set(focus,0);queue.push(focus);}
 else {for(const n of graph.nodes.filter(n=>eligible(n.id)).sort((a,b)=>(adj.get(b.id)?.length??0)-(adj.get(a.id)?.length??0)||a.id.localeCompare(b.id)).slice(0,max)){distance.set(n.id,1);queue.push(n.id);}}
 let truncated=!focus&&graph.nodes.filter(n=>eligible(n.id)).length>max;
 for(let i=0;i<queue.length;i++){const id=queue[i],d=distance.get(id);if(d>=depth)continue;const neighbors=(adj.get(id)??[]).filter(x=>allowedEdges.has(x.edge.kind)&&eligible(x.id)).sort((a,b)=>a.id.localeCompare(b.id));for(const n of neighbors){if(distance.has(n.id))continue;if(distance.size>=max){truncated=true;continue;}distance.set(n.id,d+1);queue.push(n.id);}}
 const selected=queue.map(id=>({...nodes.get(id),distance:distance.get(id)})),edges=graph.edges.filter(e=>distance.has(e.from)&&distance.has(e.to)&&allowedEdges.has(e.kind));
 return {nodes:selected,edges,truncated};
}
export function layoutGraph(view,focus){
 const groups=new Map();for(const n of view.nodes){const ring=n.id===focus?0:Math.max(1,n.distance);if(!groups.has(ring))groups.set(ring,[]);groups.get(ring).push(n);}
 const out=new Map();for(const [ring,ns] of groups){ns.sort((a,b)=>a.kind.localeCompare(b.kind)||a.title.localeCompare(b.title,'vi')||a.id.localeCompare(b.id));const radius=ring===0?0:Math.max(ring*145,ns.length*23);ns.forEach((n,i)=>{const angle=2*Math.PI*i/ns.length-Math.PI/2;out.set(n.id,{x:Math.cos(angle)*radius,y:Math.sin(angle)*radius});});}return out;
}
