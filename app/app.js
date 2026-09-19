import {shortestTrace,validateGraph} from "./graph-engine.js";
const KEY="fiber-analyzer-demo-v2";
const topology=["OLT","PON","JB","ODC","ODP","CUSTOMER"];
const seed={assets:[
{id:"olt-1",type:"OLT",code:"OLT-01",name:"OLT Pangandaran",status:"ACTIVE"},
{id:"pon-1",type:"PON",code:"PON-01/01",name:"Slot 1 Port 1",status:"ACTIVE"},
{id:"jb-1",type:"JB",code:"JB-001",name:"Joint Box 001",status:"ACTIVE"},
{id:"odc-1",type:"ODC",code:"ODC-001",name:"ODC Pangandaran 001",status:"ACTIVE"},
{id:"odp-1",type:"ODP",code:"ODP-001",name:"ODP Desa 001",status:"ACTIVE"},
{id:"c-1",type:"CUSTOMER",code:"CUST-001",name:"Pelanggan Demo",status:"ACTIVE"}],
links:[{id:"pon-uplink",from:"olt-1",to:"pon-1",kind:"PON_UPLINK"},{id:"svc-1",from:"odp-1",to:"c-1",kind:"SERVICE",core_id:"core-5"}],
splices:[],
cables:[{id:"cab-1",code:"FDB-144C-001",fiber_count:144,length_m:1250,from:"pon-1",to:"jb-1",status:"ACTIVE"},{id:"cab-2",code:"FDD-48C-001",fiber_count:48,length_m:830,from:"jb-1",to:"odc-1",status:"ACTIVE"},{id:"cab-3",code:"FDD-24C-001",fiber_count:24,length_m:420,from:"odc-1",to:"odp-1",status:"ACTIVE"}],
cores:[{id:"core-1",cable_id:"cab-1",core_number:1,status:"IN_USE"},{id:"core-2",cable_id:"cab-1",core_number:2,status:"AVAILABLE"},{id:"core-3",cable_id:"cab-2",core_number:1,status:"IN_USE"},{id:"core-4",cable_id:"cab-2",core_number:2,status:"AVAILABLE"},{id:"core-5",cable_id:"cab-3",core_number:1,status:"IN_USE"}]};
let db=JSON.parse(localStorage.getItem(KEY)||"null")||seed;
const $=id=>document.getElementById(id); const save=()=>localStorage.setItem(KEY,JSON.stringify(db));
function render(){renderStats();renderTopology();renderAssets();renderCustomers();renderCores()}
function renderStats(){const counts=Object.fromEntries(topology.map(t=>[t,db.assets.filter(a=>a.type===t).length]));$("stats").innerHTML=topology.map(t=>`<div class="stat"><b>${counts[t]}</b><span>${t}</span></div>`).join("")+`<div class="stat"><b>${db.cores.length}</b><span>CORES</span></div>`}
function renderTopology(){$("topology").innerHTML=topology.map((t,i)=>`<div class="node"><b>${t}</b><small>${db.assets.filter(a=>a.type===t).length} asset</small></div>${i<topology.length-1?'<span class="arrow">→</span>':''}`).join("")}
function renderAssets(){const q=$("search").value.toLowerCase();const a=db.assets.filter(x=>(x.code+" "+x.name+" "+x.type).toLowerCase().includes(q));$("assets").innerHTML=a.map(x=>`<div class="row"><div><b>${x.code}</b><div class="muted">${x.type} · ${x.name}</div></div><span class="badge">${x.status}</span><div><button data-edit="${x.id}">Edit</button> <button class="danger" data-del="${x.id}">Hapus</button></div></div>`).join("")||'<p class="muted">Tidak ada asset.</p>'}
function renderCustomers(){$("customerSelect").innerHTML=db.assets.filter(x=>x.type==="CUSTOMER").map(x=>`<option value="${x.id}">${x.code} — ${x.name}</option>`).join("")}
function renderCores(){const cables=Object.fromEntries(db.cables.map(c=>[c.id,c]));$("cores").innerHTML=`<table class="table"><thead><tr><th>Cable</th><th>Core</th><th>Status</th><th>Length</th></tr></thead><tbody>${db.cores.map(c=>`<tr><td>${cables[c.cable_id]?.code||"-"}</td><td>${c.core_number}</td><td><span class="badge">${c.status}</span></td><td>${cables[c.cable_id]?.length_m||"-"} m</td></tr>`).join("")}</tbody></table>`}
function openAsset(a){$("assetId").value=a?.id||"";$("assetType").value=a?.type||"OLT";$("assetCode").value=a?.code||"";$("assetName").value=a?.name||"";$("assetStatus").value=a?.status||"ACTIVE";$("dialogTitle").textContent=a?"Edit Asset":"Tambah Asset";$("assetDialog").showModal()}
$("addAsset").onclick=()=>openAsset();$("search").oninput=renderAssets;
$("assetForm").onsubmit=e=>{e.preventDefault();const id=$("assetId").value||crypto.randomUUID();const item={id,type:$("assetType").value,code:$("assetCode").value.trim(),name:$("assetName").value.trim(),status:$("assetStatus").value};const i=db.assets.findIndex(a=>a.id===id);if(i>=0)db.assets[i]=item;else db.assets.push(item);save();$("assetDialog").close();render()};
$("assets").onclick=e=>{const edit=e.target.dataset.edit,del=e.target.dataset.del;if(edit)openAsset(db.assets.find(a=>a.id===edit));if(del&&confirm("Hapus asset ini?")){db.assets=db.assets.filter(a=>a.id!==del);db.links=(db.links||[]).filter(x=>x.from!==del&&x.to!==del);db.cables=db.cables.filter(x=>x.from!==del&&x.to!==del);save();render()}};
$("traceBtn").onclick=()=>{const c=db.assets.find(a=>a.id===$("customerSelect").value);if(!c){$("traceOutput").textContent="Belum ada customer.";return}const odp=db.assets.find(a=>a.type==="ODP"),odc=db.assets.find(a=>a.type==="ODC"),jb=db.assets.find(a=>a.type==="JB"),pon=db.assets.find(a=>a.type==="PON"),olt=db.assets.find(a=>a.type==="OLT");$("traceOutput").textContent=[c,odp,odc,jb,pon,olt].filter(Boolean).map((x,i)=>`${i+1}. ${x.type}: ${x.code} — ${x.name}`).join("\n")+"\n\nTrace engine MVP: topology seed path. Next phase will resolve path from cable/core/splice graph."};
$("resetDemo").onclick=()=>{if(confirm("Reset seluruh data demo di browser?")){db=structuredClone(seed);save();render()}};
render();