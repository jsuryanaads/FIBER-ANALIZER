export function buildGraph(db){
 const nodes=new Map((db.assets||[]).map(a=>[a.id,a])),adj=new Map();
 const add=(a,b,meta={})=>{if(!nodes.has(a)||!nodes.has(b))return;if(!adj.has(a))adj.set(a,[]);if(!adj.has(b))adj.set(b,[]);adj.get(a).push({to:b,...meta});adj.get(b).push({to:a,...meta});};
 for(const c of db.cables||[])add(c.from,c.to,{kind:"CABLE",cableId:c.id,fromPort:Math.max(1,Number(c.fromPort)||1),toPort:Math.max(1,Number(c.toPort)||1)});
 for(const s of db.splices||[])add(s.from,s.to,{kind:"SPLICE",spliceId:s.id,inputCoreId:s.input_core_id,outputCoreId:s.output_core_id});
 for(const l of [...(db.links||[]),...(db.logicalLinks||[])])add(l.from,l.to,{kind:l.kind||"LINK",linkId:l.id,coreId:l.core_id});
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
 const errors=[],assets=db.assets||[],ids=new Set(assets.map(a=>a.id)),assetById=new Map(assets.map(a=>[a.id,a])),cableById=new Map((db.cables||[]).map(c=>[c.id,c])),coreById=new Map(),keys=new Set();
 const portCount=a=>Math.max(1,Number(a?.port_count)||(a?.type==="OLT"?16:1));
 const validatePort=(c,nodeId,port,side)=>{const n=assetById.get(nodeId),p=Number(port);if(!Number.isInteger(p)||p<1)errors.push("Cable "+c.code+": "+side+" port must be an integer >= 1");else if(p>portCount(n))errors.push("Cable "+c.code+": "+side+" port "+p+" exceeds "+portCount(n)+" ports on "+(n?.code||nodeId));};
 for(const c of db.cables||[]){
  if(!ids.has(c.from)||!ids.has(c.to))errors.push("Cable "+c.code+": endpoint missing");
  if(c.from===c.to)errors.push("Cable "+c.code+": self-loop");
  if(!(Number(c.fiber_count)>0))errors.push("Cable "+c.code+": fiber_count must be > 0");
  if(ids.has(c.from))validatePort(c,c.from,c.fromPort,"fromPort");
  if(ids.has(c.to))validatePort(c,c.to,c.toPort,"toPort");
 }
 for(const c of db.cores||[]){
  const k=c.cable_id+":"+c.core_number;if(keys.has(k))errors.push("Duplicate core "+k);keys.add(k);coreById.set(c.id,c);
  const cable=cableById.get(c.cable_id);
  if(!cable)errors.push("Core "+c.id+": cable missing");
  else if(!(Number(c.core_number)>=1&&Number(c.core_number)<=Number(cable.fiber_count)))errors.push("Core "+c.id+": core number outside cable capacity");
 }
 for(const s of db.splices||[]){if(!s.from||!s.to)errors.push("Splice "+s.id+": endpoints required");if(s.input_core_id&&s.input_core_id===s.output_core_id)errors.push("Splice "+s.id+": identical core");}
 for(const x of db.coreConnections||[]){
  const node=ids.has(x.nodeId),ic=cableById.get(x.inputCableId),oc=cableById.get(x.outputCableId),i=coreById.get(x.inputCoreId),o=coreById.get(x.outputCoreId);
  if(!node)errors.push("Core mapping "+x.id+": node missing");
  if(!ic||!oc)errors.push("Core mapping "+x.id+": cable missing");
  if(!i||!o)errors.push("Core mapping "+x.id+": core missing");
  if(ic&&i&&i.cable_id!==ic.id)errors.push("Core mapping "+x.id+": input core does not belong to input cable");
  if(oc&&o&&o.cable_id!==oc.id)errors.push("Core mapping "+x.id+": output core does not belong to output cable");
  if(ic&&node&&ic.from!==x.nodeId&&ic.to!==x.nodeId)errors.push("Core mapping "+x.id+": input cable is not connected to node");
  if(oc&&node&&oc.from!==x.nodeId&&oc.to!==x.nodeId)errors.push("Core mapping "+x.id+": output cable is not connected to node");
  if(x.inputCableId===x.outputCableId)errors.push("Core mapping "+x.id+": input and output cable must differ");
 }
 return{valid:errors.length===0,errors};
}
export function coreTrace(db,startId,targetId){
 const nodes=new Map((db.assets||[]).map(a=>[a.id,a]));
 if(!nodes.has(startId)||!nodes.has(targetId))return{found:false,path:[],steps:[],corePath:[]};
 const cables=db.cables||[],cores=db.cores||[],connections=db.coreConnections||[],links=[...(db.links||[]),...(db.logicalLinks||[])];
 const coreById=new Map(cores.map(c=>[c.id,c])),cableById=new Map(cables.map(c=>[c.id,c]));
 const incident=(nodeId,coreId)=>{const core=coreById.get(coreId),cable=core&&cableById.get(core.cable_id);return !!cable&&(cable.from===nodeId||cable.to===nodeId)};
 const incidentCores=nodeId=>cores.filter(c=>incident(nodeId,c.id));
 const q=[{nodeId:startId,coreId:null,steps:[]}],seen=new Set([startId+"|*"]);
 while(q.length){
  const state=q.shift();
  if(state.nodeId===targetId)return{found:true,path:[startId,...state.steps.map(s=>s.toNodeId).filter((id,i,arr)=>i===0||id!==arr[i-1])],steps:state.steps,corePath:state.steps.map(s=>s.coreId).filter(Boolean)};
  const next=[];
  if(state.coreId===null){
   for(const c of incidentCores(state.nodeId))next.push({nodeId:state.nodeId,coreId:c.id,step:{kind:"CORE_SELECT",coreId:c.id,toNodeId:state.nodeId}});
  }
  for(const c of cables){
   if(c.status==="INACTIVE"||c.status==="DAMAGED"||state.coreId===null||!incident(state.nodeId,state.coreId))continue;
   const core=coreById.get(state.coreId);if(!core||core.cable_id!==c.id)continue;
   const toNodeId=c.from===state.nodeId?c.to:c.from;
   const fromPort=Math.max(1,Number(c.from===state.nodeId?c.fromPort:c.toPort)||1),toPort=Math.max(1,Number(c.from===state.nodeId?c.toPort:c.fromPort)||1);
   next.push({nodeId:toNodeId,coreId:state.coreId,step:{kind:"CABLE",cableId:c.id,coreId:state.coreId,toNodeId,fromPort,toPort}});
  }
  for(const x of connections){
   if(x.status==="INACTIVE"||x.nodeId!==state.nodeId||state.coreId===null)continue;
   let nextCore=null;if(x.inputCoreId===state.coreId)nextCore=x.outputCoreId;else if(x.outputCoreId===state.coreId)nextCore=x.inputCoreId;
   if(nextCore&&coreById.has(nextCore))next.push({nodeId:state.nodeId,coreId:nextCore,step:{kind:x.connectionType||"SPLICE",connectionId:x.id,coreId:nextCore,toNodeId:state.nodeId,inputCoreId:x.inputCoreId,outputCoreId:x.outputCoreId}});
  }
  for(const s of db.splitters||[]){
   if(s.nodeId!==state.nodeId||state.coreId===null)continue;
   if(s.inputCoreId===state.coreId){
    const ratio=Number(String(s.ratio).split(":")[1])||0;
    for(let port=1;port<=ratio;port++){
     const patch=(db.splitterConnections||[]).find(x=>x.fromSplitterId===s.id&&Number(x.fromPort)===port);
     if(patch){
      const target=db.splitters.find(t=>t.id===patch.toSplitterId);
      if(target)next.push({nodeId:state.nodeId,coreId:state.coreId,step:{kind:"SPLITTER",splitterId:s.id,outputPort:port,toSplitterId:target.id,toNodeId:state.nodeId}});
     }
     const out=(db.splitterOutputs||[]).find(x=>x.splitterId===s.id&&Number(x.outputPort)===port);
     if(out&&coreById.has(out.coreId))next.push({nodeId:state.nodeId,coreId:out.coreId,step:{kind:"SPLITTER_OUTPUT",splitterId:s.id,outputPort:port,coreId:out.coreId,toNodeId:state.nodeId}});
    }
   }
  }
  for(const l of links){
   if(l.from!==state.nodeId&&l.to!==state.nodeId)continue;
   const toNodeId=l.from===state.nodeId?l.to:l.from;
   next.push({nodeId:toNodeId,coreId:state.coreId,step:{kind:l.kind||"LINK",linkId:l.id,coreId:state.coreId,toNodeId}});
  }
  for(const n of next){const key=n.nodeId+"|"+(n.coreId||"*");if(seen.has(key))continue;seen.add(key);q.push({nodeId:n.nodeId,coreId:n.coreId,steps:n.step.kind==="CORE_SELECT"?state.steps:state.steps.concat(n.step)});}
 }
 return{found:false,path:[],steps:[],corePath:[]};
}
