import fs from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';
const exports = {};
Function('exports',ts.transpile(fs.readFileSync('src/lib/salesAccounting.ts','utf8'),{module:ts.ModuleKind.CommonJS}))(exports);
const {reconcile,commission}=exports;
const rates={monthly_salary:8000,closing_rate:.1,sourcing_rate:.2,agreement_fee:300,opening_month:'2026-09-01',opening_balance:910.85};
const rows=[['2026-09-10','advance',500],['2026-09-10','advance',800],['2026-09-11','advance',1500],['2026-10-01','advance',840],['2026-10-05','advance',500],['2026-10-09','advance',2000],['2026-10-01','sourcing',5000],['2026-11-01','advance',1100],['2026-11-03','advance',1000],['2026-11-05','advance',3380],['2026-11-06','advance',4500],['2026-11-10','advance',600],['2026-11-17','advance',200],['2026-11-02','closing',15000],['2026-11-16','sourcing',5000]].map(([earned_on,kind,basis],i)=>({id:String(i),reference:'Fixture',earned_on,kind,basis,paid:false}));
for(const [month,payable,excess] of [['2026-09',0,188915],['2026-10',377085,0],['2026-11',349085,0]]){
 const r=reconcile(month,rows,rates);assert.equal(r.amounts[6],payable);assert.equal(r.amounts[7],excess);
 const a=r.amounts;assert.equal(a[0]-a[1]+a[2]+a[3]-a[4]-a[5],a[6]-a[7]);
}
assert.equal(reconcile('2026-09',rows,rates).salary,0);
assert.equal(reconcile('2026-12',rows,rates).opening,reconcile('2026-11',rows,rates).closing);
assert.equal(reconcile('2027-01',rows,rates).opening,reconcile('2026-12',rows,rates).closing);
const paid={id:'paid',reference:'Test',earned_on:'2026-10-12',kind:'closing',basis:1000,paid:true};
assert.equal(reconcile('2026-11',[paid],rates).opening,891085);
assert.equal(commission({...paid,basis:.05,paid:false},rates),1);
assert.equal(reconcile('2026-10',rows.filter(r=>r.basis!==840),rates).closing,461085);
assert.equal(reconcile('2026-10',[{...paid,kind:'advance',basis:20000,paid:false}],rates).amounts[6],0);
console.log('Sales accounting passed: monthly identities, signed carry, salary start, year rollover, paid commission, rounding and deletion recalculation.');
