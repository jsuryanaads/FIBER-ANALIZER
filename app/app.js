import {shortestTrace,coreTrace,validateGraph} from "./graph-engine.js";
const KEY="fiber-analyzer-flex-v2";
const topology=["OLT","PON","OTB","OBT","JB","ODC","ODP","CUSTOMER"];
const seed={assets:[
{id:"olt-1",type:"OLT",code:"OLT-01",name:"OLT Utama",status:"ACTIVE"},
{id:"pon-1",type:"PON",code:"PON-01",name:"PON Port 01",status:"ACTIVE"},
{id:"otb-2",type:"OTB",code:"OTB-02",name:"Optical Termination Box 02",status:"ACTIVE"},
{id:"obt-2",type:"OBT",code:"OBT-02",name:"Optical Branch Terminal 02",status:"ACTIVE"},
{id:"jb-1",type:"JB",code:"JB-01",name:"Joint Box 01",status:"ACTIVE"},
{id:"jb-2",type:"JB",code:"JB-02",name:"Joint Box 02",status:"ACTIVE"},
{id:"jb-3",type:"JB",code:"JB-03",name:"Joint Box 03",status:"ACTIVE"},
{id:"odc-1",type:"ODC",code:"ODC-01",name:"ODC Utama",status:"ACTIVE"},
{id:"odp-1",type:"ODP",code:"ODP-01",name:"ODP 01",status:"ACTIVE"},
{id:"c-1",type:"CUSTOMER",code:"CUST-001",name:"Pelanggan Demo",status:"ACTIVE"}],
links:[{id:"svc-1",from:"odp-1",to:"c-1",kind:"SERVICE"}],
logicalLinks:[{id:"logical-olt-pon",from:"olt-1",to:"pon-1",kind:"PON"}],
splices:[],
cables:[
{id:"cab-pon-otb",code:"KBL-PON01-OTB02-24C",fiber_count:24,length_m:900,from:"pon-1",to:"otb-2",status:"ACTIVE"},
{id:"cab-otb-obt",code:"KBL-OTB02-OBT02-24C",fiber_count:24,length_m:120,from:"otb-2",to:"obt-2",status:"ACTIVE"},
{id:"cab-obt-jb1",code:"KBL-OBT02-JB01-24C",fiber_count:24,length_m:500,from:"obt-2",to:"jb-1",status:"ACTIVE"},
{id:"cab-jb1-jb2",code:"KBL-JB01-JB02-24C",fiber_count:24,length_m:600,from:"jb-1",to:"jb-2",status:"ACTIVE"},
{id:"cab-jb1-jb3",code:"KBL-JB01-JB03-12C",fiber_count:12,length_m:450,from:"jb-1",to:"jb-3",status:"ACTIVE"},
{id:"cab-jb2-odc",code:"KBL-JB02-ODC01-48C",fiber_count:48,length_m:700,from:"jb-2",to:"odc-1",status:"ACTIVE"},
{id:"cab-odc-odp",code:"KBL-ODC01-ODP01-12C",fiber_count:12,length_m:300,from:"odc-1",to:"odp-1",status:"ACTIVE"}],
cores:[
{id:"core-pon-otb-1",cable_id:"cab-pon-otb",core_number:1,status:"IN_USE"},
{id:"core-otb-obt-1",cable_id:"cab-otb-obt",core_number:1,status:"IN_USE"},
{id:"core-obt-jb1-1",cable_id:"cab-obt-jb1",core_number:1,status:"IN_USE"},
{id:"core-obt-jb1-2",cable_id:"cab-obt-jb1",core_number:2,status:"IN_USE"},
{id:"core-jb1-jb2-1",cable_id:"cab-jb1-jb2",core_number:1,status:"IN_USE"},
{id:"core-jb1-jb3-2",cable_id:"cab-jb1-jb3",core_number:2,status:"IN_USE"},
{id:"core-jb2-odc-3",cable_id:"cab-jb2-odc",core_number:3,status:"IN_USE"},
{id:"core-odc-odp-2",cable_id:"cab-odc-odp",core_number:2,status:"IN_USE"}],
coreConnections:[
{id:"cc-pon-otb",nodeId:"otb-2",inputCableId:"cab-pon-otb",inputCoreId:"core-pon-otb-1",outputCableId:"cab-otb-obt",outputCoreId:"core-otb-obt-1",connectionType:"SPLICE",status:"ACTIVE"},
{id:"cc-otb-obt",nodeId:"obt-2",inputCableId:"cab-otb-obt",inputCoreId:"core-otb-obt-1",outputCableId:"cab-obt-jb1",outputCoreId:"core-obt-jb1-1",connectionType:"SPLICE",status:"ACTIVE"},
{id:"cc-jb1-jb2",nodeId:"jb-1",inputCableId:"cab-obt-jb1",inputCoreId:"core-obt-jb1-1",outputCableId:"cab-jb1-jb2",outputCoreId:"core-jb1-jb2-1",connectionType:"SPLICE",status:"ACTIVE"},
{id:"cc-jb1-jb3",nodeId:"jb-1",inputCableId:"cab-obt-jb1",inputCoreId:"core-obt-jb1-2",outputCableId:"cab-jb1-jb3",outputCoreId:"core-jb1-jb3-2",connectionType:"SPLICE",status:"ACTIVE"},
{id:"cc-jb2-odc",nodeId:"jb-2",inputCableId:"cab-jb1-jb2",inputCoreId:"core-jb1-jb2-1",outputCableId:"cab-jb2-odc",outputCoreId:"core-jb2-odc-3",connectionType:"SPLICE",status:"ACTIVE"},
{id:"cc-odc-odp",nodeId:"odc-1",inputCableId:"cab-jb2-odc",inputCoreId:"core-jb2-odc-3",outputCableId:"cab-odc-odp",outputCoreId:"core-odc-odp-2",connectionType:"SPLICE",status:"ACTIVE"}
]};
let db=JSON.parse(localStorage.getItem(KEY)||"null")||structuredClone(seed);
db.assets=db.assets||[];db.links=db.links||[];db.cables=db.cables||[];db.cores=db.cores||[];db.coreConnections=db.coreConnections||[];
function normalizeDb(){
  const existing=new Map(db.cores.map(c=>[(c.cable_id||"")+":"+c.core_number,c]));
  for(const cable of db.cables){
    const count=Math.max(1,Number(cable.fiber_count)||1);
    for(let n=1;n<=count;n++){
      const key=cable.id+":"+n;
      if(!existing.has(key))db.cores.push({id:crypto.randomUUID(),cable_id:cable.id,core_number:n,status:"AVAILABLE"});
    }
  }
  const cableIds=new Set(db.cables.map(c=>c.id));
  const coreIds=new Set(db.cores.map(c=>c.id));
  db.coreConnections=db.coreConnections.filter(x=>cableIds.has(x.inputCableId)&&cableIds.has(x.outputCableId)&&coreIds.has(x.inputCoreId)&&coreIds.has(x.outputCoreId)&&db.assets.some(a=>a.id===x.nodeId));
}
normalizeDb();
const $=id=>document.getElementById(id), save=()=>localStorage.setItem(KEY,JSON.stringify(db));
const esc=v=>String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
function options(list,value,empty="— Tidak ada —"){return '<option value="">'+empty+'</option>'+list.map(x=>'<option value="'+esc(x.id)+'" '+(x.id===value?"selected":"")+'>'+esc(x.code||x.name||x.id)+'</option>').join("")}
function render(){renderStats();renderTopologyMap();renderCondition();renderAssets();renderCustomers();renderCores();renderCables();renderConnections()}
function nodeOptions(value=""){return '<option value="">— Pilih node —</option>'+db.assets.filter(a=>a.type!=="CUSTOMER").map(a=>'<option value="'+esc(a.id)+'" '+(a.id===value?"selected":"")+'>'+esc(a.code)+' — '+esc(a.name)+'</option>').join("")}
function openCable(c){c=c||{};$("cableId").value=c.id||"";$("cableCode").value=c.code||"";$("cableFrom").innerHTML=nodeOptions(c.from);$("cableTo").innerHTML=nodeOptions(c.to);$("cableFiberCount").value=c.fiber_count||12;$("cableLength").value=c.length_m||0;$("cableStatus").value=c.status||"ACTIVE";$("cableDialog").showModal()}
function cablesAtNode(nodeId){return (db.cables||[]).filter(c=>c.from===nodeId||c.to===nodeId)}
function fillConnectionCables(nodeId,inputValue="",outputValue=""){
  const list=cablesAtNode(nodeId);
  $("connectionInputCable").innerHTML=options(list,inputValue,"— Pilih kabel masuk —");
  $("connectionOutputCable").innerHTML=options(list,outputValue,"— Pilih kabel keluar —");
  fillCore("connectionInputCore","",inputValue);fillCore("connectionOutputCore","",outputValue);
}
function renderConnections(){const byId=Object.fromEntries(db.assets.map(a=>[a.id,a]));const cables=Object.fromEntries((db.cables||[]).map(c=>[c.id,c]));const cores=Object.fromEntries((db.cores||[]).map(c=>[c.id,c]));$("connectionList").innerHTML=(db.coreConnections||[]).map(x=>'<div class="cable-card"><div><b>'+esc(byId[x.nodeId]?.code||x.nodeId)+'</b><span class="badge">'+esc(x.connectionType||"SPLICE")+'</span></div><div class="muted">'+esc(cables[x.inputCableId]?.code||"?")+': Core '+esc(cores[x.inputCoreId]?.core_number||"?")+' → '+esc(cables[x.outputCableId]?.code||"?")+': Core '+esc(cores[x.outputCoreId]?.core_number||"?")+'</div><div class="cable-actions"><button data-conn-edit="'+esc(x.id)+'">Edit</button><button class="danger" data-conn-del="'+esc(x.id)+'">Hapus</button></div></div>').join("")||'<p class="muted">Belum ada mapping core.</p>'}
function fillConnectionForm(x={}){
  $("connectionNode").innerHTML=nodeOptions(x.nodeId);
  fillConnectionCables(x.nodeId||"",x.inputCableId||"",x.outputCableId||"");
  fillCore("connectionInputCore",x.inputCoreId||"",x.inputCableId||"");
  fillCore("connectionOutputCore",x.outputCoreId||"",x.outputCableId||"");
  $("connectionType").value=x.connectionType||"SPLICE";
  $("connectionStatus").value=x.status||"ACTIVE";
}
function openConnection(x){x=x||{};$("connectionId").value=x.id||"";fillConnectionForm(x);$("connectionDialog").showModal()}
function renderCables(){const byId=Object.fromEntries(db.assets.map(a=>[a.id,a]));$("cableList").innerHTML='<div class="cable-grid">'+(db.cables||[]).map(c=>'<div class="cable-card"><div><b>'+esc(c.code)+'</b><span class="badge">'+esc(c.fiber_count)+' CORE</span></div><div class="route"><strong>'+esc(byId[c.from]?.code||"?")+'</strong><span>→</span><strong>'+esc(byId[c.to]?.code||"?")+'</strong></div><div class="muted">'+esc(c.length_m)+' m · '+esc(c.status)+'</div><div class="cable-actions"><button data-cable-edit="'+esc(c.id)+'">Edit</button><button class="danger" data-cable-del="'+esc(c.id)+'">Hapus</button></div></div>').join("")+'</div>'}

