import {shortestTrace,coreTrace,validateGraph} from "./graph-engine.js";
const KEY="fiber-analyzer-flex-v3";
// Authentication & RBAC foundation
const AUTH_KEY="fiber-analyzer-auth-v1";
const ROLE_PERMISSIONS={
  ADMINISTRATOR:["*"],
  PENGELOLA:["dashboard.read","network.write","customer.write","analysis.use","incident.write","report.read"],
  TEKNISI:["dashboard.read","network.read","customer.read","analysis.use","incident.write","workorder.write"]
};
let authState=JSON.parse(localStorage.getItem(AUTH_KEY)||"null")||{users:[],session:null};
let currentUser=null;
async function hashPassword(password){const data=new TextEncoder().encode(password);const digest=await crypto.subtle.digest("SHA-256",data);return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,"0")).join("")}
function roleCan(permission){return !!currentUser&&(ROLE_PERMISSIONS[currentUser.role]||[]).includes("*")||(ROLE_PERMISSIONS[currentUser?.role]||[]).includes(permission)}
function saveAuth(){localStorage.setItem(AUTH_KEY,JSON.stringify(authState))}
function renderAuth(mode="login",error=""){const body=$("authBody");if(!body)return;const setup=!authState.users.length;body.innerHTML=setup?'<h2>Setup Administrator</h2><p>Buat akun Administrator pertama untuk mengamankan aplikasi.</p><form id="setupForm"><label>Username<input id="setupUser" required autocomplete="username"></label><label>Nama<input id="setupName" required></label><label>Password<input id="setupPass" type="password" minlength="8" required autocomplete="new-password"></label><label>Konfirmasi Password<input id="setupPass2" type="password" minlength="8" required autocomplete="new-password"></label><button>Buat Administrator</button></form><div id="authError">'+esc(error)+'</div><div class="auth-note">Password disimpan sebagai SHA-256 hash di browser. Untuk produksi multi-user, gunakan backend authentication.</div>': '<h2>Login</h2><p>Masuk ke FIBER-ANALYZER.</p><form id="loginForm"><label>Username<input id="loginUser" required autocomplete="username"></label><label>Password<input id="loginPass" type="password" required autocomplete="current-password"></label><button>Masuk</button></form><div id="authError">'+esc(error)+'</div>';
  if(setup){$("setupForm").onsubmit=async e=>{e.preventDefault();const username=$("setupUser").value.trim();const name=$("setupName").value.trim();const pass=$("setupPass").value;if(pass!==$("setupPass2").value)return renderAuth("setup","Konfirmasi password tidak sama.");if(pass.length<8)return renderAuth("setup","Password minimal 8 karakter.");authState.users=[{id:crypto.randomUUID(),username,name,role:"ADMINISTRATOR",passwordHash:await hashPassword(pass),active:true,createdAt:new Date().toISOString()}];authState.session=authState.users[0].id;saveAuth();location.reload()}}else{$("loginForm").onsubmit=async e=>{e.preventDefault();const username=$("loginUser").value.trim();const hash=await hashPassword($("loginPass").value);const user=authState.users.find(u=>u.username===username&&u.active&&u.passwordHash===hash);if(!user)return renderAuth("login","Username atau password salah.");authState.session=user.id;saveAuth();location.reload()}}}
