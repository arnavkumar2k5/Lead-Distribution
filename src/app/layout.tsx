import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Link from "next/link";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "LeadFlow — Lead Distribution System",
  description: "Automated lead distribution for service providers",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-950 text-gray-100 min-h-screen`}>
        <nav className="border-b border-gray-800 bg-gray-900/80 backdrop-blur sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 flex items-center gap-6 h-14">
            <Link href="/" className="font-bold text-white text-lg tracking-tight">
              LeadFlow
            </Link>
            <div className="flex items-center gap-1 text-sm">
              <NavLink href="/dashboard">Dashboard</NavLink>
              <NavLink href="/request-service">Request Service</NavLink>
              <NavLink href="/test-tools">Test Tools</NavLink>
            </div>
          </div>
        </nav>
        <main className="max-w-7xl mx-auto px-4 py-8">{children}</main>
      </body>
    </html>
  );
}


function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="px-3 py-1.5 rounded-md text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
    >
      {children}
    </Link>
  );
}
