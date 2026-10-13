import { Metadata } from 'next';
import Link from 'next/link';
import { Layers, Library, Sparkles } from 'lucide-react';
import { ModelSelector } from '@/components/ModelSelector';
import { NavLink } from '@/components/NavLink';
import './globals.css';

export const metadata: Metadata = {
  title: 'Octa AI Activity Platform',
  description: 'AI-powered activity generation platform for Octa Kids.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-[#ECEFFE] text-slate-900 min-h-screen flex flex-col">
        <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-6 h-[60px] flex items-center justify-between">

            {/* Left: Logo + Nav */}
            <div className="flex items-center gap-6">
              <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                <div className="w-8 h-8 rounded-lg bg-[#5B50F5] flex items-center justify-center flex-shrink-0">
                  {/* Grid icon */}
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="1" y="1" width="6" height="6" rx="1.5" fill="white"/>
                    <rect x="9" y="1" width="6" height="6" rx="1.5" fill="white" fillOpacity="0.6"/>
                    <rect x="1" y="9" width="6" height="6" rx="1.5" fill="white" fillOpacity="0.6"/>
                    <rect x="9" y="9" width="6" height="6" rx="1.5" fill="white"/>
                  </svg>
                </div>
                <span className="text-[15px] font-bold tracking-tight text-slate-900">OCTA AI</span>
              </Link>

              <nav className="hidden md:flex items-center gap-1">
                <NavLink href="/topics/generate" icon={<Sparkles className="w-3.5 h-3.5" />} label="Topic Generation" />
                <NavLink href="/topics/library" icon={<Library className="w-3.5 h-3.5" />} label="Topic Library" />
                <NavLink href="/activities" exact icon={<Layers className="w-3.5 h-3.5" />} label="Activity Generation" />
                <NavLink href="/activities/library" icon={<Library className="w-3.5 h-3.5" />} label="Activity Library" />
              </nav>
            </div>

            {/* Right: Model selector + Avatar */}
            <div className="flex items-center gap-3">
              <ModelSelector />
              <div className="h-8 w-8 rounded-full bg-[#ECEFFE] flex items-center justify-center text-[#5B50F5] font-bold text-sm border border-[#d4d0fc]">
                A
              </div>
            </div>

          </div>
        </header>

        <main className="flex-1 w-full max-w-6xl mx-auto py-10 px-6">
          {children}
        </main>
      </body>
    </html>
  );
}
