const {createClient}=window.supabase||{};
if(typeof createClient!=="function") throw new Error("Supabase client library gagal dimuat");
import {SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY} from "./supabase-config.js";
const supabase=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{
  auth:{
    persistSession:true,
    autoRefreshToken:true,
    detectSessionInUrl:true,
    storageKey:"fiber-analyzer-auth"
  }
});
import {shortestTrace,coreTrace,validateGraph} from "./graph-engine.js";
const APP_BASE="/FIBER-ANALIZER";
const route=path=>APP_BASE+path;
const $=id=>document.getElementById(id);
const ROLE_PERMISSIONS={
  ADMINISTRATOR:["*","user.manage","system.reset","settings.manage"],
  PENGELOLA:["dashboard.read","network.read","network.write","customer.read","customer.write","analysis.use","incident.read","incident.write","workorder.read","workorder.write","report.read"],
  TEKNISI:["dashboard.read","network.read","customer.read","analysis.use","incident.read","incident.write","workorder.read","workorder.write"]
};
let currentUser=null;
let currentProfile=null;
const portalRole=()=>{const p=location.pathname.replace(/\/+$/,"")||"/";return ({"/admin/login":"ADMINISTRATOR","/pengelola/login":"PENGELOLA","/teknisi/login":"TEKNISI"}[p.replace(APP_BASE,"")]||"")};
const portalLabel=role=>({ADMINISTRATOR:"Administrator",PENGELOLA:"Pengelola",TEKNISI:"Teknisi"}[role]||"Portal");
const roleCan=permission=>!!currentProfile&&((ROLE_PERMISSIONS[currentProfile.role]||[]).includes("*")||(ROLE_PERMISSIONS[currentProfile.role]||[]).includes(permission));
const canManageUsers=()=>currentProfile?.role==="ADMINISTRATOR";

async function loadProfile(){
  // Restore the persisted Supabase session before reading the profile.
  // GitHub Pages reloads must not turn an authenticated user back into the portal selector.
  const {data:{session},error:sessionError}=await supabase.auth.getSession();
  if(sessionError) throw sessionError;
  const user=session?.user||null;
  currentUser=user||null;
  if(!user){currentProfile=null;return null}
  const {data,error}=await supabase.from("profiles").select("id,organization_id,role,name,username,active").eq("id",user.id).maybeSingle();
  if(error) throw error;
  if(!data && portalRole()==="ADMINISTRATOR"){
    const {data:boot,error:bootError}=await supabase.functions.invoke("bootstrap-admin");
    if(bootError) throw bootError;
    currentProfile=boot?.profile||boot;
  }else currentProfile=data||null;
  return currentProfile;
}

function showAuth(error="",register=false){
  const body=$("authBody"), pathRole=portalRole();
  if(!body)return;
  const role=pathRole||"";
  const title=role?portalLabel(role)+" Login":"Pilih Portal Login";
  if(!role){
    body.innerHTML='<h2>Secure Access</h2><p>Pilih portal sesuai akun Anda.</p><div class="portal-grid"><a class="portal-card" href="/FIBER-ANALIZER/admin/login"><b>Administrator</b><span>Manajemen sistem & user</span></a><a class="portal-card" href="/FIBER-ANALIZER/pengelola/login"><b>Pengelola</b><span>Operasional jaringan</span></a><a class="portal-card" href="/FIBER-ANALIZER/teknisi/login"><b>Teknisi</b><span>Lapangan & maintenance</span></a></div>';
    return;
  }
  const isAdmin=role==="ADMINISTRATOR";
  body.innerHTML=register&&isAdmin
    ? '<h2>Daftar Administrator</h2><p>Akun Administrator pertama membuat organisasi baru.</p><form id="registerForm"><label>Email<input id="registerEmail" type="email" required autocomplete="email"></label><label>Nama<input id="registerName" required></label><label>Username<input id="registerUsername" required autocomplete="username"></label><label>Organisasi<input id="registerOrg" required></label><label>Password<input id="registerPass" type="password" minlength="8" required autocomplete="new-password"></label><label>Konfirmasi Password<input id="registerPass2" type="password" minlength="8" required autocomplete="new-password"></label><button>Daftar Administrator</button></form><button id="backLogin" class="ghost">Kembali ke Login</button><div id="authError">'+esc(error)+'</div>'
    : '<h2>'+title+'</h2><p>Login menggunakan email dan password Supabase Auth.</p><form id="loginForm"><label>Email<input id="loginEmail" type="email" required autocomplete="email"></label><label>Password<input id="loginPass" type="password" required autocomplete="current-password"></label><button>Masuk sebagai '+portalLabel(role)+'</button></form>'+(isAdmin?'<button id="registerLink" class="ghost">Daftar Administrator Baru</button>':'')+'<div id="authError">'+esc(error)+'</div>';
  if($("registerForm"))$("registerForm").onsubmit=async e=>{
    e.preventDefault();const email=$("registerEmail").value.trim(),name=$("registerName").value.trim(),username=$("registerUsername").value.trim(),org=$("registerOrg").value.trim(),pass=$("registerPass").value;
    if(pass!==$("registerPass2").value)return showAuth("Konfirmasi password tidak sama.",true);
    const {data,error}=await supabase.auth.signUp({email,password:pass,options:{data:{name,username,organization_name:org},emailRedirectTo:location.origin+APP_BASE+"/admin/login"}});
    if(error){
      // Supabase can occasionally persist the Auth user even when the sign-up
      // request returns a generic database error. Verify that edge case without
      // storing the password: a successful sign-in or an "email not confirmed"
      // response proves the account already exists.
      const {data:recovery,error:recoveryError}=await supabase.auth.signInWithPassword({email,password:pass});
      if(!recoveryError&&recovery?.session){
        try{await loadProfile();location.href=route("/");return}catch(err){return showAuth(err.message,true)}
      }
      if(recoveryError?.message==="Email not confirmed"){
        return showAuth("Akun Administrator sudah dibuat tetapi email belum dikonfirmasi. Periksa inbox/spam, konfirmasi email, lalu login di /admin/login.",false);
      }
      return showAuth(error.message,true);
    }
    if(data.session){try{await loadProfile();location.href=route("/")}catch(err){showAuth(err.message,true)}}else showAuth("Pendaftaran berhasil. Periksa email untuk konfirmasi, lalu login di /admin/login.",false);
  };
  if($("backLogin"))$("backLogin").onclick=()=>showAuth("");
  if($("registerLink"))$("registerLink").onclick=()=>showAuth("",true);
  if($("loginForm"))$("loginForm").onsubmit=async e=>{
    e.preventDefault();
    const {data,error}=await supabase.auth.signInWithPassword({email:$("loginEmail").value.trim(),password:$("loginPass").value});
    if(error)return showAuth(error.message);
    try{
      const profile=await loadProfile();
      if(!profile||!profile.active)throw new Error("Akun belum diaktifkan atau profil organisasi belum tersedia.");
      if(profile.role!==role){await supabase.auth.signOut();return showAuth("Akun ini terdaftar sebagai "+portalLabel(profile.role)+". Gunakan portal yang sesuai.");}
      location.href=route("/");
    }catch(err){await supabase.auth.signOut();showAuth(err.message)}
  };
}

