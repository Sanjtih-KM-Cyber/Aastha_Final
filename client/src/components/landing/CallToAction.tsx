import React from 'react';
import { FadeIn } from './FadeIn';

export const CallToAction: React.FC = () => {
  return (
    <section className="py-32 px-6 bg-[#0B0F17] relative overflow-hidden flex items-center justify-center min-h-[90vh]">
      {/* Ambient background */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-violet-900/20 via-[#0B0F17] to-[#0B0F17]" />
      <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-violet-900/10 to-transparent" />

      <div className="relative z-10 w-full max-w-4xl mx-auto text-center">
        <FadeIn delay={100}>
          <h2 className="text-4xl md:text-7xl font-bold text-white mb-8 tracking-tight font-serif">
            Enter Your Sanctuary
          </h2>
          <p className="text-slate-400 text-lg mb-16 max-w-xl mx-auto">
            Leave the noise behind. Step into a space that understands you.
          </p>
        </FadeIn>

        {/* The Doorway */}
        <div className="door-container relative inline-block group cursor-pointer perspective-1000">
          <div className="relative w-48 h-80 md:w-64 md:h-96 mx-auto door-perspective">
             {/* The Door Frame Glow */}
            <div className="absolute inset-0 bg-violet-600/30 blur-[60px] rounded-t-full door-glow group-hover:bg-violet-500/50 transition-all duration-700" />

            {/* The Door Shape */}
            <div className="relative h-full w-full bg-[#0B0F17] border-x-4 border-t-4 border-slate-800 rounded-t-[100px] overflow-hidden door-frame group-hover:scale-[1.02] group-hover:-translate-y-2 group-hover:border-violet-500/30 transition-all duration-700 shadow-2xl">

              {/* Inner Light / Portal */}
              <div className="absolute inset-0 rounded-t-[90px] door-inner opacity-40 group-hover:opacity-100 transition-opacity duration-700 flex items-end justify-center overflow-hidden">
                 <div className="w-full h-full bg-[radial-gradient(ellipse_at_bottom,_var(--tw-gradient-stops))] from-white via-violet-400 to-violet-950 opacity-90" />

                 {/* Figurine SVG Silhouette */}
                 <svg
                    className="absolute bottom-0 z-20 w-32 md:w-40 h-auto opacity-0 group-hover:opacity-100 transition-all duration-1000 ease-out transform translate-y-8 group-hover:translate-y-0"
                    viewBox="0 0 100 240"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                 >
                    {/* Shadow */}
                    <ellipse cx="50" cy="225" rx="30" ry="5" fill="black" fillOpacity="0.4" filter="url(#blur)" />

                    {/* Body Silhouette */}
                    <path d="M50 45C58.2843 45 65 51.7157 65 60C65 68.2843 58.2843 75 50 75C41.7157 75 35 68.2843 35 60C35 51.7157 41.7157 45 50 45Z" fill="#111" />
                    <path d="M50 78C66 82 82 92 84 120L88 260H12L16 120C18 92 34 82 50 78Z" fill="#111" />

                    {/* Headphones */}
                    <path d="M30 60V66C30 67.1046 30.8954 68 32 68H34C35.1046 68 36 67.1046 36 66V60C36 58.8954 35.1046 58 34 58H32C30.8954 58 30 58.8954 30 60Z" fill="#222" />
                    <path d="M64 60V66C64 67.1046 64.8954 68 66 68H68C69.1046 68 70 67.1046 70 66V60C70 58.8954 69.1046 58 68 58H66C64.8954 58 64 58.8954 64 60Z" fill="#222" />
                    <path d="M34 58C34 47 41 40 50 40C59 40 66 47 66 58" stroke="#222" strokeWidth="4" strokeLinecap="round"/>

                    {/* Subtle Rim Light (Backlighting) */}
                    <path d="M20 120C22 100 35 85 50 82C65 85 78 100 80 120" stroke="white" strokeOpacity="0.15" strokeWidth="1" />
                    <circle cx="50" cy="60" r="14" stroke="white" strokeOpacity="0.1" strokeWidth="1" />

                    <defs>
                        <filter id="blur" x="10" y="210" width="80" height="30" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
                            <feFlood floodOpacity="0" result="BackgroundImageFix"/>
                            <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
                            <feGaussianBlur stdDeviation="3" result="effect1_foregroundBlur"/>
                        </filter>
                    </defs>
                 </svg>

                 {/* Particle Effects inside door */}
                 <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay"></div>
              </div>

              {/* Door Surface (Closed state visuals) */}
              <div className="absolute inset-0 bg-[#0F121B] rounded-t-[96px] opacity-100 group-hover:opacity-0 transition-opacity duration-700 flex flex-col items-center justify-center border-t border-white/5">
                <div className="w-1 h-24 bg-gradient-to-b from-transparent via-violet-500/50 to-transparent opacity-50" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-violet-900 shadow-[0_0_15px_2px_rgba(139,92,246,0.3)] group-hover:scale-150 transition-transform duration-500" />
              </div>
            </div>

            {/* Floor Reflection */}
            <div className="absolute -bottom-12 left-[-20%] right-[-20%] h-12 bg-violet-500/20 blur-xl transform scale-x-150 group-hover:scale-x-125 transition-transform duration-700 mask-image-linear-gradient(to bottom, black, transparent)" />
          </div>

          <div className="mt-12 opacity-0 group-hover:opacity-100 transition-opacity duration-700 text-violet-300 font-medium tracking-widest text-sm uppercase">
            Click to Enter
          </div>
        </div>
      </div>
    </section>
  );
};
