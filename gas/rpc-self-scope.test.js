'use strict';

const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');

const source=fs.readFileSync(path.join(__dirname,'Rbac.gs'),'utf8');
const createRbac=new Function('getCurrentUser_',source+'\nreturn {hasPermission,getMyPermissions};');

const unauthenticated={authenticated:false,role:null,permissions:[]};
const unauthRbac=createRbac(()=>unauthenticated);
assert.equal(unauthRbac.hasPermission('admin.config','admin@example.gov.id'),false,
  'Unauthenticated caller cannot claim another user identity to gain a permission');
assert.deepEqual(unauthRbac.getMyPermissions('admin@example.gov.id'),{
  authenticated:false,role:null,permissions:[]
},'Unauthenticated self-scope response contains no role or permissions');

const viewer={authenticated:true,role:'VIEWER',permissions:['dashboard.read','dataset.read']};
const viewerRbac=createRbac(()=>viewer);
assert.equal(viewerRbac.hasPermission('dashboard.read','admin@example.gov.id'),true,
  'Permission lookup is resolved against the server principal, not caller-supplied identity');
assert.equal(viewerRbac.hasPermission('admin.config','admin@example.gov.id'),false,
  'Caller-supplied identity cannot elevate the server principal');
const own=viewerRbac.getMyPermissions('admin@example.gov.id');
assert.deepEqual(own,{
  authenticated:true,role:'VIEWER',permissions:['dashboard.read','dataset.read']
},'Self-scope endpoint returns only the current principal permission projection');
assert.equal(Object.hasOwn(own,'email'),false,'Self-scope response does not disclose email');
assert.equal(Object.hasOwn(own,'userId'),false,'Self-scope response does not disclose internal user ID');

assert.match(source,/function\s+getMyPermissions\s*\(\s*\)/,
  'getMyPermissions accepts no caller-supplied identity argument');
assert.match(source,/function\s+hasPermission\s*\(\s*permission\s*\)/,
  'hasPermission accepts only the permission name, not a target user');

console.log('RPC self-scope contract passed: unauthenticated denial, principal binding, and minimal response projection.');