async function initAuth(){
  // Render the portal/login UI before any network request. This prevents the
  // GitHub Pages shell from remaining on "Memuat sistem autentikasi..." when
  // Supabase is slow, blocked, or temporarily unavailable.
  $("authScreen").style.display="grid";
  showAuth();

  const timeout=(promise,ms)=>Promise.race([
    promise,
    new Promise((_,reject)=>setTimeout(()=>reject(new Error("Timeout koneksi autentikasi ("+Math.round(ms/1000)+" detik).")),ms))
  ]);

  try{
    let lastError=null;
    for(let attempt=1;attempt<=3&&!currentProfile;attempt++){
      try{
        await timeout(loadProfile(),8000);
        if(currentProfile)break;
      }catch(err){
        lastError=err;
        await new Promise(resolve=>setTimeout(resolve,500*attempt));
      }
    }
    // Give the auth client one refresh cycle when a persisted session exists.
    if(!currentUser){
      const {data:{session}}=await supabase.auth.getSession();
      currentUser=session?.user||null;
    }
    if(!currentProfile&&lastError)throw lastError;
  }catch(err){
    if(currentUser){
      console.error("Authenticated session restored but profile lookup failed:",err);
      $("authBody").innerHTML='<h2>Sesi Aktif</h2><p>Sesi Supabase berhasil dipulihkan, tetapi profil organisasi belum dapat dibaca.</p><div id="authError">'+esc(err.message||"PROFILE_LOAD_FAILED")+'</div><button id="retryProfile">Coba Lagi</button><button id="retryProfileSignOut" class="ghost">Keluar</button>';
      $("retryProfile").onclick=()=>location.reload();
      $("retryProfileSignOut").onclick=async()=>{await supabase.auth.signOut();location.reload()};
    }else showAuth("Koneksi autentikasi gagal: "+err.message);
    return false;
  }

  if(!currentProfile){
    if(currentUser){
      $("authBody").innerHTML='<h2>Sesi Aktif</h2><p>Akun terautentikasi, tetapi profil aplikasi belum tersedia. Silakan coba lagi.</p><button id="retryProfileOnly">Coba Lagi</button>';
      $("retryProfileOnly").onclick=()=>location.reload();
    }else showAuth();
    return false;
  }

  try{
    await timeout(loadOrganizationState(),8000);
    await timeout(loadCustomers(),8000);
    await timeout(loadOperationalData(),8000);
  }catch(err){
    // A valid Supabase session must never be converted into a login screen
    // merely because an application data request failed during reload.
    // Keep the authenticated state and expose a recoverable application error.
    console.error("Authenticated session restored, but application data failed:",err);
    $("authBody").innerHTML='<h2>Sesi Aktif</h2><p>Login berhasil dipulihkan, tetapi data aplikasi belum dapat dimuat.</p><div id="authError">'+esc(err.message||"DATA_LOAD_FAILED")+'</div><button id="retryAppLoad">Coba Lagi</button><button id="retrySignOut" class="ghost">Keluar</button>';
    $("retryAppLoad").onclick=()=>location.reload();
    $("retrySignOut").onclick=async()=>{await supabase.auth.signOut();location.reload()};
    return false;
  }

  $("authScreen").style.display="none";
  $("userName").textContent=currentProfile.name||currentUser.email;
  $("userRole").textContent=currentProfile.role;
  $("userAvatar").textContent=(currentProfile.name||currentUser.email).slice(0,2).toUpperCase();
  $("logoutBtn").onclick=async()=>{const role=currentProfile?.role;await supabase.auth.signOut();location.href=route(role==="PENGELOLA"?"/pengelola/login":role==="TEKNISI"?"/teknisi/login":"/admin/login")};
  document.querySelectorAll(".admin-only,.admin-nav").forEach(el=>{
    const isAdmin=currentProfile.role==="ADMINISTRATOR";
    el.style.display=isAdmin?(el.classList.contains("admin-nav")?"block":"block"):"none";
  });
  return true;
}
function requirePermission(permission){if(roleCan(permission))return true;alert("Akses ditolak. Role "+(currentProfile?.role||"UNKNOWN")+" tidak memiliki izin ini.");return false}
async function renderUsers(){
  const el=$("userList");if(!el)return;
  if(!canManageUsers()){el.innerHTML='<p class="muted">Akses Administrator diperlukan.</p>';return}
  const {data,error}=await supabase.from("profiles").select("id,name,username,role,active,created_at").eq("organization_id",currentProfile.organization_id).order("created_at");
  if(error){el.innerHTML='<p class="muted">'+esc(error.message)+'</p>';return}
  el.innerHTML=(data||[]).map(u=>'<div class="cable-card"><div><b>'+esc(u.name||u.username||u.id)+'</b><span class="badge">'+esc(u.role)+'</span></div><div class="muted">'+esc(u.username||"")+' · '+(u.active?"ACTIVE":"INACTIVE")+(u.id===currentUser?.id?" · Sesi aktif":"")+'</div><div class="cable-actions">'+(u.id===currentUser?.id?'':'<button data-user-toggle="'+esc(u.id)+'">'+(u.active?"Nonaktifkan":"Aktifkan")+'</button>')+'</div></div>').join("")||'<p class="muted">Belum ada user.</p>';
}
function openUser(u={}){$("userId").value="";$("userUsername").value="";$("userNameInput").value="";$("userRoleInput").value="TEKNISI";$("userActive").value="true";$("userPassword").value="";$("userDialogTitle").textContent="Undang User";$("userDialog").showModal()}
$("addUser")?.addEventListener("click",()=>{if(requirePermission("user.manage"))openUser()});
$("userForm")?.addEventListener("submit",async e=>{
  e.preventDefault();if(!requirePermission("user.manage"))return;
  const name=$("userNameInput").value.trim(),username=$("userUsername").value.trim(),role=$("userRoleInput").value,email=$("userEmail")?.value.trim()||"";
  if(!email||!name||!["PENGELOLA","TEKNISI"].includes(role)){alert("Email, nama, dan role Pengelola/Teknisi wajib diisi.");return}
  const {data,error}=await supabase.functions.invoke("admin-user",{body:{email,name,username,role}});
  if(error){alert(error.message||"Gagal mengundang user.");return}
  $("userDialog").close();renderUsers();
});
$("userList")?.addEventListener("click",async e=>{
  const id=e.target.dataset.userToggle;if(!id||!requirePermission("user.manage"))return;
  const active=e.target.textContent.includes("Nonaktifkan");
  const {error}=await supabase.from("profiles").update({active:!active,updated_at:new Date().toISOString()}).eq("id",id).eq("organization_id",currentProfile.organization_id);
  if(error)alert(error.message);else renderUsers();
});
document.addEventListener("click",e=>{const t=e.target.closest("button,[data-edit],[data-del],[data-cable-edit],[data-cable-del],[data-conn-edit],[data-conn-del],[data-splitter-del],[data-splitter-conn-del]");if(!t)return;const mutating=t.matches("#addAsset,#addCable,#addConnection,#addSplitter,#addSplitterConnection,#resetDemo,[data-edit],[data-del],[data-cable-edit],[data-cable-del],[data-conn-edit],[data-conn-del],[data-splitter-del],[data-splitter-conn-del]");if(mutating&&!roleCan("network.write")){e.preventDefault();e.stopImmediatePropagation();requirePermission("network.write")}},true);
document.addEventListener("submit",e=>{if(e.target.matches("#assetForm,#cableForm,#connectionForm,#splitterForm,#splitterConnectionForm")&&!roleCan("network.write")){e.preventDefault();e.stopImmediatePropagation();requirePermission("network.write")}},true);
const topology=["OLT","OTB","JB","ODC_ODP","ODC","ODP","CUSTOMER"];
const typeLabel=t=>({OLT:"OLT",OTB:"OTB",JB:"JB",ODC_ODP:"BOX ODC-ODP",ODC:"BOX ODC",ODP:"BOX ODP",CUSTOMER:"PELANGGAN"}[t]||t);
const emptyDb=()=>({assets:[],links:[],logicalLinks:[],splices:[],splitterOutputs:[],splitterConnections:[],cables:[],cores:[],splitters:[],coreConnections:[]});
let db=emptyDb();
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
let syncTimer=null;
async function readNetworkState(){
  const org=currentProfile.organization_id;
  const tables=["network_assets","network_cables","network_cores","network_core_connections","network_splitters","network_splitter_outputs","network_splitter_connections","network_links"];
  const results={};
  for(const table of tables){
    const {data,error}=await supabase.from(table).select("*").eq("organization_id",org);
    if(error) throw error;
    results[table]=data||[];
  }
  const assets=results.network_assets.map(x=>({id:x.id,type:x.type,code:x.code,name:x.name,status:x.status,port_count:x.port_count,olt_ports:x.olt_ports||undefined,...(x.extra||{})}));
  const cables=results.network_cables.map(x=>({id:x.id,code:x.code,cable_type:x.cable_type,fiber_count:x.fiber_count,length_m:x.length_m,from:x.from_asset_id,to:x.to_asset_id,fromPort:x.from_port,toPort:x.to_port,status:x.status,condition:x.condition,...(x.extra||{})}));
  const cores=results.network_cores.map(x=>({id:x.id,cable_id:x.cable_id,core_number:x.core_number,color:x.color,status:x.status,attenuation_db_per_km:x.attenuation_db_per_km,notes:x.notes}));
  const coreConnections=results.network_core_connections.map(x=>({id:x.id,nodeId:x.node_id,inputCableId:x.input_cable_id,outputCableId:x.output_cable_id,inputCoreId:x.input_core_id,outputCoreId:x.output_core_id,connectionType:x.connection_type,status:x.status,...(x.extra||{})}));
  const splitters=results.network_splitters.map(x=>({id:x.id,nodeId:x.node_id,ratio:x.ratio,stage:x.stage,inputType:x.input_type,inputSplitterId:x.input_splitter_id,inputPort:x.input_port,...(x.extra||{})}));
  const splitterOutputs=results.network_splitter_outputs.map(x=>({id:x.id,splitterId:x.splitter_id,outputPort:x.output_port,cableId:x.cable_id,coreId:x.core_id}));
  const splitterConnections=results.network_splitter_connections.map(x=>({id:x.id,nodeId:x.node_id,fromSplitterId:x.from_splitter_id,fromPort:x.from_port,toSplitterId:x.to_splitter_id,toPort:x.to_port}));
  const links=results.network_links.filter(x=>x.kind==="SERVICE").map(x=>({id:x.id,from:x.from_asset_id,to:x.to_asset_id,kind:x.kind,...(x.extra||{})}));
  const logicalLinks=results.network_links.filter(x=>x.kind!=="SERVICE").map(x=>({id:x.id,from:x.from_asset_id,to:x.to_asset_id,kind:x.kind,...(x.extra||{})}));
  return {assets,cables,cores,coreConnections,splitters,splitterOutputs,splitterConnections,links,logicalLinks,splices:[],};
}
async function syncNetworkState(){
  if(!currentProfile||!roleCan("network.write")) return;
  const org=currentProfile.organization_id;
  const rows={
    network_assets:(db.assets||[]).map(x=>({id:x.id,organization_id:org,type:x.type,code:x.code,name:x.name,status:x.status||"ACTIVE",port_count:x.port_count||null,olt_ports:x.olt_ports||null,extra:Object.fromEntries(Object.entries(x).filter(([k])=>!["id","type","code","name","status","port_count","olt_ports"].includes(k)))})),
    network_cables:(db.cables||[]).map(x=>({id:x.id,organization_id:org,code:x.code,cable_type:x.cable_type||"FIBER",fiber_count:Number(x.fiber_count)||1,length_m:x.length_m||0,from_asset_id:x.from,to_asset_id:x.to,from_port:x.fromPort||1,to_port:x.toPort||1,status:x.status||"ACTIVE",condition:x.condition||null,extra:{}})),
    network_cores:(db.cores||[]).map(x=>({id:x.id,organization_id:org,cable_id:x.cable_id,core_number:x.core_number,color:x.color||null,status:x.status||"AVAILABLE",attenuation_db_per_km:x.attenuation_db_per_km||null,notes:x.notes||null})),
    network_core_connections:(db.coreConnections||[]).map(x=>({id:x.id,organization_id:org,node_id:x.nodeId,input_cable_id:x.inputCableId,output_cable_id:x.outputCableId,input_core_id:x.inputCoreId,output_core_id:x.outputCoreId,connection_type:x.connectionType||"SPLICE",status:x.status||"ACTIVE",extra:{}})),
    network_splitters:(db.splitters||[]).map(x=>({id:x.id,organization_id:org,node_id:x.nodeId,ratio:x.ratio,stage:x.stage||1,input_type:x.inputType||null,input_splitter_id:x.inputSplitterId||null,input_port:x.inputPort||null,extra:{}})),
    network_splitter_outputs:(db.splitterOutputs||[]).map(x=>({id:x.id,organization_id:org,splitter_id:x.splitterId,output_port:x.outputPort,cable_id:x.cableId,core_id:x.coreId})),
    network_splitter_connections:(db.splitterConnections||[]).map(x=>({id:x.id,organization_id:org,node_id:x.nodeId,from_splitter_id:x.fromSplitterId,from_port:x.fromPort,to_splitter_id:x.toSplitterId,to_port:String(x.toPort||"INPUT")})),
    network_links:[...(db.links||[]),...(db.logicalLinks||[])].map(x=>({id:x.id||crypto.randomUUID(),organization_id:org,from_asset_id:x.from,to_asset_id:x.to,kind:x.kind||"SERVICE",extra:{}}))
  };
  for(const [table,data] of Object.entries(rows)){
    const {data:existing,error:readError}=await supabase.from(table).select("id").eq("organization_id",org);
    if(readError) throw readError;
    const wanted=new Set(data.map(x=>x.id));
    const stale=(existing||[]).map(x=>x.id).filter(id=>!wanted.has(id));
    if(stale.length){const {error}=await supabase.from(table).delete().in("id",stale);if(error)throw error}
    if(data.length){const {error}=await supabase.from(table).upsert(data,{onConflict:"id"});if(error)throw error}
  }
  await supabase.from("network_state").upsert({organization_id:org,state:db,updated_by:currentUser.id,updated_at:new Date().toISOString()});
}
function save(){
  if(!currentProfile)return;
  clearTimeout(syncTimer);
  syncTimer=setTimeout(()=>Promise.all([syncNetworkState(),syncOperationalData(),syncCustomers()]).catch(err=>{
    console.error("Supabase save failed:",err);
    setRealtimeStatus("ERROR",err.message||"Supabase save failed");
  }),150);
}
async function loadOrganizationState(){
  const remote=await readNetworkState();
  db=remote||emptyDb();
  db.assets=db.assets||[];db.cables=db.cables||[];db.cores=db.cores||[];db.coreConnections=db.coreConnections||[];db.splitterOutputs=db.splitterOutputs||[];db.links=db.links||[];db.logicalLinks=db.logicalLinks||[];db.splices=db.splices||[];db.splitters=db.splitters||[];db.splitterConnections=db.splitterConnections||[];
  migrateLegacyTopology();normalizeOltPorts();normalizeDb();
}
function wireNavigation(){
  document.querySelectorAll("[data-scroll]").forEach(b=>b.onclick=()=>document.querySelector(b.dataset.scroll)?.scrollIntoView({behavior:"smooth",block:"start"}));
  document.querySelectorAll(".sidebar nav a[href]").forEach(a=>a.onclick=e=>{
    const target=a.getAttribute("href")||"";
    if(target.startsWith("#")){
      const el=document.querySelector(target);
      if(el){e.preventDefault();history.replaceState(null,"",target);el.scrollIntoView({behavior:"smooth",block:"start"});}
    }
    document.querySelectorAll(".sidebar nav a").forEach(x=>x.classList.remove("active"));
    a.classList.add("active");
  });
}

