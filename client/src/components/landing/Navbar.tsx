import React, { useState, useEffect } from 'react';
import { Menu, X, Sparkles, ChevronRight, Moon, Sun } from 'lucide-react';

interface NavbarProps {
  onLogin: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onLogin }) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // Check local storage or system preference
    const stored = localStorage.getItem('theme');
    // If specific preference exists, use it. Otherwise, default to false (Light) or system.
    // Given the Landing page is primarily Light, we might want to default to light if not specified.
    const isDark = stored === 'dark';

    setIsDark(isDark);
    if (isDark) {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }

    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const toggleTheme = () => {
      const newDark = !isDark;
      setIsDark(newDark);
      if (newDark) {
          document.documentElement.classList.add('dark');
          localStorage.setItem('theme', 'dark');
      } else {
          document.documentElement.classList.remove('dark');
          localStorage.setItem('theme', 'light');
      }
  };

  // Lock body scroll when menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
  }, [isMobileMenuOpen]);

  const scrollToSection = (id: string) => {
    setIsMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleRefresh = () => {
    // Force scroll to top immediately to prevent browser scroll restoration from masking the refresh
    window.scrollTo({ top: 0, behavior: 'instant' });
    window.location.reload();
  };

  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          isScrolled
            ? 'bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-100 dark:border-white/5 py-4'
            : 'bg-transparent py-6'
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 flex justify-between items-center">
          {/* Logo */}
          <button
            className="flex items-center gap-2 group cursor-pointer z-50 relative bg-transparent border-none p-0"
            onClick={handleRefresh}
            aria-label="Refresh page"
          >
            <div className="w-8 h-8 bg-violet-600 rounded-lg flex items-center justify-center text-white transform group-hover:rotate-12 transition-transform duration-300">
              <Sparkles size={18} fill="currentColor" />
            </div>
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-violet-700 to-violet-500">
              Aastha.
            </span>
          </button>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8">
            <button onClick={() => scrollToSection('features-section')} className="text-slate-600 dark:text-slate-300 hover:text-violet-600 dark:hover:text-violet-400 font-medium transition-colors text-sm">Features</button>
            <button onClick={() => scrollToSection('why-aastha')} className="text-slate-600 dark:text-slate-300 hover:text-violet-600 dark:hover:text-violet-400 font-medium transition-colors text-sm">Why Aastha</button>

            {/* Theme Toggle */}
            <button
                onClick={toggleTheme}
                className="w-10 h-10 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-violet-100 dark:hover:bg-white/10 transition-all"
            >
                {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            <button
              id="nav-login"
              onClick={onLogin}
              className="bg-violet-600 text-white px-6 py-2.5 rounded-full font-medium text-sm hover:bg-violet-700 transition-all hover:shadow-lg hover:shadow-violet-200 dark:hover:shadow-none hover:-translate-y-0.5 active:scale-95"
            >
              Enter Sanctuary
            </button>
          </div>

          {/* Mobile Toggle Group */}
          <div className="md:hidden flex items-center gap-4 z-50">
             <button
                onClick={toggleTheme}
                className="w-10 h-10 rounded-full bg-slate-100 dark:bg-white/10 flex items-center justify-center text-slate-600 dark:text-slate-200"
            >
                {isDark ? <Sun size={20} /> : <Moon size={20} />}
            </button>

            <button
                className="text-slate-600 dark:text-white hover:text-violet-600 transition-colors relative p-2"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
                {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </nav>

      {/* Full Screen Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl flex flex-col pt-32 px-8 md:hidden animate-in fade-in duration-200">
          <div className="flex flex-col gap-8">
            <button
              onClick={() => scrollToSection('features-section')}
              className="text-2xl font-semibold text-slate-800 dark:text-white flex items-center justify-between group border-b border-slate-100 dark:border-white/10 pb-4 text-left w-full"
            >
              Features
              <ChevronRight className="text-slate-300 group-hover:text-violet-500 transition-colors" />
            </button>
            <button
              onClick={() => scrollToSection('mobile-why-aastha')}
              className="text-2xl font-semibold text-slate-800 dark:text-white flex items-center justify-between group border-b border-slate-100 dark:border-white/10 pb-4 text-left w-full"
            >
              Why Aastha
              <ChevronRight className="text-slate-300 group-hover:text-violet-500 transition-colors" />
            </button>
            <div className="pt-8">
              <button
                onClick={() => { setIsMobileMenuOpen(false); onLogin(); }}
                className="w-full bg-violet-600 text-white text-lg py-5 rounded-2xl font-bold shadow-xl shadow-violet-200 hover:shadow-violet-300 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <Sparkles size={20} />
                Enter Sanctuary
              </button>
              <p className="text-center text-slate-400 mt-6 text-sm">
                Already have an account? <span className="text-violet-600 font-semibold cursor-pointer" onClick={() => { setIsMobileMenuOpen(false); onLogin(); }}>Sign in</span>
              </p>
            </div>
          </div>

          {/* Decorative background elements for menu */}
          <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-violet-500/10 rounded-full blur-[80px] pointer-events-none" />
          <div className="absolute top-20 -left-20 w-60 h-60 bg-teal-500/10 rounded-full blur-[60px] pointer-events-none" />
        </div>
      )}
    </>
  );
};