function renderStats(){const counts=Object.fromEntries(topology.map(t=>[t,db.assets.filter(a=>a.type===t).length]));$("stats").innerHTML=topology.map(t=>'<div class="stat"><b>'+counts[t]+'</b><span>'+t+'</span></div>').join("")+'<div class="stat"><b>'+db.cores.length+'</b><span>CORES</span></div>'}
function renderTopologyMap(){
  const el=$("topologyMap");if(!el)return;
  const assets=db.assets||[],byId=Object.fromEntries(assets.map(a=>[a.id,a])),edges=[];
  for(const c of db.cables||[])if(byId[c.from]&&byId[c.to])edges.push({from:c.from,to:c.to,kind:"CABLE"});
  for(const l of [...(db.links||[]),...(db.logicalLinks||[])])if(byId[l.from]&&byId[l.to])edges.push({from:l.from,to:l.to,kind:l.kind||"LINK"});
  const adjacency=new Map(assets.map(a=>[a.id,[]]));
  edges.forEach(e=>{adjacency.get(e.from)?.push(e.to);adjacency.get(e.to)?.push(e.from)});
  const root=assets.find(a=>a.type==="OLT")?.id,level=new Map(),queue=[];
  if(root){level.set(root,0);queue.push(root)}
  while(queue.length){const id=queue.shift();for(const n of adjacency.get(id)||[]){if(!level.has(n)){level.set(n,(level.get(id)||0)+1);queue.push(n)}}}
  const maxLevel=Math.max(0,...level.values());
  assets.filter(a=>!level.has(a.id)).forEach((a,i)=>level.set(a.id,maxLevel+1+(i?0:0)));
  const groups=new Map();assets.forEach(a=>{const l=level.get(a.id)||0;if(!groups.has(l))groups.set(l,[]);groups.get(l).push(a)});
  const pos=new Map(),W=900,H=410;
  for(const [l,list] of groups){const x=Math.min(80+l*155,820);list.forEach((a,i)=>pos.set(a.id,{x,y:65+(i+1)*270/(list.length+1)}))}
  const color={OLT:"#1c9bff",PON:"#21d79b",OTB:"#7bdff2",OBT:"#5eead4",JB:"#ff9f2d",ODC:"#b47cff",ODP:"#25cddd",CUSTOMER:"#ffd052"};
  const lines=edges.map(e=>{const a=pos.get(e.from),b=pos.get(e.to);if(!a||!b)return"";return'<line x1="'+a.x+'" y1="'+a.y+'" x2="'+b.x+'" y2="'+b.y+'" stroke="'+(e.kind==="SERVICE"?"#ffd052":"#20b9ff")+'" stroke-width="3" opacity=".9"/>'}).join("");
  const nodes=assets.map(a=>{const p=pos.get(a.id),c=color[a.type]||"#8aa5b8";return'<g><rect x="'+(p.x-48)+'" y="'+(p.y-27)+'" width="96" height="54" rx="9" fill="#0d3450" stroke="'+c+'" stroke-width="2"/><text x="'+p.x+'" y="'+(p.y-4)+'" fill="#e7f0f8" text-anchor="middle" font-size="11" font-weight="700">'+esc(a.type)+'</text><text x="'+p.x+'" y="'+(p.y+13)+'" fill="#a8bfd0" text-anchor="middle" font-size="9">'+esc(a.code)+'</text></g>'}).join("");
  const legend='<g transform="translate(14 350)"><rect width="250" height="45" rx="7" fill="#071321" fill-opacity=".94" stroke="#345269"/><text x="10" y="16" fill="#e7f0f8" font-size="10" font-weight="700">Topology Aktif</text><text x="10" y="32" fill="#9db3c5" font-size="9">'+(db.cables||[]).length+' kabel · '+(db.links||[]).length+' service link · '+assets.length+' node</text></g>';
  el.innerHTML='<svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="xMidYMid meet">'+lines+nodes+legend+'</svg>';
}
function renderCondition(){
  const cores=db.cores||[],total=cores.length,counts={IN_USE:0,AVAILABLE:0,RESERVED:0,DAMAGED:0};
  cores.forEach(c=>{if(counts[c.status]!==undefined)counts[c.status]++;else counts.AVAILABLE++});
  const pct=n=>total?((n/total)*100).toFixed(1):"0.0",used=pct(counts.IN_USE),available=pct(counts.AVAILABLE),reserved=pct(counts.RESERVED),damaged=pct(counts.DAMAGED);
  const p1=Number(used),p2=p1+Number(available),p3=p2+Number(reserved);
  const bg=total?"conic-gradient(#18bd82 0 "+p1+"%,#1688ff "+p1+"% "+p2+"%,#ff9d2d "+p2+"% "+p3+"%,#ef4c58 "+p3+"% 100%)":"#18374f";
  $("coreCondition").innerHTML='<div class="donut" style="background:'+bg+'"><div><b>'+total+'</b><span>Total Core</span></div></div><div class="legend-list"><span><i class="green"></i>Core Terpakai <b>'+used+'%</b></span><span><i class="blue"></i>Core Tersedia <b>'+available+'%</b></span><span><i class="orange"></i>Cadangan <b>'+reserved+'%</b></span><span><i class="red"></i>Core Rusak <b>'+damaged+'%</b></span></div>';
  const customers=(db.assets||[]).filter(x=>x.type==="CUSTOMER"),active=customers.filter(x=>x.status==="ACTIVE").length;
  $("serviceStatus").innerHTML='<div class="service"><span>🟢 Pelanggan Aktif</span><b>'+active+'</b></div><div class="service"><span>🔴 Pelanggan Nonaktif</span><b>'+(customers.length-active)+'</b></div><div class="service"><span>⚠ Gangguan Aktif</span><b>0</b></div><div class="service"><span>🔧 Work Order Open</span><b>0</b></div>';
}
function renderAssets(){const q=$("search").value.toLowerCase();const a=db.assets.filter(x=>(x.code+" "+x.name+" "+x.type).toLowerCase().includes(q));$("assets").innerHTML=a.map(x=>'<div class="row"><div><b>'+esc(x.code)+'</b><div class="muted">'+esc(x.type)+' · '+esc(x.name)+'</div></div><span class="badge">'+esc(x.status)+'</span><div><button data-edit="'+esc(x.id)+'">Edit</button> <button class="danger" data-del="'+esc(x.id)+'">Hapus</button></div></div>').join("")||'<p class="muted">Tidak ada asset.</p>'}
function renderCustomers(){$("customerSelect").innerHTML=db.assets.filter(x=>x.type==="CUSTOMER").map(x=>'<option value="'+esc(x.id)+'">'+esc(x.code)+' — '+esc(x.name)+'</option>').join("")}
function renderCores(){const cables=Object.fromEntries(db.cables.map(c=>[c.id,c]));$("cores").innerHTML='<table class="table"><thead><tr><th>Cable</th><th>Core</th><th>Status</th><th>Length</th></tr></thead><tbody>'+db.cores.map(c=>'<tr><td>'+esc(cables[c.cable_id]?.code||"-")+'</td><td>'+c.core_number+'</td><td><span class="badge">'+esc(c.status)+'</span></td><td>'+esc(cables[c.cable_id]?.length_m||"-")+' m</td></tr>').join("")+'</tbody></table>'}
function openAsset(a){a=a||{};$("assetId").value=a.id||"";$("assetType").value=a.type||"OLT";$("assetCode").value=a.code||"";$("assetName").value=a.name||"";$("assetStatus").value=a.status||"ACTIVE";$("dialogTitle").textContent=a.id?"Edit Asset":"Tambah Asset";$("assetDialog").showModal()}
$("addAsset").onclick=()=>openAsset();$("addCable").onclick=()=>openCable();$("search").oninput=renderAssets;
$("assetForm").onsubmit=e=>{e.preventDefault();const id=$("assetId").value||crypto.randomUUID();const item={id,type:$("assetType").value,code:$("assetCode").value.trim(),name:$("assetName").value.trim(),status:$("assetStatus").value};if(!item.code||!item.name){alert("Kode dan nama asset wajib diisi.");return}const i=db.assets.findIndex(a=>a.id===id);if(i>=0)db.assets[i]=item;else db.assets.push(item);save();$("assetDialog").close();render()};
$("assets").onclick=e=>{const edit=e.target.dataset.edit,del=e.target.dataset.del;if(edit)openAsset(db.assets.find(a=>a.id===edit));if(del&&confirm("Hapus asset ini?")){const removed=new Set(db.cables.filter(x=>x.from===del||x.to===del).map(x=>x.id));db.assets=db.assets.filter(a=>a.id!==del);db.links=(db.links||[]).filter(x=>x.from!==del&&x.to!==del);db.cables=db.cables.filter(x=>!removed.has(x.id));db.cores=db.cores.filter(x=>!removed.has(x.cable_id));db.coreConnections=(db.coreConnections||[]).filter(x=>x.nodeId!==del&&!removed.has(x.inputCableId)&&!removed.has(x.outputCableId));save();render()}};
$("traceBtn").onclick=()=>{const c=db.assets.find(a=>a.id===$("customerSelect").value),olt=db.assets.find(a=>a.type==="OLT");if(!c){$("traceOutput").textContent="Belum ada customer.";return}const result=coreTrace(db,olt?.id,c.id);const errors=validateGraph(db).errors;if(result.found){const byId=Object.fromEntries(db.assets.map(a=>[a.id,a]));const cables=Object.fromEntries(db.cables.map(x=>[x.id,x]));const total=result.steps.filter(s=>s.kind==="CABLE").reduce((n,s)=>n+(Number(cables[s.cableId]?.length_m)||0),0);const coreNumber=id=>db.cores.find(c=>c.id===id)?.core_number;const details=result.steps.map(s=>{if(s.kind==="CABLE")return "KABEL "+(cables[s.cableId]?.code||s.cableId)+" · Core "+coreNumber(s.coreId);if(s.kind==="SPLICE"||s.kind==="PASS_THROUGH"||s.kind==="TERMINATION")return "MAPPING Core "+(coreNumber(s.inputCoreId)||"?")+" → Core "+(coreNumber(s.outputCoreId)||coreNumber(s.coreId)||"?");if(s.kind==="PON")return "PON LINK";return s.kind}).join(" → ");$("traceOutput").textContent=result.path.map((id,i)=>(i+1)+". "+byId[id]?.type+": "+byId[id]?.code+" — "+byId[id]?.name).join("\n")+"\n\nCONTINUITY: "+details+"\nTOTAL CABLE: "+total+" m";return}const fallback=shortestTrace(db,olt?.id,c.id);if(!fallback.found){$("traceOutput").textContent="PATH TIDAK DITEMUKAN.\n"+(errors.length?"Validasi:\n"+errors.join("\n"):"Periksa kabel dan continuity core.");return}$("traceOutput").textContent="Node path ditemukan, tetapi continuity core belum lengkap.\n\n"+fallback.path.map((x,i)=>(i+1)+". "+x.type+": "+x.code+" — "+x.name).join("\n")+"\n\nTambahkan mapping Core Continuity pada setiap JB/ODC/ODP yang dilewati."};