const esc=v=>String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
function options(list,value,empty="— Tidak ada —"){return '<option value="">'+empty+'</option>'+list.map(x=>'<option value="'+esc(x.id)+'" '+(x.id===value?"selected":"")+'>'+esc(x.code||x.name||x.id)+'</option>').join("")}
function applyPageVisibility(){
  const page=document.body.dataset.page||"dashboard";
  document.querySelectorAll(".page-section").forEach(el=>{el.hidden=true});
  const cls={
    dashboard:"page-dashboard-section",
    topology:"page-topology-section",
    inventory:"page-inventory-section",
    "cable-core":"page-cable-section",
    "trace-analysis":"page-trace-section",
    "optical-analyzer":"page-optical-section",
    incident:"page-incident-section",
    "work-order":"page-workorder-section",
    customer:"page-customer-section",
    reports:"page-reports-section",
    users:"page-users-section",
    settings:"page-settings-section"
  }[page]||"page-dashboard-section";
  document.querySelectorAll("."+cls).forEach(el=>{el.hidden=false});
  const labels={dashboard:"Dashboard",topology:"Topology Map",inventory:"Inventory","cable-core":"Cable & Core","trace-analysis":"Trace & Analysis","optical-analyzer":"Optical Analyzer",incident:"Incident","work-order":"Work Order",customer:"Customer",reports:"Reports",users:"Manajemen User",settings:"Settings"};
  const label=labels[page]||"Dashboard";
  const crumb=document.querySelector(".crumb b");if(crumb)crumb.textContent=label;
  document.title="FIBER-ANALYZER — "+label;
  document.querySelectorAll(".sidebar nav a").forEach(a=>{
    const href=a.getAttribute("href")||"";
    a.classList.toggle("active",href.includes("./"+page+".html") || (page==="dashboard"&&href.includes("./index.html")));
  });
}
function ensureOperationalUI(){
  // Operational dialogs live in the shared JS so every role page has the same
  // CRUD surface, even though the repository keeps lightweight HTML shells.
  if(!$("incidentDialog")){
    document.body.insertAdjacentHTML("beforeend",`<dialog id="incidentDialog"><form method="dialog" id="incidentForm"><h2>Tambah Gangguan</h2><label>Kode<input id="incidentCode" required placeholder="INC-001"></label><label>Judul<input id="incidentTitle" required></label><label>Deskripsi<textarea id="incidentDescription"></textarea></label><div class="form-grid"><label>Prioritas<select id="incidentPriority"><option>LOW</option><option selected>MEDIUM</option><option>HIGH</option><option>CRITICAL</option></select></label><label>Status<select id="incidentStatus"><option>OPEN</option><option>IN_PROGRESS</option><option>RESOLVED</option><option>CLOSED</option></select></label></div><label>Asset<select id="incidentAsset"></select></label><div class="actions"><button value="cancel" class="ghost">Batal</button><button value="default">Simpan</button></div></form></dialog>`);
  }
  if(!$("workOrderDialog")){
    document.body.insertAdjacentHTML("beforeend",`<dialog id="workOrderDialog"><form method="dialog" id="workOrderForm"><h2>Tambah Work Order</h2><label>Kode<input id="workOrderCode" required placeholder="WO-001"></label><label>Judul<input id="workOrderTitle" required></label><label>Deskripsi<textarea id="workOrderDescription"></textarea></label><div class="form-grid"><label>Prioritas<select id="workOrderPriority"><option>LOW</option><option selected>MEDIUM</option><option>HIGH</option><option>CRITICAL</option></select></label><label>Status<select id="workOrderStatus"><option>OPEN</option><option>ASSIGNED</option><option>IN_PROGRESS</option><option>DONE</option><option>CANCELLED</option></select></label></div><label>Asset<select id="workOrderAsset"></select></label><div class="actions"><button value="cancel" class="ghost">Batal</button><button value="default">Simpan</button></div></form></dialog>`);
  }
  if(!$("customerDialog")){
    document.body.insertAdjacentHTML("beforeend",`<dialog id="customerDialog"><form method="dialog" id="customerForm"><h2>Tambah Customer</h2><label>Kode Customer<input id="customerCode" required placeholder="CUST-001"></label><label>Nama<input id="customerName" required></label><label>Alamat<textarea id="customerAddress"></textarea></label><div class="form-grid"><label>Status<select id="customerStatus"><option selected>ACTIVE</option><option>SUSPENDED</option><option>DISCONNECTED</option><option>PROSPECT</option></select></label><label>Paket<input id="customerPackage" placeholder="Internet 20 Mbps"></label></div><label>Keterangan<textarea id="customerNotes"></textarea></label><div class="actions"><button value="cancel" class="ghost">Batal</button><button value="default">Simpan</button></div></form></dialog>`);
  }
  if($("incidentForm")&&!$("incidentId"))$("incidentForm").insertAdjacentHTML("afterbegin",'<input type="hidden" id="incidentId">');
  if($("workOrderForm")&&!$("workOrderId"))$("workOrderForm").insertAdjacentHTML("afterbegin",'<input type="hidden" id="workOrderId">');
  if($("customerForm")&&!$("customerId"))$("customerForm").insertAdjacentHTML("afterbegin",'<input type="hidden" id="customerId">');
  const page=document.body.dataset.page;
  if(page==="incident"&&!$("addIncident")){
    const section=document.querySelector(".page-incident-section");
    if(section){
      section.innerHTML='<div class="panel-head"><div><h2>Gangguan</h2><span class="muted">Incident operasional organisasi</span></div><button id="addIncident" class="ghost">＋ Gangguan</button></div><div id="incidentList" class="incident-grid"></div>';
    }
  }
}
ensureOperationalUI();
function renderIncidents(){
  const el=$("incidentList");if(!el)return;
  const rows=db.incidents||[];
  el.innerHTML=rows.map(x=>'<div><b>'+esc(x.code||x.id)+'</b><span>'+esc(x.title||"Gangguan")+'</span><em class="'+(x.priority==="CRITICAL"||x.priority==="HIGH"?"danger-text":x.status==="CLOSED"?"success-text":"warn-text")+'">'+esc(x.status||"OPEN")+'</em><small class="muted">'+esc(x.description||"")+'</small><div class="cable-actions">'+(roleCan("incident.write")?'<button data-incident-edit="'+esc(x.id)+'">Edit</button><button class="danger" data-incident-del="'+esc(x.id)+'">Hapus</button>':"")+'</div></div>').join("")||'<div><b>Tidak ada gangguan</b><span class="muted">Belum ada incident aktif.</span></div>';
}
function fillOperationalAssetSelect(id){
  const el=$(id);if(!el)return;
  el.innerHTML='<option value="">— Tidak dipilih —</option>'+db.assets.map(x=>'<option value="'+esc(x.id)+'">'+esc(x.code)+' — '+esc(x.name)+'</option>').join("");
}
function openIncident(x={}){
  if(!requirePermission("incident.write"))return;
  $("incidentId").value=x.id||"";
  $("incidentCode").value=x.code||"INC-"+String((db.incidents||[]).length+1).padStart(3,"0");
  $("incidentTitle").value=x.title||"";$("incidentDescription").value=x.description||"";$("incidentPriority").value=x.priority||"MEDIUM";$("incidentStatus").value=x.status||"OPEN";fillOperationalAssetSelect("incidentAsset");$("incidentAsset").value=x.asset_id||"";
  $("incidentDialog").showModal();
}
function openWorkOrder(x={}){
  if(!requirePermission("workorder.write"))return;
  $("workOrderId").value=x.id||"";
  $("workOrderCode").value=x.code||"WO-"+String((db.workOrders||[]).length+1).padStart(3,"0");
  $("workOrderTitle").value=x.title||"";$("workOrderDescription").value=x.description||"";$("workOrderPriority").value=x.priority||"MEDIUM";$("workOrderStatus").value=x.status||"OPEN";fillOperationalAssetSelect("workOrderAsset");$("workOrderAsset").value=x.asset_id||"";
  $("workOrderDialog").showModal();
}
function openCustomer(x={}){
  if(!requirePermission("customer.write"))return;
  $("customerId").value=x.id||"";
  $("customerCode").value=x.code||"CUST-"+String(db.assets.filter(x=>x.type==="CUSTOMER").length+1).padStart(3,"0");
  $("customerName").value=x.name||"";$("customerAddress").value=x.address||"";$("customerStatus").value=x.status||"ACTIVE";$("customerPackage").value=x.package||"";$("customerNotes").value=x.notes||"";$("customerDialog").showModal();
}
$("addIncident")?.addEventListener("click",openIncident);
$("addWorkOrder")?.addEventListener("click",openWorkOrder);
$("addCustomer")?.addEventListener("click",openCustomer);
$("incidentForm")?.addEventListener("submit",async e=>{
  e.preventDefault();if(!requirePermission("incident.write"))return;
  const id=$("incidentId").value||crypto.randomUUID();
  const existing=db.incidents.find(x=>x.id===id);
  const row={id,organization_id:currentProfile.organization_id,code:$("incidentCode").value.trim(),title:$("incidentTitle").value.trim(),description:$("incidentDescription").value.trim()||null,priority:$("incidentPriority").value,status:$("incidentStatus").value,asset_id:$("incidentAsset").value||null,reported_by:existing?.reported_by||currentUser.id,opened_at:existing?.opened_at||new Date().toISOString()};
  const {data,error}=await supabase.from("incidents").upsert(row,{onConflict:"id"}).select("*").single();
  if(error){alert(error.message);return}
  db.incidents=[data,...(db.incidents||[]).filter(x=>x.id!==id)];$("incidentDialog").close();renderIncidents();renderCondition();
});
$("incidentList")?.addEventListener("click",async e=>{
  const edit=e.target.dataset.incidentEdit,del=e.target.dataset.incidentDel;
  if(edit){openIncident(db.incidents.find(x=>x.id===edit));return}
  if(del&&requirePermission("incident.write")&&confirm("Hapus incident ini?")){
    const {error}=await supabase.from("incidents").delete().eq("id",del).eq("organization_id",currentProfile.organization_id);
    if(error){alert(error.message);return}
    db.incidents=db.incidents.filter(x=>x.id!==del);renderIncidents();renderCondition();
  }
});
$("workOrderForm")?.addEventListener("submit",async e=>{
  e.preventDefault();if(!requirePermission("workorder.write"))return;
  const id=$("workOrderId").value||crypto.randomUUID();
  const existing=db.workOrders.find(x=>x.id===id);
  const row={id,organization_id:currentProfile.organization_id,code:$("workOrderCode").value.trim(),title:$("workOrderTitle").value.trim(),description:$("workOrderDescription").value.trim()||null,priority:$("workOrderPriority").value,status:$("workOrderStatus").value,asset_id:$("workOrderAsset").value||null,created_by:existing?.created_by||currentUser.id};
  const {data,error}=await supabase.from("work_orders").upsert(row,{onConflict:"id"}).select("*").single();
  if(error){alert(error.message);return}
  db.workOrders=[data,...(db.workOrders||[]).filter(x=>x.id!==id)];$("workOrderDialog").close();renderWorkOrders();renderCondition();
});
$("workOrderList")?.addEventListener("click",async e=>{
  const edit=e.target.dataset.workOrderEdit,del=e.target.dataset.workOrderDel;
  if(edit){openWorkOrder(db.workOrders.find(x=>x.id===edit));return}
  if(del&&requirePermission("workorder.write")&&confirm("Hapus Work Order ini?")){
    const {error}=await supabase.from("work_orders").delete().eq("id",del).eq("organization_id",currentProfile.organization_id);
    if(error){alert(error.message);return}
    db.workOrders=db.workOrders.filter(x=>x.id!==del);renderWorkOrders();renderCondition();
  }
});
$("customerForm")?.addEventListener("submit",async e=>{
  e.preventDefault();if(!requirePermission("customer.write"))return;
  const id=$("customerId").value||crypto.randomUUID();
  const item={id,type:"CUSTOMER",code:$("customerCode").value.trim(),name:$("customerName").value.trim(),status:$("customerStatus").value,port_count:1,address:$("customerAddress").value.trim(),package:$("customerPackage").value.trim(),notes:$("customerNotes").value.trim()};
  if(!item.code||!item.name){alert("Kode dan nama customer wajib diisi.");return}
  const i=db.assets.findIndex(x=>x.id===id);if(i>=0)db.assets[i]=item;else db.assets.push(item);
  save();$("customerDialog").close();render();
});
function renderWorkOrders(){
  const el=$("workOrderList");if(!el)return;
  const rows=db.workOrders||[];
  el.innerHTML=rows.map(x=>'<div class="cable-card"><div><b>'+esc(x.code||x.id)+'</b><span class="badge">'+esc(x.status||"OPEN")+'</span></div><div class="muted">'+esc(x.title||x.description||"Work Order")+' · '+esc(x.priority||"NORMAL")+'</div><div class="cable-actions">'+(roleCan("workorder.write")?'<button data-work-order-edit="'+esc(x.id)+'">Edit</button><button class="danger" data-work-order-del="'+esc(x.id)+'">Hapus</button>':"")+'</div></div>').join("")||'<p class="muted">Belum ada Work Order.</p>';
}
function renderCustomerPage(){
  const el=$("customerList");if(!el)return;
  const rows=db.assets.filter(x=>x.type==="CUSTOMER");
  el.innerHTML=rows.map(x=>'<div class="cable-card"><div><b>'+esc(x.code)+'</b><span class="badge">'+esc(x.status||"ACTIVE")+'</span></div><div class="muted">'+esc(x.name)+' · Customer</div><div class="cable-actions">'+(roleCan("customer.write")?'<button data-customer-edit="'+esc(x.id)+'">Edit</button><button class="danger" data-customer-del="'+esc(x.id)+'">Hapus</button>':"")+'</div></div>').join("")||'<p class="muted">Belum ada customer.</p>';
}
$("customerList")?.addEventListener("click",e=>{
  const edit=e.target.dataset.customerEdit,del=e.target.dataset.customerDel;
  if(edit){openCustomer(db.assets.find(x=>x.id===edit));return}
  if(del&&requirePermission("customer.write")&&confirm("Hapus customer ini?")){
    db.assets=db.assets.filter(x=>x.id!==del);db.cables=db.cables.filter(x=>x.from!==del&&x.to!==del);db.cores=db.cores.filter(c=>db.cables.some(k=>k.id===c.cable_id));db.coreConnections=(db.coreConnections||[]).filter(x=>x.nodeId!==del);save();render();
  }
});
function renderReports(){
  const el=$("reportSummary");if(!el)return;
  const counts=Object.fromEntries(topology.map(t=>[t,db.assets.filter(a=>a.type===t).length]));
  const items=[["OLT",counts.OLT||0],["OTB",counts.OTB||0],["JB",counts.JB||0],["BOX ODC-ODP",counts.ODC_ODP||0],["BOX ODC",counts.ODC||0],["BOX ODP",counts.ODP||0],["Customer",counts.CUSTOMER||0],["Core",(db.cores||[]).length]];
  el.innerHTML=items.map(([label,value])=>'<div class="stat"><b>'+value+'</b><span>'+esc(label)+'</span></div>').join("");
}
function renderSettings(){
  const el=$("settingsContent");if(!el||!currentProfile)return;
  el.innerHTML='<div class="cable-card"><b>Akun</b><div class="muted">'+esc(currentProfile.name||currentUser?.email||"-")+' · '+esc(currentProfile.role)+'</div></div><div class="cable-card"><b>Organization</b><div class="muted">'+esc(currentProfile.organization_id)+'</div></div><div class="cable-card"><b>Session</b><div class="muted">Supabase Auth · Session tersimpan otomatis</div></div>';
}
function render(){
  wireNavigation();renderStats();renderTopologyMap();renderIncidents();renderCondition();renderAssets();renderCustomers();renderCores();renderCables();renderOltPorts();renderConnections();renderSplitters();renderSplitterConnections();renderOpticalAnalyzer();renderUsers();renderWorkOrders();renderCustomerPage();renderReports();renderSettings();applyPageVisibility();
}
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
async function loadCustomers(){
  if(!currentProfile)return;
  const {data,error}=await supabase.from("customers").select("*").eq("organization_id",currentProfile.organization_id).order("created_at",{ascending:true});
  if(error)throw error;
  const customerRows=data||[];
  const byId=new Map(customerRows.map(x=>[x.id,x]));
  db.assets=(db.assets||[]).filter(x=>x.type!=="CUSTOMER");
  customerRows.forEach(x=>db.assets.push({
    id:x.id,type:"CUSTOMER",code:x.customer_code,name:x.name,status:x.service_status||"PROSPECT",
    port_count:1,address:x.address||"",package:x.package_name||"",notes:x.notes||"",odp_id:x.odp_id||null,odp_port:x.odp_port||null
  }));
}
async function syncCustomers(){
  if(!currentProfile||!roleCan("customer.write"))return;
  const org=currentProfile.organization_id;
  const rows=(db.assets||[]).filter(x=>x.type==="CUSTOMER").map(x=>({
    id:x.id,organization_id:org,customer_code:x.code,name:x.name,address:x.address||null,
    service_status:["ACTIVE","SUSPENDED","DISCONNECTED","PROSPECT"].includes(x.status)?x.status:"PROSPECT",
    odp_id:x.odp_id||null,odp_port:x.odp_port?Number(x.odp_port):null,package_name:x.package||null,notes:x.notes||null
  }));
  const {data:existing,error:e}=await supabase.from("customers").select("id").eq("organization_id",org);
  if(e)throw e;
  const wanted=new Set(rows.map(x=>x.id));
  const stale=(existing||[]).map(x=>x.id).filter(id=>!wanted.has(id));
  if(stale.length){const {error}=await supabase.from("customers").delete().in("id",stale);if(error)throw error}
  if(rows.length){const {error}=await supabase.from("customers").upsert(rows,{onConflict:"id"});if(error)throw error}
}
async function loadOperationalData(){
  if(!currentProfile)return;
  const org=currentProfile.organization_id;
  const [{data:incidents,error:incidentError},{data:workOrders,error:workOrderError}]=await Promise.all([
    supabase.from("incidents").select("*").eq("organization_id",org).order("created_at",{ascending:false}),
    supabase.from("work_orders").select("*").eq("organization_id",org).order("created_at",{ascending:false})
  ]);
  if(incidentError)throw incidentError;
  if(workOrderError)throw workOrderError;
  db.incidents=incidents||[];db.workOrders=workOrders||[];
}
async function syncOperationalData(){
  if(!currentProfile||!roleCan("incident.write"))return;
  const org=currentProfile.organization_id;
  const sync=async(table,key,rows)=>{
    const data=(rows||[]).map(x=>({...x,organization_id:org}));
    const {data:existing,error:e}=await supabase.from(table).select("id").eq("organization_id",org);
    if(e)throw e;
    const wanted=new Set(data.map(x=>x.id));const stale=(existing||[]).map(x=>x.id).filter(id=>!wanted.has(id));
    if(stale.length){const {error}=await supabase.from(table).delete().in("id",stale);if(error)throw error}
    if(data.length){const {error}=await supabase.from(table).upsert(data,{onConflict:"id"});if(error)throw error}
  };
  await sync("incidents","id",db.incidents);await sync("work_orders","id",db.workOrders);
}
let realtimeChannel=null;
let realtimeRefreshTimer=null;
let realtimeStatus="CONNECTING";