function initAuth(){currentUser=authState.users.find(u=>u.id===authState.session&&u.active)||null;if(!currentUser){$("authScreen").style.display="grid";renderAuth();return false}$("authScreen").style.display="none";$("userName").textContent=currentUser.name||currentUser.username;$("userRole").textContent=currentUser.role;$("userAvatar").textContent=(currentUser.name||currentUser.username).slice(0,2).toUpperCase();$("logoutBtn").onclick=()=>{authState.session=null;saveAuth();location.reload()};return true}
function requirePermission(permission){if(roleCan(permission))return true;alert("Akses ditolak. Role "+(currentUser?.role||"UNKNOWN")+" tidak memiliki izin ini.");return false}
function canManageUsers(){return currentUser?.role==="ADMINISTRATOR"}
function renderUsers(){const el=$("userList");if(!el)return;if(!canManageUsers()){el.innerHTML='<p class="muted">Akses Administrator diperlukan.</p>';return}el.innerHTML=authState.users.map(u=>'<div class="cable-card"><div><b>'+esc(u.name||u.username)+'</b><span class="badge">'+esc(u.role)+'</span></div><div class="muted">@'+esc(u.username)+' · '+(u.active?"ACTIVE":"INACTIVE")+(u.id===currentUser?.id?" · Sesi aktif":"")+'</div><div class="cable-actions">'+(u.id===currentUser?.id?'<button data-user-edit="'+esc(u.id)+'">Edit</button>':'<button data-user-edit="'+esc(u.id)+'">Edit</button><button class="danger" data-user-del="'+esc(u.id)+'">Hapus</button>')+'</div></div>').join("")||'<p class="muted">Belum ada user.</p>'}
function openUser(u={}){$("userId").value=u.id||"";$("userUsername").value=u.username||"";$("userUsername").disabled=!!u.id;$("userNameInput").value=u.name||"";$("userRoleInput").value=u.role||"TEKNISI";$("userActive").value=String(u.active!==false);$("userPassword").value="";$("userDialogTitle").textContent=u.id?"Edit User":"Tambah User";$("userDialog").showModal()}
$("addUser").onclick=()=>{if(requirePermission("user.manage"))openUser()};
$("userForm").onsubmit=async e=>{e.preventDefault();if(!requirePermission("user.manage"))return;const id=$("userId").value||crypto.randomUUID(),username=$("userUsername").value.trim(),name=$("userNameInput").value.trim(),role=$("userRoleInput").value,active=$("userActive").value==="true",pass=$("userPassword").value;const existing=authState.users.find(u=>u.id===id);if(!username||!name){alert("Username dan nama wajib diisi.");return}if(!existing&&pass.length<8){alert("Password minimal 8 karakter.");return}if(existing?.id===currentUser.id&&!active){alert("Administrator yang sedang login tidak dapat dinonaktifkan.");return}if(existing?.role==="ADMINISTRATOR"&&existing.id===currentUser.id&&role!=="ADMINISTRATOR"){alert("Administrator yang sedang login tidak dapat menurunkan role sendiri.");return}if(authState.users.some(u=>u.username===username&&u.id!==id)){alert("Username sudah digunakan.");return}const item={id,username,name,role,active,passwordHash:existing?.passwordHash||"",createdAt:existing?.createdAt||new Date().toISOString()};if(pass)item.passwordHash=await hashPassword(pass);const i=authState.users.findIndex(u=>u.id===id);if(i>=0)authState.users[i]=item;else authState.users.push(item);if(existing?.id===currentUser.id)authState.session=id;saveAuth();$("userDialog").close();currentUser=authState.users.find(u=>u.id===authState.session)||currentUser;renderUsers();$("userName").textContent=currentUser.name||currentUser.username;$("userRole").textContent=currentUser.role};
$("userList").onclick=e=>{if(!requirePermission("user.manage"))return;const edit=e.target.dataset.userEdit,del=e.target.dataset.userDel;if(edit)openUser(authState.users.find(u=>u.id===edit));if(del){const u=authState.users.find(x=>x.id===del);if(u?.role==="ADMINISTRATOR"&&authState.users.filter(x=>x.role==="ADMINISTRATOR").length<=1){alert("Administrator terakhir tidak dapat dihapus.");return}if(u&&confirm("Hapus user "+u.username+"?")){authState.users=authState.users.filter(x=>x.id!==del);saveAuth();renderUsers()}}};
ROLE_PERMISSIONS.ADMINISTRATOR.push("user.manage");

document.addEventListener("click",e=>{const t=e.target.closest("button,[data-edit],[data-del],[data-cable-edit],[data-cable-del],[data-conn-edit],[data-conn-del],[data-splitter-del],[data-splitter-conn-del]");if(!t)return;const mutating=t.matches("#addAsset,#addCable,#addConnection,#addSplitter,#addSplitterConnection,#resetDemo,[data-edit],[data-del],[data-cable-edit],[data-cable-del],[data-conn-edit],[data-conn-del],[data-splitter-del],[data-splitter-conn-del]");if(mutating&&!roleCan("network.write")){e.preventDefault();e.stopImmediatePropagation();requirePermission("network.write")}},true);
document.addEventListener("submit",e=>{if(e.target.matches("#assetForm,#cableForm,#connectionForm,#splitterForm,#splitterConnectionForm")&&!roleCan("network.write")){e.preventDefault();e.stopImmediatePropagation();requirePermission("network.write")}},true);

