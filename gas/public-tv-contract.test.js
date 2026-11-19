'use strict';
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');

const source=fs.readFileSync(path.join(__dirname,'PublicTvService.gs'),'utf8');
const api=new Function(source+'\nreturn {sanitizePublicTvFilters_,sanitizePublicTvDashboard_,sanitizePublicTvMap_,getPublicTvRunningTexts,getPublicTvAnalyticalRunningTexts,getPublicTvPassportYoYContext,getPublicTvServicePoints};')();

const filters=api.sanitizePublicTvFilters_({
  periode:'2026-11-EXTRA',
  kantor_imigrasi:'X'.repeat(250),
  metric:'Y'.repeat(100),
  email:'attacker@example.com',
  spreadsheetId:'private-sheet'
});
assert.deepEqual(filters,{
  periode:'2026-11-',
  kantor_imigrasi:'X'.repeat(200),
  metric:'Y'.repeat(80)
},'Public TV filters are bounded and only supported fields survive');

const dashboard=api.sanitizePublicTvDashboard_({
  datasetKey:'PASSPORT_SERVICE_MONTHLY',
  rowCount:'80',
  metric:'total',
  grandTotal:'327088',
  monthly:[{periode:'2026-01',total:'10',rows:'2',email:'private@example.com',rawRow:['private']}],
  offices:[{kantor_imigrasi:'KANIM TEST',total:'10',rows:'2',password_hash:'secret'}],
  services:[{key:'elektronik_48',total:'10',no_paspor:'X1234567'}],
  filters:{periode:'2026-01',kantor_imigrasi:'KANIM TEST',metric:'total',availablePeriods:['2026-01'],availableOffices:['KANIM TEST'],userEmail:'private@example.com'},
  users:[{email:'private@example.com'}],
  spreadsheetId:'private-sheet',
  rawRows:[['private']]
});
assert.deepEqual(dashboard,{
  datasetKey:'PASSPORT_SERVICE_MONTHLY',
  rowCount:80,
  metric:'total',
  grandTotal:327088,
  monthly:[{periode:'2026-01',total:10,rows:2}],
  offices:[{kantor_imigrasi:'KANIM TEST',total:10,rows:2}],
  services:[{key:'elektronik_48',total:10}],
  filters:{periode:'2026-01',kantor_imigrasi:'KANIM TEST',metric:'total',availablePeriods:['2026-01'],availableOffices:['KANIM TEST']}
},'Public dashboard projection is an explicit aggregate-only allowlist');

const map=api.sanitizePublicTvMap_({
  datasetKey:'RESIDENCE_PERMIT_SERVICE_MONTHLY',
  rowCount:1,metric:'total',
  filters:{periode:'2026-01',kantor_imigrasi:'KANIM TEST',metric:'total',userEmail:'private@example.com'},
  markers:[{kantor_imigrasi:'KANIM TEST',latitude:-6.9,longitude:107.6,total:12,metricValue:12,rows:1,address:'private address',email:'private@example.com',rawRow:['x']}],
  rawRows:[['x']]
});
assert.deepEqual(map,{
  datasetKey:'RESIDENCE_PERMIT_SERVICE_MONTHLY',
  rowCount:1,metric:'total',
  filters:{periode:'2026-01',kantor_imigrasi:'KANIM TEST',metric:'total'},
  markers:[{kantor_imigrasi:'KANIM TEST',latitude:-6.9,longitude:107.6,total:12,metricValue:12,rows:1}]
},'Public map projection strips unapproved marker and identity fields');

assert.deepEqual(api.getPublicTvRunningTexts(),[],
  'Administrator-authored manual running text remains private by default');

const mockReport={
  totals:{combined:100,residence:40,passport:60,privateIdentity:'must-not-escape'},
  monthly:[{periode:'2026-01',residenceTotal:40,passportTotal:60,combinedTotal:100,rawRows:['private']}],
  offices:[{kantor_imigrasi:'KANIM TEST',residenceTotal:40,passportTotal:60,combinedTotal:100,residenceRows:1,passportRows:1,email:'private@example.com'}]
};
const analyticalApi=new Function('getCrossServiceReporting_',source+
  '\nreturn getPublicTvAnalyticalRunningTexts;')(()=>mockReport);
const narratives=analyticalApi();
assert(narratives.length>0,'Aggregate analytical public narratives are generated');
for(const item of narratives){
  assert.equal(typeof item.text,'string','Narrative exposes text only as content');
  assert.equal(Object.hasOwn(item,'email'),false,'Narrative does not expose identity fields');
  assert.equal(Object.hasOwn(item,'rawRows'),false,'Narrative does not expose raw source rows');
  assert.equal(Object.hasOwn(item,'privateIdentity'),false,'Narrative does not expose private report properties');
}
const officeNarrative=narratives.find(x=>x.type==='office');
assert(officeNarrative&&officeNarrative.rank===1,'Office narrative is ranked from aggregate reporting');
assert.equal(officeNarrative.combined,undefined,'Office narrative does not duplicate internal aggregate objects');

const points=api.getPublicTvServicePoints();
assert.equal(points.readOnly,true);
assert(Array.isArray(points.points)&&points.points.length>0,'Public service-point layer exists');
const allowedPointKeys=new Set(['pointId','parentOffice','pointType','pointTypeLabel','name','location','latitude','longitude','dailyCapacity','boothCount','mapsUrl','hours','status','statusLabel','coordinateStatus','coordinateStatusLabel']);
for(const point of points.points){
  for(const key of Object.keys(point))assert(allowedPointKeys.has(key),'Public service-point projection allowlists '+key);
  assert.equal(Object.hasOwn(point,'email'),false);
  assert.equal(Object.hasOwn(point,'userId'),false);
}
console.log('Public TV projection contract passed: dashboard, map, narratives, manual running text, and GIS service points.');
