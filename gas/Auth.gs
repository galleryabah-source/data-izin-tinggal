function workspaceIdentityEnforcementEnabledV1_(){
  if(typeof PropertiesService==='undefined')return false;
  return PropertiesService.getScriptProperties().getProperty('INTAL_WORKSPACE_IDENTITY_ENFORCEMENT')==='true';
}
function getWorkspaceIdentityV1_(){
  const email=String(Session.getActiveUser().getEmail()||'').trim().toLowerCase();
  if(!email)throw new Error('UNAUTHENTICATED');
  const rawDomains=String(PropertiesService.getScriptProperties().getProperty('INTAL_WORKSPACE_ALLOWED_DOMAINS')||'').trim();
  const domains=rawDomains.split(/[;,\\s]+/).map(x=>x.trim().toLowerCase().replace(/^@/,'')).filter(Boolean);
  if(!domains.length)throw new Error('WORKSPACE_DOMAIN_POLICY_MISSING');
  const at=email.lastIndexOf('@');
  const domain=at>0?email.slice(at+1):'';
  if(!domain||!domains.includes(domain))throw new Error('UNAUTHENTICATED');
  return {email,domain,provider:'GOOGLE_WORKSPACE'};
}
function getCurrentIdentity_(){
  if(workspaceIdentityEnforcementEnabledV1_())return getWorkspaceIdentityV1_().email;
  // Transitional compatibility only until an isolated USER_ACCESSING deployment
  // has passed identity and storage-access tests.
  return String(Session.getActiveUser().getEmail()||'').trim().toLowerCase();
}
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
  const email=getCurrentIdentity_();
  if(!email)throw new Error('UNAUTHENTICATED');
  const v=getDb_().getSheetByName(SHEETS.USERS).getDataRange().getValues();
  if(v.length<2)return {authenticated:false,email,role:null,permissions:[]};
  const h=v[0],i=Object.fromEntries(h.map((x,n)=>[x,n]));
  const matching=v.slice(1).filter(x=>String(x[i.email]||'').trim().toLowerCase()===email);
  if(matching.length>1)throw new Error('UNAUTHENTICATED');
  const r=matching.find(x=>String(x[i.status]).toUpperCase()==='ACTIVE');
  if(!r)return {authenticated:false,email,role:null,permissions:[]};
  const role=String(r[i.role]).toUpperCase();
  return {authenticated:true,email,userId:String(r[i.user_id]),displayName:String(r[i.display_name]),role,permissions:getRolePermissions_(role)};
}
const BACKOFFICE_ROLES_ = Object.freeze(['ADMIN','SUPERVISOR']);
function requirePermission_(permission){const u=getCurrentUser_();if(!u.authenticated)throw new Error('UNAUTHENTICATED');if(!u.permissions.includes(permission))throw new Error('FORBIDDEN: '+permission);return u;}
function requireBackOfficeAccess_(){const u=getCurrentUser_();if(!u.authenticated)throw new Error('BACKOFFICE_AUTH_REQUIRED');if(!BACKOFFICE_ROLES_.includes(u.role))throw new Error('BACKOFFICE_ACCESS_DENIED');return u;}
function adminCreateUser(email,displayName,role){
  requirePermission_('admin.users');
  const normalized=String(email||'').trim().toLowerCase();
  const normalizedRole=String(role||'').trim().toUpperCase();
  const name=String(displayName||normalized).trim();
  if(!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(normalized)||!Object.prototype.hasOwnProperty.call(DEFAULT_ROLES,normalizedRole)||!name){
    throw new Error('Email/nama/role tidak valid.');
  }
  if(name.length>120)throw new Error('Nama pengguna maksimal 120 karakter.');

  const lock=LockService.getScriptLock();
  lock.waitLock(30000);
  try{
    // Re-authorize after acquiring the lock so a permission revocation while
    // waiting cannot be bypassed by an already-started request.
    requirePermission_('admin.users');
    if(workspaceIdentityEnforcementEnabledV1_()){
      const identity=getWorkspaceIdentityV1_();
      const rawDomains=String(PropertiesService.getScriptProperties().getProperty('INTAL_WORKSPACE_ALLOWED_DOMAINS')||'').trim();
      const domains=rawDomains.split(/[;,\\s]+/).map(x=>x.trim().toLowerCase().replace(/^@/,'')).filter(Boolean);
      const targetDomain=normalized.slice(normalized.lastIndexOf('@')+1);
      if(!identity.domain||!domains.includes(targetDomain))throw new Error('WORKSPACE_DOMAIN_NOT_ALLOWED');
    }

    const sh=getDb_().getSheetByName(SHEETS.USERS);
    const values=sh.getDataRange().getValues();
    const headers=values[0]||[];
    const emailIndex=headers.indexOf('email');
    if(emailIndex<0)throw new Error('USERS_SCHEMA_INVALID: email column missing');
    const duplicate=values.slice(1).some(row=>String(row[emailIndex]||'').trim().toLowerCase()===normalized);
    if(duplicate)throw new Error('USER_EMAIL_ALREADY_EXISTS');

    const id=Utilities.getUuid(),now=nowIso_();
    sh.appendRow([id,normalized,name,normalizedRole,'ACTIVE','','',now,now]);
    appendAudit_('USER_CREATE','', '',1,'SUCCESS',JSON.stringify({email:normalized,role:normalizedRole}));
    return {ok:true,userId:id};
  }finally{
    lock.releaseLock();
  }
}

function bootstrapAdmin_(email,displayName){
  const ss=getDb_(),sh=ss.getSheetByName(SHEETS.USERS),normalized=String(email||'').trim().toLowerCase();
  if(!normalized||normalized.indexOf('@')<1)throw new Error('Email admin tidak valid.');
  if(sh.getLastRow()>1)throw new Error('Bootstrap admin hanya boleh dijalankan pada USERS yang masih kosong.');
  const id=Utilities.getUuid();sh.appendRow([id,normalized,String(displayName||'Administrator'),'ADMIN','ACTIVE','','',nowIso_(),nowIso_()]);
  return {ok:true,email:normalized,role:'ADMIN',userId:id};
}
