import {shortestTrace,coreTrace,validateGraph} from "../app/graph-engine.js";

const db={
 assets:[
  {id:"src",type:"OLT_PON"},{id:"otb",type:"OTB"},{id:"jb1",type:"JB"},{id:"jb2",type:"JB"},
  {id:"dist",type:"ODC_ODP"},{id:"odc",type:"ODC"},{id:"odp",type:"ODP"},{id:"cust",type:"CUSTOMER"}
 ],
 logicalLinks:[],
 links:[{id:"service",from:"odp",to:"cust",kind:"SERVICE"}],
 cables:[
  {id:"c1",code:"SRC-OTB-24C",from:"src",to:"otb",fiber_count:24,length_m:100},
  {id:"c2",code:"OTB-JB1-12C",from:"otb",to:"jb1",fiber_count:12,length_m:50},
  {id:"c3",code:"JB1-JB2-48C",from:"jb1",to:"jb2",fiber_count:48,length_m:300},
  {id:"c4",code:"JB2-DIST-12C",from:"jb2",to:"dist",fiber_count:12,length_m:250},
  {id:"c5",code:"DIST-JB2-24C",from:"dist",to:"jb2",fiber_count:24,length_m:80},
  {id:"c6",code:"JB1-ODC-24C",from:"jb1",to:"odc",fiber_count:24,length_m:200},
  {id:"c7",code:"ODC-ODP-12C",from:"odc",to:"odp",fiber_count:12,length_m:150}
 ],
 cores:[
  {id:"k1",cable_id:"c1",core_number:1},{id:"k2",cable_id:"c2",core_number:2},
  {id:"k3",cable_id:"c3",core_number:7},{id:"k4",cable_id:"c4",core_number:3},
  {id:"k5",cable_id:"c5",core_number:9},{id:"k6",cable_id:"c6",core_number:4},
  {id:"k7",cable_id:"c7",core_number:2}
 ],
 coreConnections:[
  {id:"m1",nodeId:"otb",inputCableId:"c1",inputCoreId:"k1",outputCableId:"c2",outputCoreId:"k2",connectionType:"SPLICE",status:"ACTIVE"},
  {id:"m2",nodeId:"jb1",inputCableId:"c2",inputCoreId:"k2",outputCableId:"c3",outputCoreId:"k3",connectionType:"SPLICE",status:"ACTIVE"},
  {id:"m3",nodeId:"jb2",inputCableId:"c3",inputCoreId:"k3",outputCableId:"c4",outputCoreId:"k4",connectionType:"SPLICE",status:"ACTIVE"},
  {id:"m4",nodeId:"dist",inputCableId:"c4",inputCoreId:"k4",outputCableId:"c5",outputCoreId:"k5",connectionType:"SPLICE",status:"ACTIVE"},
  {id:"m5",nodeId:"jb2",inputCableId:"c5",inputCoreId:"k5",outputCableId:"c3",outputCoreId:"k3",connectionType:"SPLICE",status:"SPLICE",status:"ACTIVE"},
  {id:"m6",nodeId:"jb1",inputCableId:"c2",inputCoreId:"k2",outputCableId:"c6",outputCoreId:"k6",connectionType:"SPLICE",status:"ACTIVE"},
  {id:"m7",nodeId:"odc",inputCableId:"c6",inputCoreId:"k6",outputCableId:"c7",outputCoreId:"k7",connectionType:"SPLICE",status:"ACTIVE"}
 ],
 splices:[]
};

const nodePath=shortestTrace(db,"src","cust");
if(!nodePath.found)throw new Error("Flexible node path failed");
const trace=coreTrace(db,"src","cust");
if(!trace.found)throw new Error("Flexible core trace failed");
const mappings=trace.steps.filter(s=>s.kind==="SPLICE");
if(mappings.length<5)throw new Error("Expected core mappings across flexible topology");
if(!mappings.some(x=>x.inputCoreId==="k1"&&x.outputCoreId==="k2"))throw new Error("24C Core 1 -> 12C Core 2 failed");
if(!mappings.some(x=>x.inputCoreId==="k2"&&x.outputCoreId==="k3"))throw new Error("12C -> 48C remap failed");
if(!mappings.some(x=>x.inputCoreId==="k2"&&x.outputCoreId==="k6"))throw new Error("JB branching to ODC failed");
if(!validateGraph(db).valid)throw new Error("Valid flexible graph rejected");

const invalid=structuredClone(db);
invalid.coreConnections[0].outputCoreId="k3";
if(validateGraph(invalid).valid)throw new Error("Invalid core ownership accepted");

console.log("flexible topology tests passed");