const topology=["OLT","OTB","JB","ODC_ODP","ODC","ODP","CUSTOMER"];
const typeLabel=t=>({OLT:"OLT",OTB:"OTB",JB:"JB",ODC_ODP:"BOX ODC-ODP",ODC:"BOX ODC",ODP:"BOX ODP",CUSTOMER:"PELANGGAN"}[t]||t);
const emptyDb=()=>({assets:[],links:[],logicalLinks:[],splices:[],splitterOutputs:[],splitterConnections:[],cables:[],cores:[],splitters:[],coreConnections:[]});
let db=JSON.parse(localStorage.getItem(KEY)||"null")||emptyDb();
db.assets=db.assets||[];db.cables=db.cables||[];db.cores=db.cores||[];db.coreConnections=db.coreConnections||[];db.splitterOutputs=db.splitterOutputs||[];
function migrateLegacyTopology(){
  const legacyPonIds=new Set(db.assets.filter(a=>a.type==="OLT_PON"||a.type==="PON").map(a=>a.id));
  const legacyObts=new Set(db.assets.filter(a=>a.type==="OBT").map(a=>a.id));
  const olt=db.assets.find(a=>a.type==="OLT");
  if(legacyPonIds.size&&olt){
    db.cables.forEach(c=>{
      if(legacyPonIds.has(c.from)) c.from=olt.id;
      if(legacyPonIds.has(c.to)) c.to=olt.id;
      if(legacyPonIds.has(c.from)) c.fromPort=Math.max(1,Number(c.fromPort)||1);
    });
  }
  const removedNodeIds=new Set([...legacyPonIds,...legacyObts]);
  db.assets=db.assets.filter(a=>!removedNodeIds.has(a.id));
  db.cables=db.cables.filter(c=>c.from!==c.to&&!removedNodeIds.has(c.from)&&!removedNodeIds.has(c.to));
  const cableIds=new Set(db.cables.map(c=>c.id));
  db.cores=(db.cores||[]).filter(x=>cableIds.has(x.cable_id));
  db.coreConnections=(db.coreConnections||[]).filter(x=>cableIds.has(x.inputCableId)&&cableIds.has(x.outputCableId));
  db.splitterOutputs=(db.splitterOutputs||[]).filter(x=>cableIds.has(x.cableId));
}
migrateLegacyTopology();
db.assets.forEach(a=>{if(a.type==="OLT_PON")a.type="OLT";a.port_count=Math.max(1,Number(a.port_count)||(a.type==="OLT"?16:1));if(a.type==="OLT")a.olt_ports=Array.from({length:a.port_count},(_,i)=>({port_number:i+1,code:`${a.code}-P${i+1}`,status:"AVAILABLE"}))});db.links=db.links||[];db.cables=db.cables||[];db.cables.forEach(c=>{c.fromPort=Math.max(1,Number(c.fromPort)||1);c.toPort=Math.max(1,Number(c.toPort)||1)});db.cores=db.cores||[];db.coreConnections=db.coreConnections||[];db.splitters=db.splitters||[];db.splitterConnections=db.splitterConnections||[];db.splitterOutputs=db.splitterOutputs||[];
function normalizeDb(){
  const existing=new Map(db.cores.map(c=>[(c.cable_id||"")+":"+c.core_number,c]));
  for(const cable of db.cables){
    const count=Math.max(1,Number(cable.fiber_count)||1);
    for(let n=1;n<=count;n++){
      const key=cable.id+":"+n;
      if(!existing.has(key))db.cores.push({id:crypto.randomUUID(),cable_id:cable.id,core_number:n,status:"AVAILABLE"});
    }
  }
  db.splitters=(db.splitters||[]).filter(s=>db.assets.some(a=>a.id===s.nodeId)&&["ODC_ODP","ODC","ODP"].includes(db.assets.find(a=>a.id===s.nodeId)?.type)&&["1:2","1:4","1:8","1:16","1:32","1:64"].includes(s.ratio));
  db.splitters.forEach(s=>{if(db.assets.find(a=>a.id===s.nodeId)?.type==="ODP")s.ratio="1:8";s.stage=Math.max(1,Number(s.stage)||1)});
  const splitterIds=new Set(db.splitters.map(s=>s.id));
  const cableIds=new Set(db.cables.map(c=>c.id));
  const coreIds=new Set(db.cores.map(c=>c.id));
  db.splitterOutputs=db.splitterOutputs.filter(x=>splitterIds.has(x.splitterId)&&cableIds.has(x.cableId)&&coreIds.has(x.coreId));
  db.splitterConnections=db.splitterConnections.filter(x=>splitterIds.has(x.fromSplitterId)&&splitterIds.has(x.toSplitterId)&&db.assets.some(a=>a.id===x.nodeId));
  db.coreConnections=db.coreConnections.filter(x=>cableIds.has(x.inputCableId)&&cableIds.has(x.outputCableId)&&coreIds.has(x.inputCoreId)&&coreIds.has(x.outputCoreId)&&db.assets.some(a=>a.id===x.nodeId));
}
function normalizeOltPorts(){for(const a of db.assets.filter(x=>x.type==="OLT")){const n=Math.max(1,Number(a.port_count)||16);a.port_count=n;a.olt_ports=Array.from({length:n},(_,i)=>a.olt_ports?.[i]||({port_number:i+1,code:`${a.code}-P${i+1}`,status:"AVAILABLE"}))}}
normalizeOltPorts();
normalizeDb();
const $=id=>document.getElementById(id), save=()=>localStorage.setItem(KEY,JSON.stringify(db));
function wireNavigation(){document.querySelectorAll("[data-scroll]").forEach(b=>b.onclick=()=>document.querySelector(b.dataset.scroll)?.scrollIntoView({behavior:"smooth",block:"start"}));document.querySelectorAll(".sidebar nav a[href]").forEach(a=>a.onclick=()=>{document.querySelectorAll(".sidebar nav a").forEach(x=>x.classList.remove("active"));a.classList.add("active")})}

const esc=v=>String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
function options(list,value,empty="— Tidak ada —"){return '<option value="">'+empty+'</option>'+list.map(x=>'<option value="'+esc(x.id)+'" '+(x.id===value?"selected":"")+'>'+esc(x.code||x.name||x.id)+'</option>').join("")}
function render(){wireNavigation();renderStats();renderTopologyMap();renderCondition();renderAssets();renderCustomers();renderCores();renderCables();renderOltPorts();renderConnections();renderSplitters();renderSplitterConnections();renderOpticalAnalyzer();renderUsers()}
function nodeOptions(value=""){return '<option value="">— Pilih node —</option>'+db.assets.map(a=>'<option value="'+esc(a.id)+'" '+(a.id===value?"selected":"")+'>'+esc(a.code)+' — '+esc(a.name)+'</option>').join("")}
function portOptions(nodeId,value=""){const a=db.assets.find(x=>x.id===nodeId);const count=Math.max(1,Number(a?.port_count)||(a?.type==="OLT"?16:1));return Array.from({length:count},(_,i)=>{const n=i+1;return `<option value="${n}" ${String(n)===String(value)?"selected":""}>Port ${n}</option>`}).join("")} function syncCablePorts(){$("cableFromPort").innerHTML=portOptions($("cableFrom").value,$("cableFromPort").value);$("cableToPort").innerHTML=portOptions($("cableTo").value,$("cableToPort").value)} function openCable(c){c=c||{};$("cableId").value=c.id||"";$("cableCode").value=c.code||"";$("cableFrom").innerHTML=nodeOptions(c.from);$("cableTo").innerHTML=nodeOptions(c.to);$("cableFiberCount").value=c.fiber_count||12;$("cableLength").value=c.length_m||0;$("cableStatus").value=c.status||"ACTIVE";syncCablePorts();$("cableDialog").showModal()}
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
function renderCables(){const byId=Object.fromEntries(db.assets.map(a=>[a.id,a]));const endpoint=(id,port)=>{const a=byId[id];return esc(a?.code||"?")+(port?(" · "+(a?.type==="OLT"?"P":"Port ")+esc(port)):"")};$("cableList").innerHTML='<div class="cable-grid">'+(db.cables||[]).map(c=>'<div class="cable-card"><div><b>'+esc(c.code)+'</b><span class="badge">'+esc(c.fiber_count)+' CORE</span></div><div class="route"><strong>'+endpoint(c.from,c.fromPort)+'</strong><span>→</span><strong>'+endpoint(c.to,c.toPort)+'</strong></div><div class="muted">'+esc(c.length_m)+' m · '+esc(c.status)+'</div><div class="cable-actions"><button data-cable-edit="'+esc(c.id)+'">Edit</button><button class="danger" data-cable-del="'+esc(c.id)+'">Hapus</button></div></div>').join("")+'</div>'}

