import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./supabase-config.js";

const supabase=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storageKey:"fiber-analyzer-auth"}});
const state={session:null,profile:null,assets:[],cables:[],cores:[],maps:[],splitters:[],splitterInputs:[],splitterOutputs:[],taps:[],sub:null};
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
 const [a,c,cores,m,s,si,so,t]=await Promise.all([
  supabase.from("network_assets").select("*").eq("organization_id",org).order("type").order("code"),
  supabase.from("network_cables").select("*").eq("organization_id",org).order("code"),
  supabase.from("network_cores").select("*").eq("organization_id",org).order("core_number"),
  supabase.from("network_core_connections").select("*").eq("organization_id",org).order("created_at"),
  supabase.from("network_splitters").select("*").eq("organization_id",org).order("node_id").order("stage"),
  supabase.from("network_splitter_inputs").select("*").eq("organization_id",org).order("created_at"),
  supabase.from("network_splitter_outputs").select("*").eq("organization_id",org).order("splitter_id").order("output_port"),
  supabase.from("network_cable_taps").select("*").eq("organization_id",org).order("code")
 ]);
 const errors=[a,c,cores,m,s,si,so,t].filter(x=>x.error);
 if(errors.length){console.error(errors);setSync(false);return}
 state.assets=a.data||[];state.cables=c.data||[];state.cores=cores.data||[];state.maps=m.data||[];state.splitters=s.data||[];state.splitterInputs=si.data||[];state.splitterOutputs=so.data||[];state.taps=t.data||[];setSync(true);render();
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
 });
 $("assetForm").onsubmit=saveAsset;$("cableForm").onsubmit=saveCable;$("mapForm").onsubmit=saveMap;$("stageForm").onsubmit=saveStage;$("tapForm").onsubmit=saveTap;$("traceBtn").onclick=trace;
 $("stageSourceType").onchange=refreshStageSource;$("stageNode").onchange=refreshStageSource;$("stageInputCable").onchange=()=>fillCores("stageInputCore",$("stageInputCable").value);
 $("stageSourceSplitter").onchange=refreshStageSource;$("tapCable").onchange=()=>fillCores("tapCore",$("tapCable").value);
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
function renderStages(){
 const box=$("stageTable");if(!box)return;
 const rows=state.splitters.map(s=>{const n=state.assets.find(a=>a.id===s.node_id),i=state.splitterInputs.find(x=>x.splitter_id===s.id&&x.status==="ACTIVE");return `<tr><td>${name(s.node_id)}</td><td>Stage ${s.stage}</td><td><b>${esc(s.ratio)}</b></td><td>${esc(i?.source_type||"—")}</td><td>${sourceLabel(i)}</td></tr>`}).join("");
 box.innerHTML="<table><thead><tr><th>ODC/ODP</th><th>Stage</th><th>Splitter</th><th>Input</th><th>Source</th></tr></thead><tbody>"+(rows||"<tr><td colspan='5'>Belum ada stage/splitter.</td></tr>")+"</tbody></table>";
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
 const type=$("stageSourceType").value,node=$("stageNode").value,box=$("stageSourceFields");
 box.innerHTML="";
 if(type==="JB"){const jbs=state.assets.filter(x=>x.type==="JB");box.innerHTML='<select id="stageSourceNode" required>'+jbs.map(x=>`<option value="${x.id}">${esc(x.code)} · JB</option>`).join("")+"</select>";return}
 if(type==="CABLE_CORE"){box.innerHTML='<select id="stageInputCable"></select><select id="stageInputCore"></select>';const c=state.cables.map(x=>`<option value="${x.id}">${esc(x.code)} · ${x.fiber_count}C</option>`).join("");$("stageInputCable").innerHTML=c;fillCores("stageInputCore",$("stageInputCable").value);$("stageInputCable").onchange=()=>fillCores("stageInputCore",$("stageInputCable").value);return}
 if(type==="MID_CABLE_TAP"){box.innerHTML='<select id="stageSourceTap" required></select>';const taps=state.taps.filter(t=>!t.target_node_id||t.target_node_id===node);$("stageSourceTap").innerHTML=taps.map(t=>`<option value="${t.id}">${esc(t.code)} · ${coreLabel(t.core_id)}</option>`).join("");return}
 if(type==="SPLITTER"){const current=Number($("stageNumber").value)||1;const prev=state.splitters.filter(s=>s.id!==undefined&&Number(s.stage)<current);$("stageSourceSplitter").innerHTML=prev.map(x=>`<option value="${x.id}">${name(x.node_id)} · Stage ${x.stage} · ${esc(x.ratio)}</option>`).join("")}
}
async function saveAsset(e){e.preventDefault();const o={organization_id:state.profile.organization_id,type:$("assetType").value,code:$("assetCode").value.trim(),name:$("assetName").value.trim(),port_count:Number($("assetPorts").value)||null,status:"ACTIVE"};const {error}=await supabase.from("network_assets").insert(o);if(error)return alert(error.message);$("assetDialog").close();e.target.reset();await load()}
async function saveCable(e){e.preventDefault();const from=$("cableFrom").value,to=$("cableTo").value,n=Number($("fiberCount").value);if(!from||!to||from===to)return alert("Endpoint kabel harus berbeda.");const code=$("cableCode").value.trim();if(state.cables.some(x=>x.code===code))return alert("Code kabel sudah digunakan.");const o={organization_id:state.profile.organization_id,code,cable_type:"FIBER",fiber_count:n,length_m:Number($("cableLength").value)||null,from_asset_id:from,to_asset_id:to,status:$("cableStatus").value,extra:{source:"fiber-stage-v2"}};const {data,error}=await supabase.from("network_cables").insert(o).select("id").single();if(error)return alert(error.message);const rows=Array.from({length:n},(_,i)=>({organization_id:state.profile.organization_id,cable_id:data.id,core_number:i+1,status:"AVAILABLE"}));const cr=await supabase.from("network_cores").insert(rows);if(cr.error){await supabase.from("network_cables").delete().eq("id",data.id);return alert(cr.error.message)}$("cableDialog").close();e.target.reset();await load()}
async function saveMap(e){e.preventDefault();const ic=$("mapInputCable").value,oc=$("mapOutputCable").value,i=$("mapInputCore").value,o=$("mapOutputCore").value,node=$("mapNode").value;if(ic===oc||i===o)return alert("Input dan output harus berbeda.");if(state.maps.some(x=>x.status==="ACTIVE"&&x.output_core_id===o))return alert("Output core sudah digunakan.");const {error}=await supabase.from("network_core_connections").insert({organization_id:state.profile.organization_id,node_id:node,input_cable_id:ic,output_cable_id:oc,input_core_id:i,output_core_id:o,connection_type:"SPLICE",status:$("mapStatus").value,extra:{source:"fiber-stage-v2"}});if(error)return alert(error.message);await supabase.from("network_cores").update({status:"IN_USE"}).in("id",[i,o]);$("mapDialog").close();await load()}
async function saveTap(e){e.preventDefault();const cableId=$("tapCable").value,coreId=$("tapCore").value,code=$("tapCode").value.trim(),pct=$("tapPct").value===""?null:Number($("tapPct").value),meters=$("tapMeters").value===""?null:Number($("tapMeters").value),target=$("tapTarget").value||null;if(!cableId||!coreId||!code)return alert("Kabel, core dan code wajib.");const c=core(coreId);if(!c||c.cable_id!==cableId)return alert("Core tidak cocok dengan kabel.");if(pct===null&&meters===null)return alert("Isi posisi tap dalam meter atau persen.");const {error}=await supabase.from("network_cable_taps").insert({organization_id:state.profile.organization_id,cable_id:cableId,core_id:coreId,tap_position_m:meters,tap_position_pct:pct,code,label:$("tapLabel").value.trim()||null,target_node_id:target,status:"ACTIVE",extra:{source:"fiber-stage-v2"}});if(error)return alert(error.message);$("tapDialog").close();e.target.reset();await load()}
function fillTapForm(){const c=state.cables.map(x=>`<option value="${x.id}">${esc(x.code)} · ${x.fiber_count}C</option>`).join("");$("tapCable").innerHTML=c;fillCores("tapCore",$("tapCable").value);$("tapTarget").innerHTML='<option value="">Tanpa target</option>'+state.assets.filter(x=>["ODC","ODP","ODC_ODP","JB"].includes(x.type)).map(x=>`<option value="${x.id}">${esc(x.code)} · ${x.type}</option>`).join("")}
function trace(){let id=$("traceCore").value;if(!id)return;const seen=new Set(),lines=[];for(let step=0;step<100&&id&&!seen.has(id);step++){seen.add(id);const c=core(id),cb=c&&state.cables.find(x=>x.id===c.cable_id);if(!c||!cb)break;lines.push(`${name(cb.from_asset_id)} → ${cb.code} Core ${c.core_number} → ${name(cb.to_asset_id)}`);const map=state.maps.find(x=>x.status==="ACTIVE"&&x.input_core_id===id);if(map){id=map.output_core_id;continue}const input=state.splitterInputs.find(x=>x.status==="ACTIVE"&&(x.source_core_id===id||x.source_tap_id===state.taps.find(t=>t.core_id===id)?.id));if(input){const s=state.splitters.find(x=>x.id===input.splitter_id);lines.push(`↳ ${name(s?.node_id)} Stage ${s?.stage} Splitter ${s?.ratio}`);const out=state.splitterOutputs.find(x=>x.splitter_id===s.id);id=out?.core_id||null;continue}id=null}$("traceResult").textContent=lines.join("\n↓\n")||"Core tidak ditemukan."}
async function saveStage(e){e.preventDefault();const node=$("stageNode").value,stage=Number($("stageNumber").value),ratio=$("stageRatio").value,sourceType=$("stageSourceType").value;if(!node||!stage||stage<1||!ratio)return alert("ODC/ODP, stage dan rasio wajib.");const nodeAsset=state.assets.find(x=>x.id===node);if(!["ODC","ODP","ODC_ODP"].includes(nodeAsset?.type))return alert("Splitter stage hanya boleh berada di ODC/ODP.");let src={source_type:sourceType};if(sourceType==="JB"){src.source_node_id=$("stageSourceNode")?.value;const jb=state.assets.find(x=>x.id===src.source_node_id);if(jb?.type!=="JB")return alert("Sumber harus JB.")}if(sourceType==="CABLE_CORE"){src.source_cable_id=$("stageInputCable")?.value;src.source_core_id=$("stageInputCore")?.value;const c=core(src.source_core_id);if(!c||c.cable_id!==src.source_cable_id)return alert("Core tidak cocok dengan kabel.")}if(sourceType==="MID_CABLE_TAP"){src.source_tap_id=$("stageSourceTap")?.value;if(!src.source_tap_id)return alert("Pilih mid-cable tap.")}if(sourceType==="SPLITTER"){src.source_splitter_id=$("stageSourceSplitter")?.value;const s=state.splitters.find(x=>x.id===src.source_splitter_id);if(!s||Number(s.stage)>=stage)return alert("Input splitter harus berasal dari stage sebelumnya.")}const {data,error}=await supabase.from("network_splitters").insert({organization_id:state.profile.organization_id,node_id:node,ratio,stage,input_type:sourceType,extra:{source:"fiber-stage-v2"}}).select("id").single();if(error)return alert(error.message);const ir=await supabase.from("network_splitter_inputs").insert({organization_id:state.profile.organization_id,splitter_id:data.id,...src,status:"ACTIVE",extra:{source:"fiber-stage-v2"}});if(ir.error){await supabase.from("network_splitters").delete().eq("id",data.id);return alert(ir.error.message)}$("stageDialog").close();e.target.reset();await load()}
$("loginForm").onsubmit=async e=>{e.preventDefault();show("Memproses…");const {error}=await supabase.auth.signInWithPassword({email:$("email").value,password:$("password").value});if(error)return show(error.message);location.reload()};
supabase.auth.onAuthStateChange((_e,s)=>{state.session=s});
boot();