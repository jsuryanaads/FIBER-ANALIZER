// Minimal topology integrity checks for the Phase 1 model.
// Run in a JS test runner once the application build pipeline is established.
export function validateTopology(db){
 const errors=[];
 const ids=new Set(db.assets.map(a=>a.id));
 for(const c of db.cables){
  if(!ids.has(c.from)||!ids.has(c.to)) errors.push(`Cable ${c.code}: endpoint missing`);
  if(c.from===c.to) errors.push(`Cable ${c.code}: self-loop is not allowed`);
  if(c.fiber_count<=0) errors.push(`Cable ${c.code}: fiber_count must be > 0`);
 }
 const seen=new Set();
 for(const c of db.cores){
  const key=`${c.cable_id}:${c.core_number}`;
  if(seen.has(key)) errors.push(`Duplicate core ${key}`);
  seen.add(key);
 }
 return {valid:errors.length===0,errors};
}

const sample={assets:[{id:"a"},{id:"b"}],cables:[{id:"c1",code:"C1",from:"a",to:"b",fiber_count:12}],cores:[{id:"k1",cable_id:"c1",core_number:1}]};
const result=validateTopology(sample);if(!result.valid)throw new Error(result.errors.join("; "));console.log("topology integrity test passed");
