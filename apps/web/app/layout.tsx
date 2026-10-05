import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata={title:"Dasmon Imigrasi",description:"Professional immigration service data platform"};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="id"><body>{children}</body></html>}