function setRealtimeStatus(status,message=""){
  realtimeStatus=status;
  const el=$("realtimeStatus");
  if(!el)return;
  const labels={LIVE:"LIVE",CONNECTING:"CONNECTING",OFFLINE:"OFFLINE",ERROR:"RETRY"};
  el.textContent=labels[status]||status;
  el.className="realtime-status "+String(status).toLowerCase();
  el.title=message||("Supabase Realtime: "+(labels[status]||status));
}

function ensureRealtimeUI(){
  if($("realtimeStatus"))return;
  const host=document.querySelector(".top-actions");
  if(!host)return;
  const el=document.createElement("span");
  el.id="realtimeStatus";
  el.className="realtime-status connecting";
  el.textContent="CONNECTING";
  el.title="Supabase Realtime";
  host.insertBefore(el,host.firstElementChild);
}

async function refreshRealtimeData(){
  if(!currentProfile)return;
  try{
    const [network,operational]=await Promise.all([
      readNetworkState(),
      (async()=>{
        const org=currentProfile.organization_id;
        const [{data:incidents,error:incidentError},{data:workOrders,error:workOrderError}]=await Promise.all([
          supabase.from("incidents").select("*").eq("organization_id",org).order("created_at",{ascending:false}),
          supabase.from("work_orders").select("*").eq("organization_id",org).order("created_at",{ascending:false})
        ]);
        if(incidentError)throw incidentError;
        if(workOrderError)throw workOrderError;
        return {incidents:incidents||[],workOrders:workOrders||[]};
      })()
    ]);
    db={...network,...operational};
    db.assets=db.assets||[];db.cables=db.cables||[];db.cores=db.cores||[];db.coreConnections=db.coreConnections||[];
    db.splitters=db.splitters||[];db.splitterOutputs=db.splitterOutputs||[];db.splitterConnections=db.splitterConnections||[];
    db.links=db.links||[];db.logicalLinks=db.logicalLinks||[];db.splices=db.splices||[];
    normalizeOltPorts();normalizeDb();
    render();
    if(currentProfile.role==="ADMINISTRATOR")renderUsers();
    setRealtimeStatus("LIVE","Data real-time tersinkron.");
  }catch(err){
    console.error("Realtime refresh failed:",err);
    setRealtimeStatus("ERROR",err.message||"Realtime refresh gagal.");
  }
}

