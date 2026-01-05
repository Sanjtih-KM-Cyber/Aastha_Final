import React, { useState } from 'react';
import { Navbar } from '../components/landing/Navbar';
import { Hero } from '../components/landing/Hero';
import { Features } from '../components/landing/Features';
import { InteractiveDemo } from '../components/landing/InteractiveDemo';
import { Comparison } from '../components/landing/Comparison';
import { MobileExperience } from '../components/landing/MobileExperience';
import { FAQ } from '../components/landing/FAQ';
import { CallToAction } from '../components/landing/CallToAction';
import { Footer } from '../components/landing/Footer';
import { Login } from '../components/auth/Login';
import { OnboardingTour, TourStep } from '../components/landing/OnboardingTour';
import { useNavigate } from 'react-router-dom';

const LANDING_TOUR_STEPS: TourStep[] = [
  {
    targetId: 'hero-cta',
    title: 'Begin Your Journey',
    content: 'Your path to mental clarity starts here. This is your gateway to a personal, private sanctuary.',
    position: 'bottom'
  },
  {
    targetId: 'features-section',
    title: 'Powerful Tools',
    content: 'Discover our suite of features designed for wellbeing, including encrypted journaling and mood analytics.',
    position: 'top'
  },
  {
    targetId: 'demo-section',
    title: 'Sanctuary OS',
    content: 'Experience our unique floating interface. Try interacting with the widgets to see how it feels.',
    position: 'top'
  },
  {
    targetId: 'nav-login',
    title: 'Member Access',
    content: 'Already a member? Sign in here to resume your sessions and access your history.',
    position: 'bottom'
  }
];

const Landing: React.FC = () => {
  const [isTourOpen, setIsTourOpen] = useState(false);
  const navigate = useNavigate();

  const handleLoginNav = () => {
    navigate('/login');
  };

  return (
      <div className="min-h-screen bg-white dark:bg-[#0B0F17] text-slate-900 font-sans selection:bg-violet-200 selection:text-violet-900 transition-colors duration-500">
        <OnboardingTour
          isOpen={isTourOpen}
          steps={LANDING_TOUR_STEPS}
          onComplete={() => setIsTourOpen(false)}
          onSkip={() => setIsTourOpen(false)}
        />

        <Navbar onLogin={handleLoginNav} />
        <main>
          <Hero onLogin={handleLoginNav} />
          <Features />

          {/* Desktop Only Sections */}
          <div className="hidden md:block">
              <InteractiveDemo />
              <Comparison />
          </div>

          {/* Mobile Only Section */}
          <div className="block md:hidden">
              <MobileExperience />
          </div>

          <FAQ />
          <div onClick={handleLoginNav} className="cursor-pointer">
            <CallToAction />
          </div>
        </main>
        <Footer />
      </div>
  );
};

export default Landing;
