import React, { useState, useEffect } from 'react';
import { Menu, X, ChevronRight, Sun, Moon } from 'lucide-react';

interface NavbarProps {
  onLogin: () => void;
  isLight?: boolean;
  onToggleTheme?: () => void;
}

/** Floating Liquid Glass navigation pill (control layer) — same language as the app. */
export const Navbar: React.FC<NavbarProps> = ({ onLogin, isLight, onToggleTheme }) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = isMobileMenuOpen ? 'hidden' : 'unset';
  }, [isMobileMenuOpen]);

  const scrollToSection = (id: string) => {
    setIsMobileMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const links = [
    { id: 'features-section', label: 'Features' },
    { id: 'why-aastha', mobileId: 'mobile-why-aastha', label: 'Why Aastha' },
    { id: 'faq-section', label: 'FAQ' },
  ];

  return (
    <>
      <nav className="fixed top-0 inset-x-0 z-50 px-3 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
        <div className={`glass rounded-full max-w-6xl mx-auto h-14 flex items-center justify-between pl-2 pr-2 transition-shadow ${isScrolled ? 'shadow-2xl' : ''}`}>
          <button
            className="flex items-center gap-2 h-10 pl-1 pr-3 rounded-full hover:bg-md-on-surface/[0.06]"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            aria-label="Aastha — back to top"
          >
            <img src="/logo.png" alt="" className="w-8 h-8 rounded-[10px] object-cover" />
            <span className="font-serif text-xl text-md-on-surface">Aastha</span>
          </button>

          <div className="hidden md:flex items-center gap-1">
            {links.map((l) => (
              <button key={l.id} onClick={() => scrollToSection(l.id)}
                className="h-10 px-4 rounded-full text-sm font-medium text-md-on-surface-variant hover:text-md-on-surface hover:bg-md-on-surface/[0.06]">
                {l.label}
              </button>
            ))}
            {onToggleTheme && (
              <button onClick={onToggleTheme} aria-label={isLight ? 'Switch to dark mode' : 'Switch to light mode'} title={isLight ? 'Dark mode' : 'Light mode'}
                className="w-10 h-10 rounded-full flex items-center justify-center text-md-on-surface-variant hover:text-md-on-surface hover:bg-md-on-surface/[0.06]">
                {isLight ? <Moon size={18} /> : <Sun size={18} />}
              </button>
            )}
            <button id="nav-login" onClick={onLogin}
              className="ml-2 h-10 px-5 rounded-full bg-md-primary text-md-on-primary text-sm font-semibold hover:brightness-110 active:scale-95 transition">
              Enter Sanctuary
            </button>
          </div>

          <div className="md:hidden flex items-center gap-1">
          {onToggleTheme && (
            <button onClick={onToggleTheme} aria-label={isLight ? 'Switch to dark mode' : 'Switch to light mode'}
              className="w-10 h-10 rounded-full flex items-center justify-center text-md-on-surface hover:bg-md-on-surface/10">
              {isLight ? <Moon size={20} /> : <Sun size={20} />}
            </button>
          )}
          <button
            className="md:hidden w-10 h-10 rounded-full flex items-center justify-center text-md-on-surface hover:bg-md-on-surface/10"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={isMobileMenuOpen}
          >
            {isMobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
          </div>
        </div>
      </nav>

      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-40 bg-md-surface/95 flex flex-col pt-28 px-4 md:hidden">
          <div className="rounded-[28px] bg-md-surface-container divide-y divide-md-outline-variant/30 overflow-hidden">
            {links.map((l) => (
              <button key={l.id} onClick={() => scrollToSection(l.mobileId || l.id)}
                className="w-full h-16 px-5 flex items-center justify-between text-lg font-medium text-md-on-surface hover:bg-md-on-surface/[0.06]">
                {l.label}<ChevronRight className="text-md-on-surface-variant" />
              </button>
            ))}
          </div>
          <button
            onClick={() => { setIsMobileMenuOpen(false); onLogin(); }}
            className="mt-6 w-full h-14 rounded-full bg-md-primary text-md-on-primary text-base font-semibold active:scale-[0.98] transition"
          >
            Enter Sanctuary
          </button>
        </div>
      )}
    </>
  );
};
