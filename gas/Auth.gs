function getCurrentIdentity_(){return String(Session.getActiveUser().getEmail()||'').trim().toLowerCase();}
function ensureDailyPermissionMigration_(){
  if(typeof PropertiesService==='undefined'||typeof LockService==='undefined'||typeof DEFAULT_ROLES==='undefined')return;
  const props=PropertiesService.getScriptProperties(),flag='INTAL_DAILY_PERMISSIONS_MIGRATED_V1';
  if(props.getProperty(flag)==='true')return;
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try{
    if(props.getProperty(flag)==='true')return;
    const sh=getDb_().getSheetByName(SHEETS.PERMISSIONS);
    const values=sh.getDataRange().getValues(),existing=new Set(values.slice(1).map(r=>String(r[0]||'').trim().toUpperCase()+'|'+String(r[1]||'').trim()));
    const missing=[];
    Object.keys(DEFAULT_ROLES).forEach(role=>DEFAULT_ROLES[role].filter(p=>p.indexOf('daily.')===0).forEach(permission=>{
      const key=role+'|'+permission;if(!existing.has(key))missing.push([role,permission]);
    }));
    if(missing.length)sh.getRange(sh.getLastRow()+1,1,missing.length,2).setValues(missing);
    props.setProperty(flag,'true');
  }finally{lock.releaseLock();}
}
function getRolePermissions_(role){
  const normalized=String(role||'').trim().toUpperCase();
  // Migrate legacy installations once. After the migration flag is set, PERMISSIONS
  // is authoritative, so subsequent revocations are not silently undone.
  ensureDailyPermissionMigration_();
  const sh=getDb_().getSheetByName(SHEETS.PERMISSIONS),v=sh.getDataRange().getValues();
  const assigned=v.slice(1).filter(r=>String(r[0]).trim().toUpperCase()===normalized).map(r=>String(r[1]).trim());
  return Array.from(new Set(assigned));
}
function getCurrentUser_(){
  const email=getCurrentIdentity_(),v=getDb_().getSheetByName(SHEETS.USERS).getDataRange().getValues();
  if(v.length<2)return {authenticated:false,email,role:null,permissions:[]};
  const h=v[0],i=Object.fromEntries(h.map((x,n)=>[x,n]));
  const r=v.slice(1).find(x=>String(x[i.email]).trim().toLowerCase()===email&&String(x[i.status]).toUpperCase()==='ACTIVE');
  if(!r)return {authenticated:false,email,role:null,permissions:[]};
  const role=String(r[i.role]).toUpperCase();
  return {authenticated:true,email,userId:String(r[i.user_id]),displayName:String(r[i.display_name]),role,permissions:getRolePermissions_(role)};
}
const BACKOFFICE_ROLES_ = Object.freeze(['ADMIN','SUPERVISOR']);
function requirePermission_(permission){const u=getCurrentUser_();if(!u.authenticated)throw new Error('UNAUTHENTICATED');if(!u.permissions.includes(permission))throw new Error('FORBIDDEN: '+permission);return u;}
function requireBackOfficeAccess_(){const u=getCurrentUser_();if(!u.authenticated)throw new Error('BACKOFFICE_AUTH_REQUIRED');if(!BACKOFFICE_ROLES_.includes(u.role))throw new Error('BACKOFFICE_ACCESS_DENIED');return u;}
function adminCreateUser(email,displayName,role){requirePermission_('admin.users');email=String(email||'').trim().toLowerCase();role=String(role||'').trim().toUpperCase();if(!email||!DEFAULT_ROLES[role])throw new Error('Email/role tidak valid.');const id=Utilities.getUuid();getDb_().getSheetByName(SHEETS.USERS).appendRow([id,email,String(displayName||email),role,'ACTIVE','','',nowIso_(),nowIso_()]);appendAudit_('USER_CREATE','', '',1,'SUCCESS',JSON.stringify({email,role}));return {ok:true,userId:id};}

function bootstrapAdmin_(email,displayName){
  const ss=getDb_(),sh=ss.getSheetByName(SHEETS.USERS),normalized=String(email||'').trim().toLowerCase();
  if(!normalized||normalized.indexOf('@')<1)throw new Error('Email admin tidak valid.');
  if(sh.getLastRow()>1)throw new Error('Bootstrap admin hanya boleh dijalankan pada USERS yang masih kosong.');
  const id=Utilities.getUuid();sh.appendRow([id,normalized,String(displayName||'Administrator'),'ADMIN','ACTIVE','','',nowIso_(),nowIso_()]);
  return {ok:true,email:normalized,role:'ADMIN',userId:id};
}
