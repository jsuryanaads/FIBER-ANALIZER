import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./supabase-config.js";
const supabase=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storageKey:"fiber-analyzer-auth"}});
const state={session:null,profile:null,assets:[],cables:[],cores:[],maps:[],sub:null};
const $=id=>document.getElementById(id), esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const page=document.body.dataset.page||location.pathname.split("/").pop().replace(".html","")||"dashboard";
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
 const [a,c,cores,m]=await Promise.all([
  supabase.from("network_assets").select("*").eq("organization_id",org).order("type").order("code"),
  supabase.from("network_cables").select("*").eq("organization_id",org).order("code"),
  supabase.from("network_cores").select("*").eq("organization_id",org).order("core_number"),
  supabase.from("network_core_connections").select("*").eq("organization_id",org).order("created_at")
 ]);
 if(a.error||c.error||cores.error||m.error){console.error(a.error,c.error,cores.error,m.error);setSync(false);return}
 state.assets=a.data||[];state.cables=c.data||[];state.cores=cores.data||[];state.maps=m.data||[];setSync(true);render();
}
function subscribe(){state.sub=supabase.channel("fiber-live").on("postgres_changes",{event:"*",schema:"public"},()=>load()).subscribe(s=>setSync(s==="SUBSCRIBED"))}
function setupPage(){
 document.querySelectorAll("[data-page-link]").forEach(a=>{if(a.dataset.pageLink===page)a.classList.add("active")});
 const names={"dashboard":"Dashboard","cable-core":"Cable & Core","trace-analysis":"Trace","optical-analyzer":"Optical Analyzer","work-order":"Work Order"};$("pageTitle").textContent=names[page]||page.replaceAll("-"," ");
 document.querySelectorAll(".page-section").forEach(s=>s.classList.toggle("active",s.classList.contains("page-"+page+"-section")));
 $("menuBtn").onclick=()=>$("sidebar").classList.toggle("open");
 $("logoutBtn").onclick=async()=>{await supabase.auth.signOut();location.reload()};
 document.addEventListener("click",e=>{const a=e.target.closest("[data-action]");if(!a)return;if(a.dataset.action==="new-asset")$("assetDialog").showModal();if(a.dataset.action==="new-cable"){fillAssets();$("cableDialog").showModal()}if(a.dataset.action==="new-map"){fillMaps();$("mapDialog").showModal()}});
 $("assetForm").onsubmit=saveAsset;$("cableForm").onsubmit=saveCable;$("mapForm").onsubmit=saveMap;$("traceBtn").onclick=trace;
}
function render(){
 const counts={assets:state.assets.length,cables:state.cables.length,cores:state.cores.length,active:state.cores.filter(x=>x.status==="ACTIVE"||x.status==="IN_USE").length};
 $("stats").innerHTML=Object.entries(counts).map(([k,v])=>`<div class="stat"><label>${k}</label><strong>${v}</strong></div>`).join("");
 $("assetsTable").innerHTML="<table><thead><tr><th>Type</th><th>Code</th><th>Name</th><th>Ports</th><th>Status</th></tr></thead><tbody>"+state.assets.map(x=>`<tr><td>${esc(x.type)}</td><td><b>${esc(x.code)}</b></td><td>${esc(x.name)}</td><td>${x.port_count||"—"}</td><td><span class="badge good">${esc(x.status)}</span></td></tr>`).join("")+"</tbody></table>";
 $("cablesTable").innerHTML="<table><thead><tr><th>Code</th><th>From</th><th>To</th><th>Core</th><th>Length</th><th>Status</th></tr></thead><tbody>"+state.cables.map(x=>`<tr><td><b>${esc(x.code)}</b></td><td>${name(x.from_asset_id)}</td><td>${name(x.to_asset_id)}</td><td>${x.fiber_count}C</td><td>${x.length_m??"—"} m</td><td>${esc(x.status)}</td></tr>`).join("")+"</tbody></table>";
 $("mapsTable").innerHTML="<table><thead><tr><th>Node</th><th>Input</th><th>Output</th><th>Type</th><th>Status</th></tr></thead><tbody>"+state.maps.map(x=>`<tr><td>${name(x.node_id)}</td><td>${coreLabel(x.input_core_id)}</td><td>${coreLabel(x.output_core_id)}</td><td>${esc(x.connection_type)}</td><td>${esc(x.status)}</td></tr>`).join("")+"</tbody></table>";
 $("topology").innerHTML=state.assets.map(x=>`<div class="node"><label>${esc(x.type)}</label><strong>${esc(x.code)}</strong><small>${esc(x.name)} · ${x.port_count||0} port</small></div>`).join("")||"<div class='panel'>Belum ada asset.</div>";
 const first=state.cables[0];$("activePath").innerHTML=first?`<div>${name(first.from_asset_id)} → ${esc(first.code)} ${first.fiber_count}C → ${name(first.to_asset_id)}</div>`:"<div>Belum ada jalur.</div>";
 const tc=$("traceCore");if(tc)tc.innerHTML='<option value="">Pilih core</option>'+state.cores.map(c=>`<option value="${c.id}">${coreLabel(c.id)} · ${c.status}</option>`).join("");
}
const name=id=>{const x=state.assets.find(a=>a.id===id);return x?x.code:"—"};const core=id=>state.cores.find(c=>c.id===id);const coreLabel=id=>{const c=core(id),cb=c&&state.cables.find(x=>x.id===c.cable_id);return c&&cb?`${cb.code} Core ${c.core_number}`:"—"};
function fillAssets(){const opts=state.assets.map(x=>`<option value="${x.id}">${esc(x.code)} · ${esc(x.type)}</option>`).join("");$("cableFrom").innerHTML=opts;$("cableTo").innerHTML=opts}
function fillMaps(){const opts=state.assets.filter(x=>["JB","ODC","ODP","OTB"].includes(x.type)).map(x=>`<option value="${x.id}">${esc(x.code)} · ${esc(x.type)}</option>`).join("");$("mapNode").innerHTML=opts;const c=state.cables.map(x=>`<option value="${x.id}">${esc(x.code)} · ${x.fiber_count}C</option>`).join("");$("mapInputCable").innerHTML=c;$("mapOutputCable").innerHTML=c;fillCores("mapInputCore",$("mapInputCable").value);fillCores("mapOutputCore",$("mapOutputCable").value)}
function fillCores(target,cableId){$(target).innerHTML=state.cores.filter(x=>x.cable_id===cableId).map(x=>`<option value="${x.id}">Core ${x.core_number} · ${x.status}</option>`).join("")}
$("mapInputCable").onchange=()=>fillCores("mapInputCore",$("mapInputCable").value);$("mapOutputCable").onchange=()=>fillCores("mapOutputCore",$("mapOutputCable").value);
async function saveAsset(e){e.preventDefault();const o={organization_id:state.profile.organization_id,type:$("assetType").value,code:$("assetCode").value.trim(),name:$("assetName").value.trim(),port_count:Number($("assetPorts").value)||null,status:"ACTIVE"};const {error}=await supabase.from("network_assets").insert(o);if(error)return alert(error.message);$("assetDialog").close();e.target.reset();await load()}
async function saveCable(e){e.preventDefault();const from=$("cableFrom").value,to=$("cableTo").value,n=Number($("fiberCount").value);if(!from||!to||from===to)return alert("Endpoint kabel harus berbeda.");const code=$("cableCode").value.trim();if(state.cables.some(x=>x.code===code))return alert("Code kabel sudah digunakan.");const o={organization_id:state.profile.organization_id,code,cable_type:"FIBER",fiber_count:n,length_m:Number($("cableLength").value)||null,from_asset_id:from,to_asset_id:to,status:$("cableStatus").value,extra:{source:"rebuild-v1"}};const {data,error}=await supabase.from("network_cables").insert(o).select("id").single();if(error)return alert(error.message);const rows=Array.from({length:n},(_,i)=>({organization_id:state.profile.organization_id,cable_id:data.id,core_number:i+1,status:"AVAILABLE"}));const cr=await supabase.from("network_cores").insert(rows);if(cr.error){await supabase.from("network_cables").delete().eq("id",data.id);return alert(cr.error.message)}$("cableDialog").close();e.target.reset();await load()}
async function saveMap(e){e.preventDefault();const ic=$("mapInputCable").value,oc=$("mapOutputCable").value,i=$("mapInputCore").value,o=$("mapOutputCore").value,node=$("mapNode").value;if(ic===oc||i===o)return alert("Input dan output harus berbeda.");if(state.maps.some(x=>x.status==="ACTIVE"&&x.output_core_id===o))return alert("Output core sudah digunakan.");const {error}=await supabase.from("network_core_connections").insert({organization_id:state.profile.organization_id,node_id:node,input_cable_id:ic,output_cable_id:oc,input_core_id:i,output_core_id:o,connection_type:"SPLICE",status:$("mapStatus").value,extra:{source:"rebuild-v1"}});if(error)return alert(error.message);await supabase.from("network_cores").update({status:"IN_USE"}).in("id",[i,o]);$("mapDialog").close();await load()}
function trace(){let id=$("traceCore").value;if(!id)return;$("traceResult").textContent="";const seen=new Set();const lines=[];for(let step=0;step<50&&id&&!seen.has(id);step++){seen.add(id);const c=core(id),cb=c&&state.cables.find(x=>x.id===c.cable_id);if(!c||!cb)break;lines.push(`${name(cb.from_asset_id)} → ${cb.code} Core ${c.core_number} → ${name(cb.to_asset_id)}`);const m=state.maps.find(x=>x.status==="ACTIVE"&&x.input_core_id===id);id=m?m.output_core_id:null}if(lines.length===0)lines.push("Core tidak ditemukan.");$("traceResult").textContent=lines.join("\n↓\n")}
$("loginForm").onsubmit=async e=>{e.preventDefault();show("Memproses…");const {error}=await supabase.auth.signInWithPassword({email:$("email").value,password:$("password").value});if(error)return show(error.message);location.reload()};
supabase.auth.onAuthStateChange((_e,s)=>{state.session=s});
boot();