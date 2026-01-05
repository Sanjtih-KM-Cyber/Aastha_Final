import React from 'react';
import { Sparkles, Twitter, Instagram, Linkedin } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-white dark:bg-[#0B0F17] border-t border-slate-100 dark:border-white/5 pt-16 pb-8 transition-colors duration-500">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col md:flex-row justify-between items-start gap-12 mb-16">
          <div className="max-w-xs">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-8 h-8 bg-violet-600 rounded-lg flex items-center justify-center text-white">
                <Sparkles size={18} fill="currentColor" />
              </div>
              <span className="text-xl font-bold text-slate-900 dark:text-white">Aastha.</span>
            </div>
            <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
              Your AI companion for mental wellness. Built with love, empathy, and advanced technology to help you thrive.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-12 lg:gap-24">
            <div>
              <h4 className="font-bold text-slate-900 dark:text-white mb-6">Product</h4>
              <ul className="space-y-4 text-slate-500 dark:text-slate-400">
                <li><a href="#" className="hover:text-violet-600 dark:hover:text-violet-400 transition-colors">Features</a></li>
                <li><a href="#" className="hover:text-violet-600 dark:hover:text-violet-400 transition-colors">Pricing</a></li>
                <li><a href="#" className="hover:text-violet-600 dark:hover:text-violet-400 transition-colors">Testimonials</a></li>
                <li><a href="#" className="hover:text-violet-600 dark:hover:text-violet-400 transition-colors">Download</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-slate-900 dark:text-white mb-6">Company</h4>
              <ul className="space-y-4 text-slate-500 dark:text-slate-400">
                <li><a href="#" className="hover:text-violet-600 dark:hover:text-violet-400 transition-colors">About Us</a></li>
                <li><a href="#" className="hover:text-violet-600 dark:hover:text-violet-400 transition-colors">Careers</a></li>
                <li><a href="#" className="hover:text-violet-600 dark:hover:text-violet-400 transition-colors">Privacy</a></li>
                <li><a href="#" className="hover:text-violet-600 dark:hover:text-violet-400 transition-colors">Terms</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-slate-900 dark:text-white mb-6">Connect</h4>
              <div className="flex gap-4">
                <a href="#" className="w-10 h-10 bg-slate-50 dark:bg-white/5 rounded-full flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-violet-100 dark:hover:bg-white/10 hover:text-violet-600 dark:hover:text-white transition-all">
                  <Twitter size={18} />
                </a>
                <a href="#" className="w-10 h-10 bg-slate-50 dark:bg-white/5 rounded-full flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-violet-100 dark:hover:bg-white/10 hover:text-violet-600 dark:hover:text-white transition-all">
                  <Instagram size={18} />
                </a>
                <a href="#" className="w-10 h-10 bg-slate-50 dark:bg-white/5 rounded-full flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-violet-100 dark:hover:bg-white/10 hover:text-violet-600 dark:hover:text-white transition-all">
                  <Linkedin size={18} />
                </a>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-100 dark:border-white/5 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-slate-400">
          <p>© {new Date().getFullYear()} SoulLink Inc. All rights reserved.</p>
          <div className="flex gap-8">
            <a href="#" className="hover:text-violet-600 transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-violet-600 transition-colors">Terms of Service</a>
          </div>
        </div>
      </div>
    </footer>
  );
};
