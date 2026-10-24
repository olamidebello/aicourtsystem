// Platform credential-review policy; not a statement of each jurisdiction's law.
export function licenseProfession(role:string):string|null{
 if(/^representation_[1-8]$/.test(role)||/^prosecution_[1-6]$/.test(role)||role==='prosecution_9'||role==='chambers_2'||['international_2','international_3','international_5','oversight_2','oversight_3'].includes(role))return 'attorney';
 if(role==='investigation_8')return 'physician';
 if(['investigation_10','investigation_11'].includes(role))return 'mental_health';
 return null;
}
export const LICENSE_ROLE_IDS=['chambers_2',...Array.from({length:8},(_,i)=>'representation_'+(i+1)),...Array.from({length:6},(_,i)=>'prosecution_'+(i+1)),'prosecution_9','international_2','international_3','international_5','oversight_2','oversight_3','investigation_8','investigation_10','investigation_11'];
export const CREDENTIAL_ACCESS="(r.role_id NOT IN ('"+LICENSE_ROLE_IDS.join("','")+"') OR r.license_valid_until>now())";