function scheduleRealtimeRefresh(){
  clearTimeout(realtimeRefreshTimer);
  realtimeRefreshTimer=setTimeout(()=>refreshRealtimeData(),180);
}

function setupRealtime(){
  ensureRealtimeUI();
  if(!currentProfile)return;
  if(realtimeChannel){
    supabase.removeChannel(realtimeChannel);
    realtimeChannel=null;
  }
  const org=currentProfile.organization_id;
  const tables=["network_assets","network_cables","network_cores","network_core_connections","network_splitters","network_splitter_outputs","network_splitter_connections","network_links","incidents","work_orders","profiles"];
  const channel=supabase.channel("fiber-analyzer-org-"+org);
  tables.forEach(table=>{
    channel.on("postgres_changes",{event:"*",schema:"public",table,filter:"organization_id=eq."+org},scheduleRealtimeRefresh);
  });
  realtimeChannel=channel.subscribe((status,error)=>{
    if(status==="SUBSCRIBED"){
      setRealtimeStatus("LIVE","Supabase Realtime aktif.");
      refreshRealtimeData();
    }else if(status==="CHANNEL_ERROR"||status==="TIMED_OUT"){
      setRealtimeStatus("ERROR",error?.message||"Realtime channel error.");
    }else if(status==="CLOSED"){
      setRealtimeStatus("OFFLINE","Realtime channel ditutup.");
    }else{
      setRealtimeStatus("CONNECTING","Menghubungkan Supabase Realtime...");
    }
  });
  window.addEventListener("online",()=>{
    setRealtimeStatus("CONNECTING","Internet kembali, menghubungkan Realtime...");
    setupRealtime();
  });
  window.addEventListener("offline",()=>setRealtimeStatus("OFFLINE","Browser offline."));
}

