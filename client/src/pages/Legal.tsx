import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Sun, Moon } from 'lucide-react';
import { usePublicTheme } from '../hooks/usePublicTheme';
import { PRIVACY, TERMS, LegalSection } from '../legal/content';
import { LEGAL } from '../legal/legalInfo';

/** Public Privacy Policy / Terms page, Material You content, glass top bar, light/dark toggle. */
const LegalPage: React.FC<{ kind: 'privacy' | 'terms' }> = ({ kind }) => {
  const navigate = useNavigate();
  const theme = usePublicTheme();
  const sections: LegalSection[] = kind === 'privacy' ? PRIVACY : TERMS;
  const title = kind === 'privacy' ? 'Privacy Policy' : 'Terms of Service';
  const version = kind === 'privacy' ? LEGAL.privacyVersion : LEGAL.termsVersion;

  useEffect(() => { document.title = `${title} · Aastha`; window.scrollTo(0, 0); }, [title]);

  return (
    <div style={theme.style} data-public-theme={theme.isLight ? 'light' : 'dark'} className="min-h-[100dvh] bg-md-surface text-md-on-surface font-sans">
      <div className="fixed top-0 inset-x-0 z-30 px-3 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
        <div className="glass rounded-full h-14 max-w-4xl mx-auto flex items-center gap-2 px-2">
          <button onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))} aria-label="Back"
            className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-md-on-surface/10"><ArrowLeft size={20} /></button>
          <Link to="/" className="flex items-center gap-2">
            <img src="/logo.png" alt="" className="w-8 h-8 rounded-[10px] object-cover" />
            <span className="font-serif text-lg">Aastha</span>
          </Link>
          <button onClick={theme.toggle} aria-label={theme.isLight ? 'Switch to dark mode' : 'Switch to light mode'}
            className="ml-auto w-10 h-10 rounded-full flex items-center justify-center text-md-on-surface-variant hover:bg-md-on-surface/10">
            {theme.isLight ? <Moon size={18} /> : <Sun size={18} />}
          </button>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 pt-[calc(env(safe-area-inset-top)+6rem)] pb-16">
        <header className="rounded-[32px] bg-md-primary-container text-md-on-primary-container p-7 md:p-10">
          <h1 className="font-serif text-4xl md:text-5xl">{title}</h1>
          <p className="mt-3 text-sm opacity-85">Effective {LEGAL.effectiveDate} · Version {version}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link to={kind === 'privacy' ? '/terms' : '/privacy'} className="h-9 px-4 inline-flex items-center rounded-full bg-md-primary text-md-on-primary text-sm font-medium">
              {kind === 'privacy' ? 'Read the Terms' : 'Read the Privacy Policy'}
            </Link>
            <a href="tel:14416" className="h-9 px-4 inline-flex items-center rounded-full bg-md-surface/60 text-md-on-surface text-sm font-medium">In crisis? Tele-MANAS 14416</a>
          </div>
        </header>

        <nav aria-label="Contents" className="mt-6 rounded-[24px] bg-md-surface-container p-4">
          <p className="text-sm font-medium text-md-primary px-1 mb-2">Contents</p>
          <ol className="grid sm:grid-cols-2 gap-x-4 gap-y-1">
            {sections.map((s) => (
              <li key={s.id}><a href={`#${s.id}`} className="block rounded-[12px] px-2 py-1.5 text-sm text-md-on-surface-variant hover:text-md-on-surface hover:bg-md-on-surface/[0.06]">{s.title}</a></li>
            ))}
          </ol>
        </nav>

        <div className="mt-6 space-y-4">
          {sections.map((s) => (
            <section key={s.id} id={s.id} className="scroll-mt-24 rounded-[28px] bg-md-surface-container-low border border-md-outline-variant/30 p-6 md:p-8">
              <h2 className="font-serif text-2xl text-md-on-surface mb-3">{s.title}</h2>
              <div className="text-[15px] leading-relaxed text-md-on-surface-variant">{s.body}</div>
            </section>
          ))}
        </div>

        <p className="mt-8 text-center text-xs text-md-on-surface-variant">© {new Date().getFullYear()} Aastha</p>
      </main>
    </div>
  );
};

export const PrivacyPolicyPage: React.FC = () => <LegalPage kind="privacy" />;
export const TermsPage: React.FC = () => <LegalPage kind="terms" />;
