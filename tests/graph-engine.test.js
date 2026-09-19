import {shortestTrace,coreTrace,validateGraph} from "../app/graph-engine.js";

const db={
 assets:[
  {id:"olt",type:"OLT"},{id:"pon",type:"PON"},{id:"otb",type:"OTB"},{id:"obt",type:"OBT"},
  {id:"jb1",type:"JB"},{id:"jb2",type:"JB"},{id:"odc",type:"ODC"},{id:"odp",type:"ODP"},{id:"cust",type:"CUSTOMER"}
 ],
 logicalLinks:[{id:"pon-link",from:"olt",to:"pon",kind:"PON"}],
 links:[{id:"service",from:"odp",to:"cust",kind:"SERVICE"}],
 cables:[
  {id:"c1",code:"PON-OTB-24C",from:"pon",to:"otb",fiber_count:24,length_m:100},
  {id:"c2",code:"OTB-OBT-12C",from:"otb",to:"obt",fiber_count:12,length_m:50},
  {id:"c3",code:"OBT-JB1-24C",from:"obt",to:"jb1",fiber_count:24,length_m:200},
  {id:"c4",code:"JB1-JB2-48C",from:"jb1",to:"jb2",fiber_count:48,length_m:300},
  {id:"c5",code:"JB2-ODC-12C",from:"jb2",to:"odc",fiber_count:12,length_m:250},
  {id:"c6",code:"ODC-ODP-24C",from:"odc",to:"odp",fiber_count:24,length_m:150}
 ],
 cores:[
  {id:"k1",cable_id:"c1",core_number:1},
  {id:"k2",cable_id:"c2",core_number:2},
  {id:"k3",cable_id:"c3",core_number:1},
  {id:"k4",cable_id:"c4",core_number:7},
  {id:"k5",cable_id:"c5",core_number:3},
  {id:"k6",cable_id:"c6",core_number:2}
 ],
 coreConnections:[
  {id:"m1",nodeId:"otb",inputCableId:"c1",inputCoreId:"k1",outputCableId:"c2",outputCoreId:"k2",connectionType:"SPLICE",status:"ACTIVE"},
  {id:"m2",nodeId:"obt",inputCableId:"c2",inputCoreId:"k2",outputCableId:"c3",outputCoreId:"k3",connectionType:"SPLICE",status:"ACTIVE"},
  {id:"m3",nodeId:"jb1",inputCableId:"c3",inputCoreId:"k3",outputCableId:"c4",outputCoreId:"k4",connectionType:"SPLICE",status:"ACTIVE"},
  {id:"m4",nodeId:"jb2",inputCableId:"c4",inputCoreId:"k4",outputCableId:"c5",outputCoreId:"k5",connectionType:"SPLICE",status:"ACTIVE"},
  {id:"m5",nodeId:"odc",inputCableId:"c5",inputCoreId:"k5",outputCableId:"c6",outputCoreId:"k6",connectionType:"SPLICE",status:"ACTIVE"}
 ],
 splices:[]
};

const r=shortestTrace(db,"olt","cust");
if(!r.found||r.path.length!==9)throw new Error("Node trace with logical PON link failed");

const trace=coreTrace(db,"olt","cust");
if(!trace.found)throw new Error("Core trace failed");
const mapping=trace.steps.filter(s=>s.kind==="SPLICE");
if(mapping.length!==5)throw new Error("Expected five core mappings");
if(mapping[0].inputCoreId!=="k1"||mapping[0].outputCoreId!=="k2")throw new Error("24C Core 1 -> 12C Core 2 mapping failed");
if(mapping[2].outputCoreId!=="k4")throw new Error("JB mapping to 48C core failed");
if(!trace.corePath.includes("k2")||!trace.corePath.includes("k4"))throw new Error("Core path did not preserve core transitions");

if(!validateGraph(db).valid)throw new Error("Valid heterogeneous core graph rejected");

const invalid=structuredClone(db);
invalid.coreConnections[0].outputCoreId="k1";
if(validateGraph(invalid).valid)throw new Error("Invalid cable/core ownership was accepted");

console.log("graph-engine tests passed");
