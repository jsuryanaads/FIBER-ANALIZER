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