function renderOltPorts(){const olts=db.assets.filter(a=>a.type==="OLT");const cables=db.cables||[];const used=new Map();for(const c of cables){if(c.from)used.set(c.from+"|"+c.fromPort,c);if(c.to)used.set(c.to+"|"+c.toPort,c)}$("oltPorts").innerHTML=olts.map(olt=>'<div class="olt-port-group"><div class="panel-head"><div><h3>'+esc(olt.code)+' — '+esc(olt.name)+'</h3><span class="muted">'+esc(olt.port_count||0)+' port</span></div></div><div class="port-grid">'+Array.from({length:Math.max(1,Number(olt.port_count)||1)},(_,i)=>{const n=i+1,p=olt.olt_ports?.[i]||{port_number:n,code:olt.code+"-P"+n,status:"AVAILABLE"},c=used.get(olt.id+"|"+n);return '<div class="port-card '+(c?"used":"available")+'"><b>Port '+n+'</b><span>'+esc(p.code)+'</span><small>'+esc(c?c.code:"AVAILABLE")+'</small></div>'}).join("")+'</div></div>').join("")||'<p class="muted">Belum ada OLT.</p>'}
function renderStats(){const counts=Object.fromEntries(topology.map(t=>[t,db.assets.filter(a=>a.type===t).length]));$("stats").innerHTML=topology.map(t=>'<div class="stat"><b>'+counts[t]+'</b><span>'+typeLabel(t)+'</span></div>').join("")+'<div class="stat"><b>'+db.cores.length+'</b><span>CORES</span></div>'}
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
  const color={OLT:"#1c9bff",OTB:"#7bdff2",JB:"#ff9f2d",ODC_ODP:"#d58cff",ODC:"#b47cff",ODP:"#25cddd",CUSTOMER:"#ffd052"};
  const lines=edges.map(e=>{const a=pos.get(e.from),b=pos.get(e.to);if(!a||!b)return"";return'<line x1="'+a.x+'" y1="'+a.y+'" x2="'+b.x+'" y2="'+b.y+'" stroke="'+(e.kind==="SERVICE"?"#ffd052":"#20b9ff")+'" stroke-width="3" opacity=".9"/>'}).join("");
  const nodes=assets.map(a=>{const p=pos.get(a.id),c=color[a.type]||"#8aa5b8";return'<g><rect x="'+(p.x-48)+'" y="'+(p.y-27)+'" width="96" height="54" rx="9" fill="#0d3450" stroke="'+c+'" stroke-width="2"/><text x="'+p.x+'" y="'+(p.y-4)+'" fill="#e7f0f8" text-anchor="middle" font-size="11" font-weight="700">'+esc(typeLabel(a.type))+'</text><text x="'+p.x+'" y="'+(p.y+13)+'" fill="#a8bfd0" text-anchor="middle" font-size="9">'+esc(a.code)+'</text></g>'}).join("");
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
function renderAssets(){const q=$("search").value.toLowerCase();const a=db.assets.filter(x=>(x.code+" "+x.name+" "+x.type).toLowerCase().includes(q));$("assets").innerHTML=a.map(x=>'<div class="row"><div><b>'+esc(x.code)+'</b><div class="muted">'+esc(typeLabel(x.type))+' · '+esc(x.name)+'</div></div><span class="badge">'+esc(x.status)+'</span><div><button data-edit="'+esc(x.id)+'">Edit</button> <button class="danger" data-del="'+esc(x.id)+'">Hapus</button></div></div>').join("")||'<p class="muted">Tidak ada asset.</p>'}
function renderCustomers(){const html=db.assets.filter(x=>x.type==="CUSTOMER").map(x=>'<option value="'+esc(x.id)+'">'+esc(x.code)+' — '+esc(x.name)+'</option>').join("");$("customerSelect").innerHTML=html;$("optCustomer").innerHTML='<option value="">— Pilih customer route —</option>'+html}
function renderCores(){const cables=Object.fromEntries(db.cables.map(c=>[c.id,c]));$("cores").innerHTML='<table class="table"><thead><tr><th>Cable</th><th>Core</th><th>Status</th><th>Length</th></tr></thead><tbody>'+db.cores.map(c=>'<tr><td>'+esc(cables[c.cable_id]?.code||"-")+'</td><td>'+c.core_number+'</td><td><span class="badge">'+esc(c.status)+'</span></td><td>'+esc(cables[c.cable_id]?.length_m||"-")+' m</td></tr>').join("")+'</tbody></table>'}
function openAsset(a){a=a||{};$("assetId").value=a.id||"";$("assetType").value=a.type||"OLT";$("assetCode").value=a.code||"";$("assetName").value=a.name||"";$("assetPortCount").value=a.port_count||16;$("assetStatus").value=a.status||"ACTIVE";$("dialogTitle").textContent=a.id?"Edit Asset":"Tambah Asset";$("assetDialog").showModal()}
$("addAsset").onclick=()=>openAsset();$("addCable").onclick=()=>openCable();$("cableFrom").onchange=syncCablePorts;$("cableTo").onchange=syncCablePorts;$("search").oninput=renderAssets;
$("assetForm").onsubmit=e=>{e.preventDefault();const id=$("assetId").value||crypto.randomUUID(),type=$("assetType").value,existing=db.assets.find(a=>a.id===id),portCount=Math.max(1,Number($("assetPortCount").value||1));const item={id,type,code:$("assetCode").value.trim(),name:$("assetName").value.trim(),status:$("assetStatus").value,port_count:portCount};if(type==="OLT"){item.olt_ports=Array.from({length:portCount},(_,i)=>existing?.olt_ports?.[i]||({port_number:i+1,code:item.code+"-P"+(i+1),status:"AVAILABLE"}))}if(!item.code||!item.name){alert("Kode dan nama asset wajib diisi.");return}const i=db.assets.findIndex(a=>a.id===id);if(i>=0)db.assets[i]=item;else db.assets.push(item);save();$("assetDialog").close();render()};
$("assets").onclick=e=>{const edit=e.target.dataset.edit,del=e.target.dataset.del;if(edit)openAsset(db.assets.find(a=>a.id===edit));if(del&&confirm("Hapus asset ini?")){const removed=new Set(db.cables.filter(x=>x.from===del||x.to===del).map(x=>x.id));db.assets=db.assets.filter(a=>a.id!==del);db.links=(db.links||[]).filter(x=>x.from!==del&&x.to!==del);db.cables=db.cables.filter(x=>!removed.has(x.id));db.cores=db.cores.filter(x=>!removed.has(x.cable_id));db.coreConnections=(db.coreConnections||[]).filter(x=>x.nodeId!==del&&!removed.has(x.inputCableId)&&!removed.has(x.outputCableId));save();render()}};
$("traceBtn").onclick=()=>{const customer=db.assets.find(a=>a.id===$("customerSelect").value),olt=db.assets.find(a=>a.type==="OLT");if(!customer){$("traceOutput").textContent="Belum ada customer.";return}const result=coreTrace(db,olt?.id,customer.id),errors=validateGraph(db).errors,nl=String.fromCharCode(10);if(result.found){const byId=Object.fromEntries(db.assets.map(a=>[a.id,a])),cables=Object.fromEntries(db.cables.map(x=>[x.id,x])),total=result.steps.filter(s=>s.kind==="CABLE").reduce((n,s)=>n+(Number(cables[s.cableId]?.length_m)||0),0),coreNumber=id=>db.cores.find(c=>c.id===id)?.core_number,details=result.steps.map(s=>{if(s.kind==="CABLE"){const c=cables[s.cableId]||{};return "KABEL "+(c.code||s.cableId)+" · Port "+s.fromPort+" → Port "+s.toPort+" · Core "+coreNumber(s.coreId)}if(["SPLICE","PASS_THROUGH","TERMINATION"].includes(s.kind))return "MAPPING Core "+(coreNumber(s.inputCoreId)||"?")+" → Core "+(coreNumber(s.outputCoreId)||coreNumber(s.coreId)||"?");if(s.kind==="SPLITTER_OUTPUT")return "SPLITTER "+s.splitterId+" Port "+s.outputPort+" → Core "+coreNumber(s.coreId);return s.kind}).join(" → ");$("traceOutput").textContent=result.path.map((id,i)=>(i+1)+". "+byId[id]?.type+": "+byId[id]?.code+" — "+byId[id]?.name).join(nl)+nl+nl+"CONTINUITY: "+details+nl+"TOTAL CABLE: "+total+" m";return}const fallback=shortestTrace(db,olt?.id,customer.id);if(!fallback.found){$("traceOutput").textContent="PATH TIDAK DITEMUKAN."+nl+(errors.length?"Validasi:"+nl+errors.join(nl):"Periksa kabel dan continuity core.");return}$("traceOutput").textContent="Node path ditemukan, tetapi continuity core belum lengkap."+nl+nl+fallback.path.map((x,i)=>(i+1)+". "+x.type+": "+x.code+" — "+x.name).join(nl)+nl+nl+"Tambahkan mapping Core Continuity pada setiap node/closure yang dilewati.";};
$("cableForm").onsubmit=e=>{e.preventDefault();const id=$("cableId").value||crypto.randomUUID(),from=$("cableFrom").value,to=$("cableTo").value,count=Math.max(1,Number($("cableFiberCount").value||1));if(!from||!to||from===to){alert("Node asal dan tujuan harus berbeda.");return}const item={id,code:$("cableCode").value.trim(),fiber_count:count,length_m:Number($("cableLength").value||0),from,to,fromPort:Number($("cableFromPort").value||1),toPort:Number($("cableToPort").value||1),status:$("cableStatus").value};const i=db.cables.findIndex(c=>c.id===id);if(i>=0){db.cables[i]=item;db.coreConnections=(db.coreConnections||[]).filter(x=>x.inputCableId!==id&&x.outputCableId!==id);db.cores=db.cores.filter(c=>c.cable_id!==id)}else db.cables.push(item);for(let n=1;n<=count;n++)db.cores.push({id:crypto.randomUUID(),cable_id:id,core_number:n,status:"AVAILABLE"});save();$("cableDialog").close();render()};
$("connectionNode").onchange=()=>fillConnectionCables($("connectionNode").value);$("connectionInputCable").onchange=()=>fillCore("connectionInputCore","",$("connectionInputCable").value);$("connectionOutputCable").onchange=()=>fillCore("connectionOutputCore","",$("connectionOutputCable").value);
$("connectionForm").onsubmit=e=>{e.preventDefault();const id=$("connectionId").value||crypto.randomUUID(),x={id,nodeId:$("connectionNode").value,inputCableId:$("connectionInputCable").value,inputCoreId:$("connectionInputCore").value,outputCableId:$("connectionOutputCable").value,outputCoreId:$("connectionOutputCore").value,connectionType:$("connectionType").value,status:$("connectionStatus").value};if(!x.nodeId||!x.inputCableId||!x.inputCoreId||!x.outputCableId||!x.outputCoreId){alert("Node, kabel, dan core wajib diisi.");return}const validCore=(coreId,cableId)=>db.cores.some(core=>core.id===coreId&&core.cable_id===cableId);const atNode=c=>c&&(c.from===x.nodeId||c.to===x.nodeId);const inputCable=db.cables.find(c=>c.id===x.inputCableId),outputCable=db.cables.find(c=>c.id===x.outputCableId);if(!atNode(inputCable)||!atNode(outputCable)){alert("Kedua kabel harus terhubung ke node/closure yang dipilih.");return}if(x.inputCableId===x.outputCableId){alert("Kabel masuk dan keluar harus berbeda untuk mapping continuity.");return}if(!validCore(x.inputCoreId,x.inputCableId)||!validCore(x.outputCoreId,x.outputCableId)){alert("Core tidak sesuai dengan kabel.");return}const i=db.coreConnections.findIndex(v=>v.id===id);if(i>=0)db.coreConnections[i]=x;else db.coreConnections.push(x);save();$("connectionDialog").close();render()};
$("connectionList").onclick=e=>{const edit=e.target.dataset.connEdit,del=e.target.dataset.connDel;if(edit)openConnection(db.coreConnections.find(x=>x.id===edit));if(del&&confirm("Hapus mapping core ini?")){db.coreConnections=db.coreConnections.filter(x=>x.id!==del);save();render()}};
$("addConnection").onclick=()=>openConnection();
$("cableList").onclick=e=>{const edit=e.target.dataset.cableEdit,del=e.target.dataset.cableDel;if(edit)openCable(db.cables.find(c=>c.id===edit));if(del&&confirm("Hapus kabel dan seluruh core kabel ini?")){db.cables=db.cables.filter(c=>c.id!==del);db.cores=db.cores.filter(c=>c.cable_id!==del);db.coreConnections=(db.coreConnections||[]).filter(x=>x.inputCableId!==del&&x.outputCableId!==del);save();render()}};
$("resetDemo").onclick=()=>{if(confirm("Hapus seluruh data jaringan di browser? Semua data akan dihapus dan tidak dapat dipulihkan.")){db=emptyDb();save();render()}};
function splitterLoss(ratio){const n=Number(String(ratio).split(":")[1])||1;return 10*Math.log10(n)}
function splitterAllowed(type){return type==="ODC_ODP"||type==="ODC"||type==="ODP"}
function renderSplitterConnections(){
  const byId=Object.fromEntries(db.splitters.map(s=>[s.id,s]));
  const nodes=Object.fromEntries(db.assets.map(a=>[a.id,a]));
  $("splitterConnectionList").innerHTML=(db.splitterConnections||[]).map(x=>{
    const a=byId[x.fromSplitterId],b=byId[x.toSplitterId];
    return '<div class="cable-card"><div><b>'+esc(nodes[x.nodeId]?.code||x.nodeId)+'</b><span class="badge">INTERNAL PATCH</span></div><div class="muted">'+esc(a?.id||x.fromSplitterId)+' · Port '+esc(x.fromPort)+' → '+esc(b?.id||x.toSplitterId)+' · INPUT</div><div class="cable-actions"><button class="danger" data-splitter-conn-del="'+esc(x.id)+'">Hapus</button></div></div>';
  }).join("")||'<p class="muted">Belum ada koneksi internal antar splitter.</p>';
}
function splitterOptions(nodeId,value=""){
  return '<option value="">— Pilih splitter —</option>'+db.splitters.filter(s=>s.nodeId===nodeId).sort((x,y)=>(x.stage||0)-(y.stage||0)).map(s=>'<option value="'+esc(s.id)+'" '+(s.id===value?"selected":"")+'>'+esc(s.id)+' · '+esc(s.ratio)+' · Stage '+esc(s.stage)+'</option>').join("");
}
function openSplitterConnection(x={}){
  $("splitterConnectionId").value=x.id||"";
  $("splitterConnectionNode").innerHTML=nodeOptions(x.nodeId||"");
  $("splitterConnectionFrom").innerHTML=splitterOptions(x.nodeId||"",x.fromSplitterId||"");
  $("splitterConnectionTo").innerHTML=splitterOptions(x.nodeId||"",x.toSplitterId||"");
  $("splitterConnectionPort").value=x.fromPort||1;
  $("splitterConnectionToPort").value=x.toPort||"INPUT";
  $("splitterConnectionDialog").showModal();
}
function renderSplitters(){
  const byId=Object.fromEntries(db.assets.map(a=>[a.id,a]));
  const groups=new Map();
  (db.splitters||[]).forEach(s=>{if(!groups.has(s.nodeId))groups.set(s.nodeId,[]);groups.get(s.nodeId).push(s)});
  $("splitterList").innerHTML=[...groups.entries()].map(([nodeId,list])=>{
    const a=byId[nodeId]; const total=list.reduce((n,s)=>n+splitterLoss(s.ratio),0);
    return '<div class="splitter-card"><div><b>'+esc(a?.code||nodeId)+'</b><span class="badge">'+esc(a?.type||"")+'</span></div>'+
      '<div class="splitter-chain">'+list.sort((x,y)=>(x.stage||0)-(y.stage||0)).map(s=>'<span>'+esc(s.ratio)+' <small>Stage '+esc(s.stage||1)+'</small> <em>'+splitterLoss(s.ratio).toFixed(2)+' dB</em></span>').join('<b>→</b>')+
      '</div><div class="muted">Total theoretical splitter loss: '+total.toFixed(2)+' dB · '+list.length+' splitter</div>'+
      '<div class="cable-actions">'+list.map(s=>'<button class="danger" data-splitter-del="'+esc(s.id)+'">Hapus</button>').join('')+'</div></div>'
  }).join('')||'<p class="muted">Belum ada konfigurasi splitter.</p>';
}
function fillSplitterNodes(value=""){
  $("splitterNode").innerHTML='<option value="">— Pilih ODC-ODP / ODC / ODP —</option>'+
    db.assets.filter(a=>splitterAllowed(a.type)).map(a=>'<option value="'+esc(a.id)+'" '+(a.id===value?"selected":"")+'>'+esc(a.code)+' — '+esc(a.type)+'</option>').join('');
}
function openSplitter(s={}){
  $("splitterId").value=s.id||"";
  fillSplitterNodes(s.nodeId||"");
  $("splitterRatio").value=s.ratio||"1:4";
  $("splitterStage").value=s.stage||1;
  $("splitterHint").textContent=s.nodeId&&db.assets.find(a=>a.id===s.nodeId)?.type==="ODP"?"ODP hanya menggunakan 1:8.":"ODC-ODP dan ODC dapat memiliki beberapa splitter dan beberapa stage.";
  $("splitterDialog").showModal();
}
$("addSplitter").onclick=()=>openSplitter();
$("splitterNode").onchange=()=>{
  const type=db.assets.find(a=>a.id===$("splitterNode").value)?.type;
  if(type==="ODP"){$("splitterRatio").value="1:8";$("splitterRatio").disabled=true}else $("splitterRatio").disabled=false;
  $("splitterHint").textContent=type==="ODP"?"ODP hanya menggunakan splitter 1:8.":"BOX ODC-ODP dan BOX ODC dapat memakai beberapa splitter.";
};
$("splitterForm").onsubmit=e=>{
  e.preventDefault();
  const id=$("splitterId").value||crypto.randomUUID(),nodeId=$("splitterNode").value,ratio=$("splitterRatio").value,stage=Math.max(1,Number($("splitterStage").value)||1),node=db.assets.find(a=>a.id===nodeId);
  if(!node||!splitterAllowed(node.type)){alert("Splitter hanya dapat dipasang pada ODC-ODP, ODC, atau ODP.");return}
  if(node.type==="ODP"&&ratio!=="1:8"){alert("ODP wajib menggunakan splitter 1:8.");return}
  const item={id,nodeId,ratio,stage};
  const i=db.splitters.findIndex(x=>x.id===id);if(i>=0)db.splitters[i]=item;else db.splitters.push(item);
  save();$("splitterDialog").close();render();
};
$("splitterConnectionNode").onchange=()=>{
  const n=$("splitterConnectionNode").value;
  $("splitterConnectionFrom").innerHTML=splitterOptions(n);
  $("splitterConnectionTo").innerHTML=splitterOptions(n);
};
$("splitterConnectionForm").onsubmit=e=>{
  e.preventDefault();
  const id=$("splitterConnectionId").value||crypto.randomUUID(),nodeId=$("splitterConnectionNode").value,fromSplitterId=$("splitterConnectionFrom").value,toSplitterId=$("splitterConnectionTo").value,fromPort=Math.max(1,Number($("splitterConnectionPort").value)||1),toPort=$("splitterConnectionToPort").value||"INPUT";
  const from=db.splitters.find(s=>s.id===fromSplitterId),to=db.splitters.find(s=>s.id===toSplitterId);
  if(!nodeId||!from||!to||from.id===to.id){alert("Node dan dua splitter berbeda wajib dipilih.");return}
  const maxPort=Number(String(from.ratio).split(":")[1])||0;
  if(fromPort>maxPort){alert("Port output melebihi kapasitas splitter.");return}
  const item={id,nodeId,fromSplitterId,fromPort,toSplitterId,toPort};
  const i=(db.splitterConnections||[]).findIndex(x=>x.id===id);
  if(i>=0)db.splitterConnections[i]=item;else db.splitterConnections.push(item);
  const target=db.splitters.find(s=>s.id===toSplitterId);if(target){target.inputType="SPLITTER";target.inputSplitterId=fromSplitterId;target.inputPort=fromPort}
  save();$("splitterConnectionDialog").close();render();
};
$("splitterConnectionList").onclick=e=>{
  const id=e.target.dataset.splitterConnDel;
  if(id&&confirm("Hapus koneksi internal splitter ini?")){db.splitterConnections=db.splitterConnections.filter(x=>x.id!==id);save();render()}
};
$("addSplitterConnection").onclick=()=>openSplitterConnection();
$("splitterList").onclick=e=>{
  const id=e.target.dataset.splitterDel;
  if(id&&confirm("Hapus splitter ini?")){db.splitters=db.splitters.filter(s=>s.id!==id);save();render()}
};

