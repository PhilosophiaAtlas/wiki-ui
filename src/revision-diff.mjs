// Exact line diff within a bounded LCS budget; large comparisons use a coarse middle replacement.
export function diffLines(before,after){
 const a=before.split('\n'),b=after.split('\n');let prefix=0,suffix=0;
 while(prefix<a.length&&prefix<b.length&&a[prefix]===b[prefix])prefix++;
 while(suffix<a.length-prefix&&suffix<b.length-prefix&&a[a.length-1-suffix]===b[b.length-1-suffix])suffix++;
 const x=a.slice(prefix,a.length-suffix),y=b.slice(prefix,b.length-suffix),rows=[];
 const push=(kind,text)=>rows.push({kind,text});
 a.slice(0,prefix).forEach(s=>push('same',s));
 const coarse=(x.length+1)*(y.length+1)>1000000;
 if(coarse){x.forEach(s=>push('remove',s));y.forEach(s=>push('add',s));}
 else{const stride=y.length+1,d=new Uint32Array((x.length+1)*stride);
 for(let i=x.length-1;i>=0;i--)for(let j=y.length-1;j>=0;j--)d[i*stride+j]=x[i]===y[j]?1+d[(i+1)*stride+j+1]:Math.max(d[(i+1)*stride+j],d[i*stride+j+1]);
 let i=0,j=0;while(i<x.length||j<y.length){if(i<x.length&&j<y.length&&x[i]===y[j]){push('same',x[i]);i++;j++;}else if(i<x.length&&(j===y.length||d[(i+1)*stride+j]>=d[i*stride+j+1]))push('remove',x[i++]);else push('add',y[j++]);}}
 if(suffix)a.slice(a.length-suffix).forEach(s=>push('same',s));
 return {rows,coarse,added:rows.filter(r=>r.kind==='add').length,removed:rows.filter(r=>r.kind==='remove').length};
}
