import React from 'react';
import { Link } from 'react-router-dom';

const go = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
const linkCls = 'h-10 px-4 inline-flex items-center rounded-full text-sm font-medium text-md-on-surface-variant hover:text-md-on-surface hover:bg-md-on-surface/[0.06]';

/** One compact card: brand + note, one row of real links (no placeholders), copyright. */
export const Footer: React.FC = () => (
  <footer className="px-4 pb-[calc(env(safe-area-inset-bottom)+1.5rem)]">
    <div className="max-w-6xl mx-auto rounded-[32px] bg-md-surface-container-low border border-md-outline-variant/30 p-6 md:p-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="" className="w-10 h-10 rounded-[12px] object-cover" />
          <div>
            <span className="block font-serif text-2xl leading-none text-md-on-surface">Aastha</span>
            <span className="block text-sm text-md-on-surface-variant mt-1">Your AI companion for everyday wellbeing</span>
          </div>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap gap-1 -mx-2 md:mx-0">
          <button onClick={() => go('features-section')} className={linkCls}>Features</button>
          <button onClick={() => go('why-aastha')} className={linkCls}>Why Aastha</button>
          <button onClick={() => go('faq-section')} className={linkCls}>FAQ</button>
          <Link to="/privacy" className={linkCls}>Privacy Policy</Link>
          <Link to="/terms" className={linkCls}>Terms</Link>
        </nav>
      </div>

      <p className="mt-6 rounded-[20px] bg-md-surface-container px-4 py-3 text-sm text-md-on-surface-variant">
        Aastha is not a medical or emergency service. If you’re in crisis, call{' '}
        <a href="tel:14416" className="text-md-primary font-semibold whitespace-nowrap">Tele-MANAS 14416</a> or{' '}
        <a href="tel:112" className="text-md-primary font-semibold">112</a>.
      </p>

      <div className="mt-6 pt-5 border-t border-md-outline-variant/30 text-sm text-md-on-surface-variant">
        © {new Date().getFullYear()} Aastha. All rights reserved.
      </div>
    </div>
  </footer>
);