$("optCustomer").onchange=()=>{ $("customerSelect").value=$("optCustomer").value; renderOpticalAnalyzer(); };
$("customerSelect").onchange=()=>{ $("optCustomer").value=$("customerSelect").value; renderOpticalAnalyzer(); };
["optWavelength","optAttenuation","optConnectorCount","optConnectorLoss","optSpliceCount","optSpliceLoss","optMargin","optBudget"].forEach(id=>$(id).oninput=renderOpticalAnalyzer);
$("optWavelength").onchange=()=>{ const defaults={1310:"0.35",1490:"0.30",1550:"0.22"}; if($("optAttenuation").value===""||Number($("optAttenuation").value)===0)$("optAttenuation").value=defaults[$("optWavelength").value]||"0.35"; renderOpticalAnalyzer(); };

function renderOpticalAnalyzer(){
  const wavelength=Number($("optWavelength")?.value||1310);
  const wavelengthDefaults={1310:0.35,1490:0.30,1550:0.22};
  const selectedAttenuation=Math.max(0,Number($("optAttenuation")?.value||wavelengthDefaults[wavelength]||0));
  const attenuation=selectedAttenuation;
  const connectorCount=Math.max(0,Number($("optConnectorCount")?.value||0));
  const connectorLoss=Math.max(0,Number($("optConnectorLoss")?.value||0));
  const spliceLoss=Math.max(0,Number($("optSpliceLoss")?.value||0));
  const margin=Math.max(0,Number($("optMargin")?.value||0));
  const budget=Math.max(0,Number($("optBudget")?.value||0));
  const customerId=$("optCustomer")?.value||"";
  const olt=db.assets.find(a=>a.type==="OLT");
  const trace=customerId&&olt?coreTrace(db,olt.id,customerId):{found:false,steps:[],path:[]};
  const cables=Object.fromEntries((db.cables||[]).map(c=>[c.id,c]));
  const distance=trace.found?trace.steps.filter(s=>s.kind==="CABLE").reduce((sum,s)=>sum+(Number(cables[s.cableId]?.length_m)||0),0)/1000:0;
  const fiberLoss=distance*attenuation;
  const spliceCount=trace.found?trace.steps.filter(s=>["SPLICE","PASS_THROUGH"].includes(s.kind)).length:Math.max(0,Number($("optSpliceCount")?.value||0));
  const connectorTotal=connectorCount*connectorLoss;
  const spliceTotal=spliceCount*spliceLoss;
  const splitterSteps=trace.found?trace.steps.filter(s=>s.kind==="SPLITTER"||s.kind==="SPLITTER_OUTPUT"):[]; 
  const splitterTotal=splitterSteps.reduce((sum,s)=>sum+splitterLoss((db.splitters||[]).find(x=>x.id===s.splitterId)?.ratio),0);
  const total=fiberLoss+connectorTotal+spliceTotal+splitterTotal;
  const designTotal=total+margin;
  const within=designTotal<=budget;
  if($("opticalResult")) $("opticalResult").innerHTML=
    '<div><span>Wavelength</span><b>'+wavelength+' nm</b></div>'+
    '<div><span>Route Status</span><b>'+(trace.found?"FOUND":"SELECT CUSTOMER")+'</b></div>'+
    '<div><span>Fiber Distance</span><b>'+distance.toFixed(2)+' km</b></div>'+
    '<div><span>Fiber Attenuation Loss</span><b>'+fiberLoss.toFixed(2)+' dB</b></div>'+
    '<div><span>Connector Loss</span><b>'+connectorTotal.toFixed(2)+' dB</b></div>'+
    '<div><span>Splice Loss</span><b>'+spliceTotal.toFixed(2)+' dB ('+spliceCount+' event)</b></div>'+
    '<div><span>Splitter Loss</span><b>'+splitterTotal.toFixed(2)+' dB ('+splitterSteps.length+' event)</b></div>'+
    '<div><span>Engineering Margin</span><b>'+margin.toFixed(2)+' dB</b></div>'+
    '<div class="total"><span>Design Loss</span><b>'+designTotal.toFixed(2)+' dB / '+budget.toFixed(2)+' dB</b></div>';
  if($("lossVerdict")){$("lossVerdict").textContent=trace.found?(within?"Within Budget":"Over Budget"):"Route Required";$("lossVerdict").className="badge "+(trace.found?(within?"success":"danger"):"")}
}


if(!initAuth()) throw new Error("AUTH_REQUIRED");
render();