function renderCondition(){
  const cores=db.cores||[],total=cores.length,counts={IN_USE:0,AVAILABLE:0,RESERVED:0,DAMAGED:0};
  cores.forEach(c=>{if(counts[c.status]!==undefined)counts[c.status]++;else counts.AVAILABLE++});
  const pct=n=>total?((n/total)*100).toFixed(1):"0.0",used=pct(counts.IN_USE),available=pct(counts.AVAILABLE),reserved=pct(counts.RESERVED),damaged=pct(counts.DAMAGED);
  const p1=Number(used),p2=p1+Number(available),p3=p2+Number(reserved);
  const bg=total?"conic-gradient(#18bd82 0 "+p1+"%,#1688ff "+p1+"% "+p2+"%,#ff9d2d "+p2+"% "+p3+"%,#ef4c58 "+p3+"% 100%)":"#18374f";
  $("coreCondition").innerHTML='<div class="donut" style="background:'+bg+'"><div><b>'+total+'</b><span>Total Core</span></div></div><div class="legend-list"><span><i class="green"></i>Core Terpakai <b>'+used+'%</b></span><span><i class="blue"></i>Core Tersedia <b>'+available+'%</b></span><span><i class="orange"></i>Cadangan <b>'+reserved+'%</b></span><span><i class="red"></i>Core Rusak <b>'+damaged+'%</b></span></div>';
  const customers=(db.assets||[]).filter(x=>x.type==="CUSTOMER"),active=customers.filter(x=>x.status==="ACTIVE").length;
  const incidents=db.incidents||[],openIncidents=incidents.filter(x=>x.status==="OPEN"||x.status==="IN_PROGRESS").length;
  const workOrders=db.workOrders||[],openWorkOrders=workOrders.filter(x=>x.status!=="DONE"&&x.status!=="CANCELLED").length;
  $("serviceStatus").innerHTML='<div class="service"><span>🟢 Pelanggan Aktif</span><b>'+active+'</b></div><div class="service"><span>🔴 Pelanggan Nonaktif</span><b>'+(customers.length-active)+'</b></div><div class="service"><span>⚠ Gangguan Aktif</span><b>'+openIncidents+'</b></div><div class="service"><span>🔧 Work Order Open</span><b>'+openWorkOrders+'</b></div>';
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


(async()=>{
  if(await initAuth()){
    render();
    ensureRealtimeUI();
    setupRealtime();
    const hash=location.hash;
    if(hash){
      requestAnimationFrame(()=>setTimeout(()=>document.querySelector(hash)?.scrollIntoView({behavior:"smooth",block:"start"}),50));
    }
  }
})().catch(err=>{console.error(err);showAuth(err.message||"AUTH_REQUIRED")});
