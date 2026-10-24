import {licenseProfession} from './license-policy';
const groups = [
 {
  "id": "judiciary",
  "label": "Judges and judicial officers",
  "duties": "Review assigned records; prepare hearings; record draft findings and decisions for authorized review",
  "roles": [
   "Chief justice / chief judge",
   "Presiding / administrative judge",
   "Supreme court justice",
   "Constitutional court justice",
   "Appellate judge",
   "Trial judge",
   "Magistrate judge / magistrate",
   "Justice of the peace",
   "Court commissioner / judicial referee",
   "Senior / visiting / temporary judge",
   "Special master",
   "Bankruptcy / insolvency judge",
   "Family court judge",
   "Juvenile court judge",
   "Probate / guardianship judge",
   "Commercial court judge",
   "Tax court judge",
   "Labor / employment judge",
   "Administrative law judge / hearing officer",
   "Immigration judge",
   "Military judge",
   "Treatment / problem-solving court judge",
   "Customary / traditional / religious adjudicator"
  ]
 },
 {
  "id": "chambers",
  "label": "Chambers and legal research",
  "duties": "Research authorities; prepare memoranda; verify citations; coordinate chambers work",
  "roles": [
   "Judicial law clerk",
   "Staff / research attorney",
   "Judicial assistant / chambers secretary",
   "Court research librarian",
   "Opinion editor / reporter of decisions"
  ]
 },
 {
  "id": "registry",
  "label": "Court administration and registry",
  "duties": "Review submissions; maintain procedural records; coordinate calendars and notices",
  "roles": [
   "Court administrator / court executive",
   "Court manager / division manager",
   "Clerk of court / registrar",
   "Deputy clerk",
   "Filing / intake clerk",
   "Docket clerk",
   "Courtroom deputy / courtroom clerk",
   "Case manager / caseflow manager",
   "Calendar / scheduling clerk",
   "Appeals clerk",
   "Records / archives clerk",
   "Exhibits / evidence clerk",
   "Sealed-records officer",
   "Court finance officer / cashier",
   "Jury administrator / jury commissioner",
   "Public counter / information clerk"
  ]
 },
 {
  "id": "courtroom",
  "label": "Recording, language, accessibility and security",
  "duties": "Prepare assigned services; document requests; review accessibility and recording needs; record handovers",
  "roles": [
   "Court reporter / stenographer",
   "Digital recording officer",
   "Transcriptionist",
   "Court interpreter",
   "Legal translator",
   "Sign-language interpreter",
   "Accessibility coordinator",
   "Bailiff",
   "Court security officer",
   "Marshal / sheriff assigned to court",
   "Prisoner transport officer"
  ]
 },
 {
  "id": "prosecution",
  "label": "Prosecution and government lawyers",
  "duties": "Review assigned material; track disclosure; prepare submissions and witness coordination",
  "roles": [
   "Attorney general",
   "Solicitor general / appellate government counsel",
   "Chief prosecutor / district attorney / U.S. attorney",
   "Assistant / trial prosecutor",
   "Special prosecutor / independent counsel",
   "Civil government attorney",
   "Prosecution investigator",
   "Victim-witness coordinator",
   "Disclosure / evidence review attorney"
  ]
 },
 {
  "id": "representation",
  "label": "Lawyers and legal support",
  "duties": "Review client-authorized records; track deadlines; prepare supervised submissions and research",
  "roles": [
   "Public defender",
   "Appointed defense counsel",
   "Retained defense attorney",
   "Plaintiff’s attorney",
   "Civil defense attorney",
   "Appellate attorney",
   "Legal aid attorney",
   "Child’s attorney / attorney ad litem",
   "Guardian ad litem",
   "Paralegal",
   "Legal assistant",
   "Defense / litigation investigator",
   "E-discovery specialist",
   "Litigation support specialist",
   "Court-appointed special advocate"
  ]
 },
 {
  "id": "participants",
  "label": "Parties, jurors and case participants",
  "duties": "Review authorized notices; prepare personal records; track participation tasks and dates",
  "roles": [
   "Criminal defendant / accused person",
   "Plaintiff / claimant",
   "Civil defendant",
   "Petitioner",
   "Respondent",
   "Appellant / cross-appellant",
   "Appellee",
   "Intervenor",
   "Class representative",
   "Amicus curiae",
   "Self-represented litigant",
   "Fact / eyewitness",
   "Expert witness",
   "Records custodian",
   "Petit / trial juror",
   "Alternate juror",
   "Jury foreperson",
   "Grand juror"
  ]
 },
 {
  "id": "investigation",
  "label": "Investigation, evidence and forensics",
  "duties": "Document authorized scope; log source provenance and custody; prepare examination reports for review",
  "roles": [
   "Police officer / investigative agent",
   "Detective / criminal investigator",
   "Crime scene investigator",
   "Evidence custodian",
   "Forensic scientist",
   "Digital forensic examiner",
   "Forensic accountant",
   "Medical examiner / forensic pathologist",
   "Coroner",
   "Forensic psychologist / psychiatrist",
   "Competency evaluator",
   "Process server"
  ]
 },
 {
  "id": "supervision",
  "label": "Pretrial, supervision and corrections",
  "duties": "Record assigned supervision activities; track services and reports; reconcile authorized custody records",
  "roles": [
   "Pretrial services officer",
   "Bail / release assessment officer",
   "Bail bonds agent / surety",
   "Probation officer",
   "Presentence investigator",
   "Parole board member",
   "Parole officer",
   "Warden / prison superintendent",
   "Jail administrator",
   "Correctional / detention officer",
   "Sentence computation / records specialist",
   "Correctional case manager",
   "Reentry coordinator",
   "Restitution / financial supervision specialist"
  ]
 },
 {
  "id": "family",
  "label": "Juvenile, family, probate and support",
  "duties": "Track appointed scope; coordinate services; maintain care or estate reports and review dates",
  "roles": [
   "Juvenile probation officer",
   "Juvenile detention officer",
   "Child welfare caseworker",
   "Custody evaluator / family court adviser",
   "Court social worker",
   "Treatment coordinator",
   "Guardian of the person",
   "Conservator / financial guardian",
   "Executor / personal representative / estate administrator",
   "Probate examiner / investigator",
   "Public guardian"
  ]
 },
 {
  "id": "resolution",
  "label": "Dispute resolution and enforcement",
  "duties": "Document appointment scope; schedule authorized sessions; track agreements, reports and accounting",
  "roles": [
   "Mediator",
   "Arbitrator",
   "Conciliator",
   "Settlement conference officer / judge",
   "Ombudsman",
   "Judgment enforcement officer / bailiff",
   "Receiver",
   "Court-appointed auctioneer",
   "Collections / fines officer"
  ]
 },
 {
  "id": "operations",
  "label": "Technology, finance, facilities and public services",
  "duties": "Track service requests; document changes; review access, continuity and operational reports",
  "roles": [
   "Court IT administrator",
   "Case management systems administrator",
   "E-filing administrator",
   "Cybersecurity specialist",
   "Database administrator",
   "Digital evidence administrator",
   "Audiovisual / remote hearing technician",
   "Data analyst / court statistician",
   "Public information officer",
   "Self-help center staff",
   "Budget / procurement officer",
   "Human resources officer",
   "Facilities manager"
  ]
 },
 {
  "id": "oversight",
  "label": "Oversight, professional regulation and policy",
  "duties": "Track authorized reviews; document findings; prepare recommendations and training follow-up",
  "roles": [
   "Judicial conduct commissioner / council member",
   "Judicial disciplinary counsel / investigator",
   "Attorney disciplinary counsel",
   "Bar admissions officer / examiner",
   "Ethics adviser / officer",
   "Inspector general / internal auditor",
   "Rules committee member",
   "Judicial council / commission member",
   "Judicial educator / training coordinator",
   "Court policy analyst"
  ]
 },
 {
  "id": "international",
  "label": "International courts and tribunals",
  "duties": "Record tribunal and appointment scope; coordinate authorized submissions and cooperation requests",
  "roles": [
   "International judge",
   "International prosecutor",
   "International defense counsel",
   "International registrar",
   "Victims’ legal representative",
   "Witness protection officer",
   "International cooperation / liaison officer"
  ]
 }
];
export const JUSTICE_ROLES = groups.flatMap(g=>g.roles.map((label,i)=>({
 id:g.id+'_'+(i+1),license_profession:licenseProfession(g.id+'_'+(i+1)),label,group:g.id,category:g.label,duties:g.duties,
 workflow:['Confirm jurisdiction and assigned scope','Review authorized source records',
 'Prepare '+label.toLowerCase()+' work product','Submit for human review','Record completion and follow-up']
})));
export function validRole(id:string){return JUSTICE_ROLES.some(r=>r.id===id);}
