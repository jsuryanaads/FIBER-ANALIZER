import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./supabase-config.js";

const supabase=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storageKey:"fiber-analyzer-auth"}});
const state={session:null,profile:null,assets:[],cables:[],cores:[],maps:[],splitters:[],splitterInputs:[],splitterOutputs:[],splitterConnections:[],taps:[],sub:null};
const $=id=>document.getElementById(id), esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const page=document.body.dataset.page||location.pathname.split("/").pop().replace(".html","")||"dashboard";
const nodeTypes=["JB","ODC","ODP","OTB","OLT","CUSTOMER","ODC_ODP"];

function show(msg){$("authMsg").textContent=msg}
function setSync(ok){$("syncState").textContent=ok?"● realtime":"● offline";$("syncState").style.color=ok?"var(--green)":"var(--red)"}
async function boot(){
 const {data:{session}}=await supabase.auth.getSession(); state.session=session;
 if(!session){$("auth").classList.remove("hidden");return}
 const {data:p,error}=await supabase.from("profiles").select("id,organization_id,role,name,active").eq("id",session.user.id).maybeSingle();
 if(error||!p||p.active===false){show(error?.message||"Profile belum tersedia.");return}
 state.profile=p;$("auth").classList.add("hidden");$("app").classList.remove("hidden");$("year").textContent=new Date().getFullYear();$("sessionInfo").textContent=`Login: ${session.user.email} · ${p.role}`;setupPage();await load();subscribe();
}
async function load(){
 const org=state.profile.organization_id;
 const [a,c,cores,m,s,si,so,sc,t]=await Promise.all([
  supabase.from("network_assets").select("*").eq("organization_id",org).order("type").order("code"),
  supabase.from("network_cables").select("*").eq("organization_id",org).order("code"),
  supabase.from("network_cores").select("*").eq("organization_id",org).order("core_number"),
  supabase.from("network_core_connections").select("*").eq("organization_id",org).order("created_at"),
  supabase.from("network_splitters").select("*").eq("organization_id",org).order("node_id").order("stage"),
  supabase.from("network_splitter_inputs").select("*").eq("organization_id",org).order("created_at"),
  supabase.from("network_splitter_outputs").select("*").eq("organization_id",org).order("splitter_id").order("output_port"),
  supabase.from("network_splitter_connections").select("*").eq("organization_id",org).order("from_splitter_id").order("from_port"),
  supabase.from("network_cable_taps").select("*").eq("organization_id",org).order("code")
 ]);
 const errors=[a,c,cores,m,s,si,so,sc,t].filter(x=>x.error);
 if(errors.length){console.error(errors);setSync(false);return}
 state.assets=a.data||[];state.cables=c.data||[];state.cores=cores.data||[];state.maps=m.data||[];state.splitters=s.data||[];state.splitterInputs=si.data||[];state.splitterOutputs=so.data||[];state.splitterConnections=sc.data||[];state.taps=t.data||[];setSync(true);render();
}
function subscribe(){state.sub=supabase.channel("fiber-live").on("postgres_changes",{event:"*",schema:"public"},()=>load()).subscribe(s=>setSync(s==="SUBSCRIBED"))}
function setupPage(){
 document.querySelectorAll("[data-page-link]").forEach(a=>{if(a.dataset.pageLink===page)a.classList.add("active")});
 const names={dashboard:"Dashboard",topology:"Topology",inventory:"Inventory","cable-core":"Cable & Core","trace-analysis":"Trace","optical-analyzer":"Optical Analyzer",incident:"Incident","work-order":"Work Order",customer:"Customer",reports:"Reports",users:"Users",settings:"Settings"};
 $("pageTitle").textContent=names[page]||page.replaceAll("-"," ");
 const sectionClass={dashboard:"page-dashboard-section",topology:"page-topology-section",inventory:"page-inventory-section","cable-core":"page-cable-section","trace-analysis":"page-trace-section","optical-analyzer":"page-optical-section",incident:"page-incident-section","work-order":"page-workorder-section",customer:"page-customer-section",reports:"page-reports-section",users:"page-users-section",settings:"page-settings-section"}[page]||"page-dashboard-section";
 document.querySelectorAll(".page-section").forEach(s=>s.classList.toggle("active",s.classList.contains(sectionClass)));
 $("menuBtn").onclick=()=>$("sidebar").classList.toggle("open");
 $("logoutBtn").onclick=async()=>{await supabase.auth.signOut();location.reload()};
 document.addEventListener("click",e=>{const a=e.target.closest("[data-action]");if(!a)return;
  if(a.dataset.action==="new-asset")$("assetDialog").showModal();
  if(a.dataset.action==="new-cable"){fillAssets();$("cableDialog").showModal()}
  if(a.dataset.action==="new-map"){fillMaps();$("mapDialog").showModal()}
  if(a.dataset.action==="new-stage"){fillStageForm();$("stageDialog").showModal()}
  if(a.dataset.action==="new-tap"){fillTapForm();$("tapDialog").showModal()}
  if(a.dataset.action==="new-output"){fillOutputForm();$("outputDialog").showModal()}
 });
 $("assetForm").onsubmit=saveAsset;$("cableForm").onsubmit=saveCable;$("mapForm").onsubmit=saveMap;$("stageForm").onsubmit=saveStage;$("tapForm").onsubmit=saveTap;$("outputForm").onsubmit=saveOutput;$("traceBtn").onclick=trace;
 $("stageSourceType").onchange=refreshStageSource;$("stageNode").onchange=refreshStageSource;$("stageInputCable").onchange=()=>fillCores("stageInputCore",$("stageInputCable").value);
 $("stageSourceSplitter").onchange=refreshStageSource;$("stageNumber").oninput=refreshStageSource;$("tapCable").onchange=()=>fillCores("tapCore",$("tapCable").value);$("outputSplitter").onchange=refreshOutputForm;$("outputType").onchange=refreshOutputForm;
}
function render(){
 const counts={assets:state.assets.length,cables:state.cables.length,cores:state.cores.length,active:state.cores.filter(x=>x.status==="ACTIVE"||x.status==="IN_USE").length,splitters:state.splitters.length,taps:state.taps.length};
 $("stats").innerHTML=Object.entries(counts).map(([k,v])=>`<div class="stat"><label>${k}</label><strong>${v}</strong></div>`).join("");
 $("assetsTable").innerHTML="<table><thead><tr><th>Type</th><th>Code</th><th>Name</th><th>Ports</th><th>Status</th></tr></thead><tbody>"+state.assets.map(x=>`<tr><td>${esc(x.type)}</td><td><b>${esc(x.code)}</b></td><td>${esc(x.name)}</td><td>${x.port_count||"—"}</td><td><span class="badge good">${esc(x.status)}</span></td></tr>`).join("")+"</tbody></table>";
 $("cablesTable").innerHTML="<table><thead><tr><th>Code</th><th>From</th><th>To</th><th>Core</th><th>Length</th><th>Status</th></tr></thead><tbody>"+state.cables.map(x=>`<tr><td><b>${esc(x.code)}</b></td><td>${name(x.from_asset_id)}</td><td>${name(x.to_asset_id)}</td><td>${x.fiber_count}C</td><td>${x.length_m??"—"} m</td><td>${esc(x.status)}</td></tr>`).join("")+"</tbody></table>";
 $("mapsTable").innerHTML="<table><thead><tr><th>Node</th><th>Input</th><th>Output</th><th>Type</th><th>Status</th></tr></thead><tbody>"+state.maps.map(x=>`<tr><td>${name(x.node_id)}</td><td>${coreLabel(x.input_core_id)}</td><td>${coreLabel(x.output_core_id)}</td><td>${esc(x.connection_type)}</td><td>${esc(x.status)}</td></tr>`).join("")+"</tbody></table>";
 $("topology").innerHTML=state.assets.map(x=>`<div class="node"><label>${esc(x.type)}</label><strong>${esc(x.code)}</strong><small>${esc(x.name)} · ${x.port_count||0} port</small></div>`).join("")||"<div class='panel'>Belum ada asset.</div>";
 $("activePath").innerHTML=state.cables[0]?`<div>${name(state.cables[0].from_asset_id)} → ${esc(state.cables[0].code)} ${state.cables[0].fiber_count}C → ${name(state.cables[0].to_asset_id)}</div>`:"<div>Belum ada jalur.</div>";
 const tc=$("traceCore");if(tc)tc.innerHTML='<option value="">Pilih core</option>'+state.cores.map(c=>`<option value="${c.id}">${coreLabel(c.id)} · ${c.status}</option>`).join("");
 renderStages();
}
function ratioPorts(r){return Number(String(r).split("/")[1])||0}
function portMapping(s,p){return state.splitterOutputs.find(x=>x.splitter_id===s.id&&Number(x.output_port)===p&&x.status!=="RETIRED")||state.splitterConnections.find(x=>x.from_splitter_id===s.id&&Number(x.from_port)===p&&x.status!=="RETIRED")}
function portLabel(s,p){const m=portMapping(s,p);if(!m)return "TERSEDIA";if(m.splitter_id){const cc=core(m.core_id),cb=cc&&state.cables.find(x=>x.id===cc.cable_id);return (cb?cb.code:"Kabel")+" Core "+(cc?cc.core_number:"?")}const t=state.splitters.find(x=>x.id===m.to_splitter_id);return "Stage "+(t?t.stage:"?")+" IN"}
function fillOutputForm(){$("outputSplitter").innerHTML=state.splitters.map(x=>"<option value=\""+x.id+"\">"+name(x.node_id)+" · Stage "+x.stage+" · "+esc(x.ratio)+"</option>").join("");refreshOutputForm()}
function refreshOutputForm(){const s=state.splitters.find(x=>x.id===$("outputSplitter").value);if(!s)return;const n=ratioPorts(s.ratio);$("outputPort").innerHTML=Array.from({length:n},(_,i)=>i+1).map(p=>"<option value=\""+p+"\" "+(portMapping(s,p)?"disabled":"")+">OUT "+p+(portMapping(s,p)?" · SUDAH DIGUNAKAN":" · TERSEDIA")+"</option>").join("");const b=$("outputTargetFields");b.innerHTML="";if($("outputType").value==="CABLE_CORE"){b.innerHTML="<select id=\"outputCable\" required></select><select id=\"outputCore\" required></select>";$("outputCable").innerHTML=state.cables.map(x=>"<option value=\""+x.id+"\">"+esc(x.code)+" · "+x.fiber_count+"C</option>").join("");fillCores("outputCore",$("outputCable").value);$("outputCable").onchange=()=>fillCores("outputCore",$("outputCable").value)}else{const cs=state.splitters.filter(x=>x.id!==s.id&&Number(x.stage)>Number(s.stage));b.innerHTML="<select id=\"outputTargetSplitter\" required></select>";$("outputTargetSplitter").innerHTML=cs.map(x=>"<option value=\""+x.id+"\">"+name(x.node_id)+" · Stage "+x.stage+" · "+esc(x.ratio)+"</option>").join("")}}
async function saveOutput(e){e.preventDefault();const s=state.splitters.find(x=>x.id===$("outputSplitter").value),p=Number($("outputPort").value);if(!s||!p)return alert("Splitter dan port wajib.");if(portMapping(s,p))return alert("Port output sudah digunakan.");if($("outputType").value==="CABLE_CORE"){const cableId=$("outputCable").value,coreId=$("outputCore").value,cc=core(coreId);if(!cc||cc.cable_id!==cableId)return alert("Core tidak cocok dengan kabel.");const r=await supabase.from("network_splitter_outputs").insert({organization_id:state.profile.organization_id,splitter_id:s.id,output_port:p,cable_id:cableId,core_id:coreId,status:"ACTIVE",extra:{source:"fiber-stage-v3"}});if(r.error)return alert(r.error.message)}else{const t=state.splitters.find(x=>x.id===$("outputTargetSplitter").value),inp=t&&state.splitterInputs.find(x=>x.splitter_id===t.id&&x.status==="ACTIVE"),srcPort=Number(inp&&inp.extra&&inp.extra.source_output_port||0);if(!t||Number(t.stage)<=Number(s.stage))return alert("Tujuan harus stage berikutnya.");if(!inp||inp.source_splitter_id!==s.id||srcPort!==p)return alert("Input target harus memakai splitter dan OUT yang sama.");const r=await supabase.from("network_splitter_connections").insert({organization_id:state.profile.organization_id,node_id:s.node_id,from_splitter_id:s.id,from_port:p,to_splitter_id:t.id,to_port:"IN",status:"ACTIVE"});if(r.error)return alert(r.error.message)}$("outputDialog").close();e.target.reset();await load()}
function renderStages(){
 const box=$("stageTable");if(!box)return;
 const rows=state.splitters.map(s=>{const i=state.splitterInputs.find(x=>x.splitter_id===s.id&&x.status==="ACTIVE");const ports=Array.from({length:ratioPorts(s.ratio)},(_,n)=>{const p=n+1,u=!!portMapping(s,p);return "<span class=\"port-chip "+(u?"used":"free")+"\">OUT "+p+" · "+portLabel(s,p)+"</span>"}).join("");return "<tr><td>"+name(s.node_id)+"</td><td>Stage "+s.stage+"</td><td><b>"+esc(s.ratio)+"</b></td><td>"+esc(i&&i.source_type||"—")+"</td><td>"+sourceLabel(i)+"</td><td><div class=\"port-list\">"+ports+"</div></td></tr>"}).join("");
 box.innerHTML="<table><thead><tr><th>ODC/ODP</th><th>Stage</th><th>Splitter</th><th>Input</th><th>Source</th><th>Output ports</th></tr></thead><tbody>"+(rows||"<tr><td colspan=\"6\">Belum ada stage/splitter.</td></tr>")+"</tbody></table>";
 const ob=$("outputTable");if(!ob)return;
 const orows=state.splitters.flatMap(s=>Array.from({length:ratioPorts(s.ratio)},(_,n)=>{const p=n+1,u=!!portMapping(s,p);return "<tr><td>"+name(s.node_id)+"</td><td>Stage "+s.stage+"</td><td>"+esc(s.ratio)+"</td><td>OUT "+p+"</td><td>"+(u?"DIGUNAKAN":"TERSEDIA")+"</td><td>"+esc(portLabel(s,p))+"</td></tr>"})).join("");
 ob.innerHTML="<table><thead><tr><th>ODC/ODP</th><th>Stage</th><th>Splitter</th><th>Port</th><th>Status</th><th>Tujuan</th></tr></thead><tbody>"+(orows||"<tr><td colspan=\"6\">Belum ada output.</td></tr>")+"</tbody></table>";
}
const name=id=>{const x=state.assets.find(a=>a.id===id);return x?x.code:"—"};
const core=id=>state.cores.find(c=>c.id===id);
const coreLabel=id=>{const c=core(id),cb=c&&state.cables.find(x=>x.id===c.cable_id);return c&&cb?`${cb.code} Core ${c.core_number}`:"—"};
const sourceLabel=i=>{if(!i)return "—";if(i.source_type==="JB")return name(i.source_node_id);if(i.source_type==="CABLE_CORE")return coreLabel(i.source_core_id);if(i.source_type==="MID_CABLE_TAP"){const t=state.taps.find(x=>x.id===i.source_tap_id);return t?`${t.code} · ${coreLabel(t.core_id)}`:"—"}if(i.source_type==="SPLITTER"){const s=state.splitters.find(x=>x.id===i.source_splitter_id);return s?`${name(s.node_id)} Stage ${s.stage} · ${s.ratio}`:"—"}return "—"};
function fillAssets(){const opts=state.assets.map(x=>`<option value="${x.id}">${esc(x.code)} · ${esc(x.type)}</option>`).join("");$("cableFrom").innerHTML=opts;$("cableTo").innerHTML=opts}
function fillMaps(){const opts=state.assets.filter(x=>["JB","ODC","ODP","OTB"].includes(x.type)).map(x=>`<option value="${x.id}">${esc(x.code)} · ${esc(x.type)}</option>`).join("");$("mapNode").innerHTML=opts;const c=state.cables.map(x=>`<option value="${x.id}">${esc(x.code)} · ${x.fiber_count}C</option>`).join("");$("mapInputCable").innerHTML=c;$("mapOutputCable").innerHTML=c;fillCores("mapInputCore",$("mapInputCable").value);fillCores("mapOutputCore",$("mapOutputCable").value)}
function fillCores(target,cableId){$(target).innerHTML=state.cores.filter(x=>x.cable_id===cableId).map(x=>`<option value="${x.id}">Core ${x.core_number} · ${x.status}</option>`).join("")}
function fillStageForm(){
 const boxes=state.assets.filter(x=>["ODC","ODP","ODC_ODP"].includes(x.type));$("stageNode").innerHTML=boxes.map(x=>`<option value="${x.id}">${esc(x.code)} · ${esc(x.type)}</option>`).join("");
 $("stageSourceSplitter").innerHTML=state.splitters.map(x=>`<option value="${x.id}">${name(x.node_id)} · Stage ${x.stage} · ${esc(x.ratio)}</option>`).join("");
 const cables=state.cables.map(x=>`<option value="${x.id}">${esc(x.code)} · ${x.fiber_count}C</option>`).join("");$("stageInputCable").innerHTML=cables;fillCores("stageInputCore",$("stageInputCable").value);refreshStageSource();
}
function refreshStageSource(){
 const type=$("stageSourceType").value,node=$("stageNode").value,box=$("stageSourceFields");box.innerHTML="";$("stageSourceSplitter").style.display="none";
 if(type==="JB"){const jbs=state.assets.filter(x=>x.type==="JB");box.innerHTML="<select id=\"stageSourceNode\" required>"+jbs.map(x=>"<option value=\""+x.id+"\">"+esc(x.code)+" · JB</option>").join("")+"</select>";return}
 if(type==="CABLE_CORE"){box.innerHTML="<select id=\"stageInputCable\"></select><select id=\"stageInputCore\"></select>";const cs=state.cables.map(x=>"<option value=\""+x.id+"\">"+esc(x.code)+" · "+x.fiber_count+"C</option>").join("");$("stageInputCable").innerHTML=cs;fillCores("stageInputCore",$("stageInputCable").value);$("stageInputCable").onchange=()=>fillCores("stageInputCore",$("stageInputCable").value);return}
 if(type==="MID_CABLE_TAP"){box.innerHTML="<select id=\"stageSourceTap\" required></select>";const taps=state.taps.filter(t=>!t.target_node_id||t.target_node_id===node);$("stageSourceTap").innerHTML=taps.map(t=>"<option value=\""+t.id+"\">"+esc(t.code)+" · "+coreLabel(t.core_id)+"</option>").join("");return}
 if(type==="SPLITTER"){const current=Number($("stageNumber").value)||1,prev=state.splitters.filter(s=>Number(s.stage)<current);$("stageSourceSplitter").style.display="";$("stageSourceSplitter").innerHTML=prev.map(x=>"<option value=\""+x.id+"\">"+name(x.node_id)+" · Stage "+x.stage+" · "+esc(x.ratio)+"</option>").join("");const s=prev.find(x=>x.id===$("stageSourceSplitter").value)||prev[0];box.innerHTML="<select id=\"stageSourcePort\" required></select>";if(s){const free=Array.from({length:ratioPorts(s.ratio)},(_,n)=>n+1).filter(p=>!portMapping(s,p));$("stageSourcePort").innerHTML=free.map(p=>"<option value=\""+p+"\">OUT "+p+" · TERSEDIA</option>").join("")||"<option value=\"\">Tidak ada port tersedia</option>"}$("stageSourceSplitter").onchange=()=>refreshStageSource()}
}
async function saveAsset(e){e.preventDefault();const o={organization_id:state.profile.organization_id,type:$("assetType").value,code:$("assetCode").value.trim(),name:$("assetName").value.trim(),port_count:Number($("assetPorts").value)||null,status:"ACTIVE"};const {error}=await supabase.from("network_assets").insert(o);if(error)return alert(error.message);$("assetDialog").close();e.target.reset();await load()}
async function saveCable(e){e.preventDefault();const from=$("cableFrom").value,to=$("cableTo").value,n=Number($("fiberCount").value);if(!from||!to||from===to)return alert("Endpoint kabel harus berbeda.");const code=$("cableCode").value.trim();if(state.cables.some(x=>x.code===code))return alert("Code kabel sudah digunakan.");const o={organization_id:state.profile.organization_id,code,cable_type:"FIBER",fiber_count:n,length_m:Number($("cableLength").value)||null,from_asset_id:from,to_asset_id:to,status:$("cableStatus").value,extra:{source:"fiber-stage-v2"}};const {data,error}=await supabase.from("network_cables").insert(o).select("id").single();if(error)return alert(error.message);const rows=Array.from({length:n},(_,i)=>({organization_id:state.profile.organization_id,cable_id:data.id,core_number:i+1,status:"AVAILABLE"}));const cr=await supabase.from("network_cores").insert(rows);if(cr.error){await supabase.from("network_cables").delete().eq("id",data.id);return alert(cr.error.message)}$("cableDialog").close();e.target.reset();await load()}
async function saveMap(e){e.preventDefault();const ic=$("mapInputCable").value,oc=$("mapOutputCable").value,i=$("mapInputCore").value,o=$("mapOutputCore").value,node=$("mapNode").value;if(ic===oc||i===o)return alert("Input dan output harus berbeda.");if(state.maps.some(x=>x.status==="ACTIVE"&&x.output_core_id===o))return alert("Output core sudah digunakan.");const {error}=await supabase.from("network_core_connections").insert({organization_id:state.profile.organization_id,node_id:node,input_cable_id:ic,output_cable_id:oc,input_core_id:i,output_core_id:o,connection_type:"SPLICE",status:$("mapStatus").value,extra:{source:"fiber-stage-v2"}});if(error)return alert(error.message);await supabase.from("network_cores").update({status:"IN_USE"}).in("id",[i,o]);$("mapDialog").close();await load()}
async function saveTap(e){e.preventDefault();const cableId=$("tapCable").value,coreId=$("tapCore").value,code=$("tapCode").value.trim(),pct=$("tapPct").value===""?null:Number($("tapPct").value),meters=$("tapMeters").value===""?null:Number($("tapMeters").value),target=$("tapTarget").value||null;if(!cableId||!coreId||!code)return alert("Kabel, core dan code wajib.");const c=core(coreId);if(!c||c.cable_id!==cableId)return alert("Core tidak cocok dengan kabel.");if(pct===null&&meters===null)return alert("Isi posisi tap dalam meter atau persen.");const {error}=await supabase.from("network_cable_taps").insert({organization_id:state.profile.organization_id,cable_id:cableId,core_id:coreId,tap_position_m:meters,tap_position_pct:pct,code,label:$("tapLabel").value.trim()||null,target_node_id:target,status:"ACTIVE",extra:{source:"fiber-stage-v2"}});if(error)return alert(error.message);$("tapDialog").close();e.target.reset();await load()}
function fillTapForm(){const c=state.cables.map(x=>`<option value="${x.id}">${esc(x.code)} · ${x.fiber_count}C</option>`).join("");$("tapCable").innerHTML=c;fillCores("tapCore",$("tapCable").value);$("tapTarget").innerHTML='<option value="">Tanpa target</option>'+state.assets.filter(x=>["ODC","ODP","ODC_ODP","JB"].includes(x.type)).map(x=>`<option value="${x.id}">${esc(x.code)} · ${x.type}</option>`).join("")}
function trace(){
 const start=$("traceCore").value;if(!start)return;
 const seenC=new Set(),seenS=new Set(),lines=[],usedPorts=new Set();
 let coreId=start,guard=0;
 while(coreId&&guard++<200&&!seenC.has(coreId)){
  seenC.add(coreId);
  const cc=core(coreId),cb=cc&&state.cables.find(x=>x.id===cc.cable_id);
  if(!cc||!cb)break;
  lines.push(`${name(cb.from_asset_id)} → ${cb.code} Core ${cc.core_number} → ${name(cb.to_asset_id)}`);
  const map=state.maps.find(x=>x.status==="ACTIVE"&&x.input_core_id===coreId);
  if(map){coreId=map.output_core_id;continue}
  const tap=state.taps.find(t=>t.core_id===coreId);
  const input=state.splitterInputs.find(x=>x.status==="ACTIVE"&&(x.source_core_id===coreId||x.source_tap_id===tap?.id));
  if(!input){coreId=null;continue}
  const s=state.splitters.find(x=>x.id===input.splitter_id);
  if(!s||seenS.has(s.id)){coreId=null;continue}
  seenS.add(s.id);
  lines.push(`↳ ${name(s.node_id)} · Stage ${s.stage} · Splitter ${s.ratio} · IN`);
  const conn=state.splitterConnections.find(x=>x.status!=="RETIRED"&&x.to_splitter_id===s.id);
  if(conn) lines.push(`↳ INPUT dari Stage ${state.splitters.find(x=>x.id===conn.from_splitter_id)?.stage??"?"} OUT ${conn.from_port}`);
  const outputs=state.splitterOutputs.filter(x=>x.status!=="RETIRED"&&x.splitter_id===s.id).sort((x,y)=>Number(x.output_port)-Number(y.output_port));
  const connections=state.splitterConnections.filter(x=>x.status!=="RETIRED"&&x.from_splitter_id===s.id).sort((x,y)=>Number(x.from_port)-Number(y.from_port));
  outputs.forEach(o=>usedPorts.add(s.id+":"+o.output_port));
  connections.forEach(o=>usedPorts.add(s.id+":"+o.from_port));
  const next=connections[0];
  if(next){
   const target=state.splitters.find(x=>x.id===next.to_splitter_id);
   lines.push(`   OUT ${next.from_port} → Stage ${target?.stage??"?"} IN`);
   const targetInput=state.splitterInputs.find(x=>x.status==="ACTIVE"&&x.splitter_id===next.to_splitter_id);
   if(targetInput?.source_core_id) coreId=targetInput.source_core_id;
   else { lines.push("   Menunggu output Stage berikutnya."); coreId=null; }
   continue;
  }
  const out=outputs[0];
  if(out){
   const oc=core(out.core_id),ocb=oc&&state.cables.find(x=>x.id===oc.cable_id);
   lines.push(`   OUT ${out.output_port} → ${ocb?.code||"Kabel"} Core ${oc?.core_number??"?"}`);
   coreId=out.core_id;
   continue;
  }
  lines.push("   Tidak ada output aktif.");
  coreId=null;
 }
 const available=[];
 state.splitters.forEach(s=>{for(let p=1;p<=ratioPorts(s.ratio);p++){if(!usedPorts.has(s.id+":"+p))available.push(`${name(s.node_id)} Stage ${s.stage} OUT ${p}`)}}});
 lines.push("",`PORT TERSEDIA: ${available.length}`);
 lines.push(...available.map(x=>"  • "+x));
 $("traceResult").textContent=lines.join("\n")||"Jalur tidak ditemukan.";
}
async function saveStage(e){
 e.preventDefault();const node=$("stageNode").value,stage=Number($("stageNumber").value),ratio=$("stageRatio").value,sourceType=$("stageSourceType").value;if(!node||!stage||stage<1||!ratio)return alert("ODC/ODP, stage dan rasio wajib.");const nodeAsset=state.assets.find(x=>x.id===node);if(!["ODC","ODP","ODC_ODP"].includes(nodeAsset&&nodeAsset.type))return alert("Splitter stage hanya boleh berada di ODC/ODP.");
 let src={source_type:sourceType},sourcePort=null;if(sourceType==="JB"){src.source_node_id=$("stageSourceNode").value;const jb=state.assets.find(x=>x.id===src.source_node_id);if(!jb||jb.type!=="JB")return alert("Sumber harus JB.")}if(sourceType==="CABLE_CORE"){src.source_cable_id=$("stageInputCable").value;src.source_core_id=$("stageInputCore").value;const cc=core(src.source_core_id);if(!cc||cc.cable_id!==src.source_cable_id)return alert("Core tidak cocok dengan kabel.")}if(sourceType==="MID_CABLE_TAP"){src.source_tap_id=$("stageSourceTap").value;if(!src.source_tap_id)return alert("Pilih mid-cable tap.")}if(sourceType==="SPLITTER"){src.source_splitter_id=$("stageSourceSplitter").value;sourcePort=Number($("stageSourcePort").value);const s=state.splitters.find(x=>x.id===src.source_splitter_id);if(!s||Number(s.stage)>=stage)return alert("Input splitter harus berasal dari stage sebelumnya.");if(!sourcePort||sourcePort>ratioPorts(s.ratio)||portMapping(s,sourcePort))return alert("Output port sumber tidak tersedia.")}
 const r=await supabase.from("network_splitters").insert({organization_id:state.profile.organization_id,node_id:node,ratio,stage,input_type:sourceType,extra:{source:"fiber-stage-v3"}}).select("id").single();if(r.error)return alert(r.error.message);const extra={source:"fiber-stage-v3"};if(sourcePort)extra.source_output_port=sourcePort;const ir=await supabase.from("network_splitter_inputs").insert({organization_id:state.profile.organization_id,splitter_id:r.data.id,...src,status:"ACTIVE",extra});if(ir.error){await supabase.from("network_splitters").delete().eq("id",r.data.id);return alert(ir.error.message)}$("stageDialog").close();e.target.reset();await load();
}
$("loginForm").onsubmit=async e=>{e.preventDefault();show("Memproses…");const {error}=await supabase.auth.signInWithPassword({email:$("email").value,password:$("password").value});if(error)return show(error.message);location.reload()};
supabase.auth.onAuthStateChange((_e,s)=>{state.session=s});
boot();