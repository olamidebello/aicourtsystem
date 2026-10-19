import './globals.css';
export const metadata={metadataBase:new URL('https://www.justisolve.com'),title:'JustiSolve',description:'JustiSolve — Intelligent Solutions. Fairer Justice. AI-assisted court, litigation, evidence and legal case management',icons:{icon:'/justisolve-logo.png',apple:'/justisolve-logo.png'},openGraph:{title:'JustiSolve',description:'Intelligent Solutions. Fairer Justice.',images:['/justisolve-logo.png']}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
