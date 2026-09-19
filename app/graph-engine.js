export function buildGraph(db){
 const nodes=new Map((db.assets||[]).map(a=>[a.id,a])),adj=new Map();
 const add=(a,b,meta={})=>{if(!nodes.has(a)||!nodes.has(b))return;if(!adj.has(a))adj.set(a,[]);if(!adj.has(b))adj.set(b,[]);adj.get(a).push({to:b,...meta});adj.get(b).push({to:a,...meta});};
 for(const c of db.cables||[])add(c.from,c.to,{kind:"CABLE",cableId:c.id});
 for(const s of db.splices||[])add(s.from,s.to,{kind:"SPLICE",spliceId:s.id,inputCoreId:s.input_core_id,outputCoreId:s.output_core_id});
 for(const l of db.links||[])add(l.from,l.to,{kind:l.kind||"LINK",linkId:l.id,coreId:l.core_id});
 return {nodes,adj};
}
export function shortestTrace(db,startId,targetId){
 const g=buildGraph(db);if(!g.nodes.has(startId)||!g.nodes.has(targetId))return{found:false,path:[],edges:[]};
 const q=[startId],prev=new Map([[startId,null]]),edge=new Map();
 while(q.length){const cur=q.shift();if(cur===targetId)break;for(const e of g.adj.get(cur)||[]){if(!prev.has(e.to)){prev.set(e.to,cur);edge.set(e.to,e);q.push(e.to);}}}
 if(!prev.has(targetId))return{found:false,path:[],edges:[]};
 const ids=[],edges=[];let cur=targetId;while(cur!==null){ids.push(cur);if(edge.has(cur))edges.push(edge.get(cur));cur=prev.get(cur);}ids.reverse();edges.reverse();
 return{found:true,path:ids.map(id=>g.nodes.get(id)),edges};
}
export function validateGraph(db){
 const errors=[],ids=new Set((db.assets||[]).map(a=>a.id)),keys=new Set();
 for(const c of db.cables||[]){if(!ids.has(c.from)||!ids.has(c.to))errors.push("Cable "+c.code+": endpoint missing");if(c.from===c.to)errors.push("Cable "+c.code+": self-loop");if(!(Number(c.fiber_count)>0))errors.push("Cable "+c.code+": fiber_count must be > 0");}
 for(const c of db.cores||[]){const k=c.cable_id+":"+c.core_number;if(keys.has(k))errors.push("Duplicate core "+k);keys.add(k);}
 for(const s of db.splices||[]){if(!s.from||!s.to)errors.push("Splice "+s.id+": endpoints required");if(s.input_core_id&&s.input_core_id===s.output_core_id)errors.push("Splice "+s.id+": identical core");}
 return{valid:errors.length===0,errors};
}
export function coreTrace(db,startId,targetId){
 const nodes=new Map((db.assets||[]).map(a=>[a.id,a]));
 if(!nodes.has(startId)||!nodes.has(targetId))return{found:false,path:[],steps:[],corePath:[]};
 const cables=db.cables||[],cores=db.cores||[],connections=db.coreConnections||[],links=db.links||[];
 const coreById=new Map(cores.map(c=>[c.id,c])),cableById=new Map(cables.map(c=>[c.id,c]));
 const incident=(nodeId,coreId)=>{const core=coreById.get(coreId),cable=core&&cableById.get(core.cable_id);return !!cable&&(cable.from===nodeId||cable.to===nodeId)};
 const initial=cores.filter(c=>incident(startId,c.id)).map(c=>({nodeId:startId,coreId:c.id,steps:[],seen:[]}));
 const q=[...initial],seen=new Set(initial.map(s=>s.nodeId+"|"+s.coreId));
 while(q.length){
  const state=q.shift();
  if(state.nodeId===targetId)return{found:true,path:[startId,...state.steps.map(s=>s.toNodeId)],steps:state.steps,corePath:state.steps.map(s=>s.coreId).filter(Boolean)};
  const next=[];
  for(const c of cables){if(c.status==="INACTIVE"||c.status==="DAMAGED"||!incident(state.nodeId,state.coreId))continue;const core=coreById.get(state.coreId);if(!core||core.cable_id!==c.id)continue;const toNodeId=c.from===state.nodeId?c.to:c.from;next.push({nodeId:toNodeId,coreId:state.coreId,step:{kind:"CABLE",cableId:c.id,coreId:state.coreId,toNodeId}});}
  for(const x of connections){if(x.status==="INACTIVE"||x.nodeId!==state.nodeId)continue;let nextCore=null;if(x.inputCoreId===state.coreId)nextCore=x.outputCoreId;else if(x.outputCoreId===state.coreId)nextCore=x.inputCoreId;if(nextCore&&coreById.has(nextCore))next.push({nodeId:state.nodeId,coreId:nextCore,step:{kind:x.connectionType||"SPLICE",connectionId:x.id,coreId:nextCore,toNodeId:state.nodeId}});}
  for(const l of links){if(l.from!==state.nodeId&&l.to!==state.nodeId)continue;const toNodeId=l.from===state.nodeId?l.to:l.from;next.push({nodeId:toNodeId,coreId:state.coreId,step:{kind:l.kind||"LINK",linkId:l.id,coreId:state.coreId,toNodeId}});}
  for(const n of next){const key=n.nodeId+"|"+n.coreId;if(seen.has(key))continue;seen.add(key);q.push({nodeId:n.nodeId,coreId:n.coreId,steps:state.steps.concat(n.step)});}
 }
 return{found:false,path:[],steps:[],corePath:[]};
}
