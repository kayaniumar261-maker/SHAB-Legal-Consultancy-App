export type SalesEntry = { earned_on: string; kind: 'closing' | 'sourcing' | 'agreement' | 'advance'; basis: number; paid: boolean; reference: string; id: string };
export type SalesRates = {monthly_salary:number;closing_rate:number;sourcing_rate:number;agreement_fee:number;opening_month:string|null;opening_balance:number};
export const cents = (n:number) => Math.round((Number(n) + Number.EPSILON)*100);
export const monthIndex = (m:string) => Number(m.slice(0,4))*12+Number(m.slice(5,7))-1;
export const commission = (e:SalesEntry,r:SalesRates) => e.kind==='advance'?0:e.kind==='agreement'?cents(r.agreement_fee):Math.round(cents(e.basis)*Math.round((e.kind==='closing'?r.closing_rate:r.sourcing_rate)*10000)/10000);
export function reconcile(month:string,entries:SalesEntry[],rates:SalesRates) {
 const start=rates.opening_month?.slice(0,7)??month;
 const valid=entries.filter(e=>e.earned_on>=(rates.opening_month??month+'-01'));
 const rows=valid.filter(e=>e.earned_on.startsWith(month+'-'));
 const opening=cents(rates.opening_balance)+Math.max(0,monthIndex(month)-monthIndex(start)-1)*cents(rates.monthly_salary)+valid.filter(e=>e.earned_on<month+'-01').reduce((n,e)=>n+(e.kind==='advance'?-cents(e.basis):e.paid?0:commission(e,rates)),0);
 const salary=month<=start?0:cents(rates.monthly_salary);
 const earned=rows.reduce((n,e)=>n+commission(e,rates),0);
 const advances=rows.reduce((n,e)=>n+(e.kind==='advance'?cents(e.basis):0),0);
 const paid=rows.reduce((n,e)=>n+(e.paid?commission(e,rates):0),0);
 const closing=opening+salary+earned-advances-paid;
 return {opening,salary,earned,advances,paid,closing,amounts:[Math.max(0,opening),Math.max(0,-opening),salary,earned,advances,paid,Math.max(0,closing),Math.max(0,-closing)]};
}