$("cableForm").onsubmit=e=>{e.preventDefault();const id=$("cableId").value||crypto.randomUUID(),from=$("cableFrom").value,to=$("cableTo").value,count=Math.max(1,Number($("cableFiberCount").value||1));if(!from||!to||from===to){alert("Node asal dan tujuan harus berbeda.");return}const item={id,code:$("cableCode").value.trim(),fiber_count:count,length_m:Number($("cableLength").value||0),from,to,status:$("cableStatus").value};const i=db.cables.findIndex(c=>c.id===id);if(i>=0){db.cables[i]=item;db.coreConnections=(db.coreConnections||[]).filter(x=>x.inputCableId!==id&&x.outputCableId!==id);db.cores=db.cores.filter(c=>c.cable_id!==id)}else db.cables.push(item);for(let n=1;n<=count;n++)db.cores.push({id:crypto.randomUUID(),cable_id:id,core_number:n,status:"AVAILABLE"});save();$("cableDialog").close();render()};
$("connectionNode").onchange=()=>fillConnectionCables($("connectionNode").value);$("connectionInputCable").onchange=()=>fillCore("connectionInputCore","",$("connectionInputCable").value);$("connectionOutputCable").onchange=()=>fillCore("connectionOutputCore","",$("connectionOutputCable").value);
$("connectionForm").onsubmit=e=>{e.preventDefault();const id=$("connectionId").value||crypto.randomUUID(),x={id,nodeId:$("connectionNode").value,inputCableId:$("connectionInputCable").value,inputCoreId:$("connectionInputCore").value,outputCableId:$("connectionOutputCable").value,outputCoreId:$("connectionOutputCore").value,connectionType:$("connectionType").value,status:$("connectionStatus").value};if(!x.nodeId||!x.inputCableId||!x.inputCoreId||!x.outputCableId||!x.outputCoreId){alert("Node, kabel, dan core wajib diisi.");return}const validCore=(coreId,cableId)=>db.cores.some(core=>core.id===coreId&&core.cable_id===cableId);const atNode=c=>c&&(c.from===x.nodeId||c.to===x.nodeId);const inputCable=db.cables.find(c=>c.id===x.inputCableId),outputCable=db.cables.find(c=>c.id===x.outputCableId);if(!atNode(inputCable)||!atNode(outputCable)){alert("Kedua kabel harus terhubung ke node/closure yang dipilih.");return}if(x.inputCableId===x.outputCableId){alert("Kabel masuk dan keluar harus berbeda untuk mapping continuity.");return}if(!validCore(x.inputCoreId,x.inputCableId)||!validCore(x.outputCoreId,x.outputCableId)){alert("Core tidak sesuai dengan kabel.");return}const i=db.coreConnections.findIndex(v=>v.id===id);if(i>=0)db.coreConnections[i]=x;else db.coreConnections.push(x);save();$("connectionDialog").close();render()};
$("connectionList").onclick=e=>{const edit=e.target.dataset.connEdit,del=e.target.dataset.connDel;if(edit)openConnection(db.coreConnections.find(x=>x.id===edit));if(del&&confirm("Hapus mapping core ini?")){db.coreConnections=db.coreConnections.filter(x=>x.id!==del);save();render()}};
$("addConnection").onclick=()=>openConnection();
$("cableList").onclick=e=>{const edit=e.target.dataset.cableEdit,del=e.target.dataset.cableDel;if(edit)openCable(db.cables.find(c=>c.id===edit));if(del&&confirm("Hapus kabel dan seluruh core kabel ini?")){db.cables=db.cables.filter(c=>c.id!==del);db.cores=db.cores.filter(c=>c.cable_id!==del);db.coreConnections=(db.coreConnections||[]).filter(x=>x.inputCableId!==del&&x.outputCableId!==del);save();render()}};
$("resetDemo").onclick=()=>{if(confirm("Reset seluruh data demo di browser?")){db=structuredClone(seed);save();render()}};
render();