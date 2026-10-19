// Run after npm run build: node --test test/pacer.cjs. No live PACER calls.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const axios=require('axios');
const {PacerController}=require('../dist/routes/pacer.controller');
test('PACER credentials, charge authorization, token rotation and disconnect',async()=>{
 const original=axios.default.post;const calls=[];
 axios.default.post=async(url,body,options)=>{calls.push({url,body,options});if(url.endsWith('cso-auth'))return {data:{loginResult:'0',nextGenCSO:'secret'},headers:{}};if(url.endsWith('cso-logout'))return {data:{loginResult:'0'},headers:{}};return {headers:{'x-next-gen-cso':'rotated'},data:{content:[{caseId:12,courtId:'txedc',caseLink:'https://evil.example/doc'},{caseId:13,caseLink:'https://ecf.txed.uscourts.gov/cgi-bin/iqquerymenu.pl?13'}],receipt:{searchFee:'.10'},pageInfo:{last:true}}};};
 try{const c=new PacerController();await assert.rejects(c.connect({}),/required/);const s=await c.connect({loginId:'user',password:'password',otpCode:'123456'});assert.equal(JSON.stringify(s).includes('secret'),false);const auth='Bearer '+s.session;
 await assert.rejects(c.search(auth,{caseTitle:'Bello'}),/charges/);assert.equal(calls.length,1);
 await assert.rejects(c.search(auth,{acceptCharges:true}),/number or case title/);assert.equal(calls.length,1);
 const r=await c.search(auth,{caseTitle:'Bello',acceptCharges:true});assert.equal(r.content[0].caseLink,'');assert.match(r.content[1].caseLink,/uscourts.gov/);assert.equal(r.receipt.searchFee,'.10');
 await c.search(auth,{caseTitle:'Bello',acceptCharges:true,page:1});assert.equal(calls[2].options.headers['X-NEXT-GEN-CSO'],'rotated');assert.equal(calls[1].options.maxRedirects,0);
 await c.disconnect(auth);await assert.rejects(c.search(auth,{caseTitle:'Bello',acceptCharges:true}),/Connect/);
 }finally{axios.default.post=original;}
});
test('QA selection and upstream failures do not expose credentials',async()=>{
 const original=axios.default.post;axios.default.post=async()=>{throw new Error('password=should-not-leak');};try{const c=new PacerController();await assert.rejects(c.connect({loginId:'u',password:'p',environment:'qa'}),e=>!e.message.includes('should-not-leak')&&e.message.includes('PACER request failed'));}finally{axios.default.post=original;}
});
