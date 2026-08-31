import { Link } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Shield, Search, Lock, Users, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';

const features = [
  {
    icon: Search,
    title: 'Instant Verification',
    description: 'Verify identity credentials in seconds with our streamlined lookup system.',
  },
  {
    icon: Lock,
    title: 'Secure & Private',
    description: 'Enterprise-grade security with end-to-end encryption and role-based access control.',
  },
  {
    icon: Users,
    title: 'Admin Dashboard',
    description: 'Comprehensive management tools for administrators to oversee all verifications.',
  },
];


export default function Index() {
  const { user } = useAuth();

  return (
    <Layout>
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-6 lg:pt-10 pb-12 lg:pb-16">
        {/* Background Building Image */}
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-40 scale-105 pointer-events-none"
          style={{ backgroundImage: `url('/hero-bg.jpg')` }}
        />

        {/* Ambient Gradient Overlays for Readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-50/85 via-blue-50/65 to-background pointer-events-none" />
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
          <div className="absolute -top-24 left-1/6 w-96 h-96 bg-amber-200/35 rounded-full blur-3xl" />
          <div className="absolute top-0 right-1/6 w-96 h-96 bg-sky-300/35 rounded-full blur-3xl" />
        </div>

        <div className="container relative z-10">
          {/* Top Row: Left Text + Right 3D Object */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center mb-8 lg:mb-10">
            {/* Left Column: Text */}
            <div className="text-left">
              {/* Eyebrow Label */}
              <div className="inline-block mb-3 animate-fade-in">
                <span className="text-[11px] md:text-xs font-bold uppercase tracking-[0.3em] bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  IDENTITY INFRASTRUCTURE
                </span>
              </div>

              {/* Main Headline */}
              <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl lg:text-[66px] font-medium tracking-tight text-slate-900 leading-[1.08] mb-5 animate-slide-up" style={{ animationDelay: '0.1s' }}>
                Digital Identity Verification<br />
                Made Simple
              </h1>

              {/* Subtitle */}
              <p className="text-lg md:text-xl text-slate-900 font-semibold max-w-lg animate-slide-up" style={{ animationDelay: '0.2s' }}>
                Securely verify identities using identification numbers. Fast, reliable, and compliant with the highest security standards.
              </p>
            </div>

            {/* Right Column: 3D Object Render */}
            <div className="flex justify-center items-center animate-fade-in" style={{ animationDelay: '0.2s' }}>
              <div className="w-full max-w-md aspect-square relative flex items-center justify-center">
                <model-viewer
                  src="/models/model3d1.glb"
                  alt="3D Model"
                  auto-rotate
                  camera-controls
                  shadow-intensity="1"
                  exposure="1"
                  loading="eager"
                  bounds="tight"
                  style={{ width: '100%', height: '100%', minHeight: '380px', backgroundColor: 'transparent' }}
                />
              </div>
            </div>
          </div>

          {/* Bottom Centered Action Row (Beneath both text and 3D model) */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center animate-slide-up" style={{ animationDelay: '0.3s' }}>
            {user ? (
              <Link to="/verify">
                <Button size="lg" className="gradient-primary border-0 gap-2 text-base px-8 h-12 shadow-lg hover:shadow-xl transition-all">
                  Start Verifying
                  <ArrowRight className="h-5 w-5" />
                </Button>
              </Link>
            ) : (
              <>
                <Link to="/register">
                  <Button size="lg" className="gradient-primary border-0 gap-2 text-base px-7 h-12 shadow-lg hover:shadow-xl transition-all">
                    Register Institution
                    <ArrowRight className="h-5 w-5" />
                  </Button>
                </Link>
                <Link to="/auth">
                  <Button size="lg" variant="outline" className="border-slate-300 bg-white/80 hover:bg-white text-slate-900 text-base px-7 h-12 shadow-sm">
                    Sign In
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Features Section - Everything You Need */}
      <section className="py-16 md:py-20 relative overflow-hidden">
        {/* Base Gradient Layer */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />

        {/* Top-Right Glowing Blur Sphere */}
        <div className="absolute top-1/4 -right-48 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse" />

        {/* Bottom-Left Glowing Blur Sphere */}
        <div className="absolute bottom-1/4 -left-48 w-96 h-96 bg-accent/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />

        <div className="container relative">
          {/* Section Header */}
          <div className="mx-auto max-w-2xl text-center mb-12 md:mb-16">
            <h2 className="font-display text-3xl md:text-4xl font-bold tracking-tight mb-3 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              Everything You Need
            </h2>
            <p className="text-muted-foreground text-base md:text-lg">
              A complete solution for identity verification with powerful admin tools.
            </p>
          </div>

          {/* Feature Item Cards (Z-Pattern Alternating Layout) */}
          <div className="space-y-12 md:space-y-16">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              const isEven = index % 2 === 0;
              return (
                <div
                  key={feature.title}
                  className={`flex flex-col lg:flex-row items-center gap-8 lg:gap-12 ${
                    isEven ? '' : 'lg:flex-row-reverse'
                  } animate-slide-up`}
                  style={{ animationDelay: `${0.2 * index}s` }}
                >
                  {/* Graphic / Icon Orb Side (Layered Composition) */}
                  <div className="flex-1 flex justify-center relative">
                    <div className="relative">
                      {/* 1. Outer Glow Ring */}
                      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 blur-2xl scale-150 animate-pulse" />

                      {/* 2. Middle Rotating Border Ring */}
                      <div className="absolute inset-0 rounded-full border-2 border-primary/30 scale-125 animate-spin-slow" />

                      {/* 3. Main Gradient Icon Sphere */}
                      <div className="relative w-32 h-32 md:w-40 md:h-40 rounded-full gradient-primary flex items-center justify-center shadow-2xl transform hover:scale-110 transition-transform duration-500">
                        <Icon className="w-16 h-16 md:w-20 md:h-20 text-primary-foreground" strokeWidth={1.5} />
                      </div>

                      {/* 4. Orbiting Floating Dots */}
                      <div className="absolute -top-3 -right-3 w-3 h-3 rounded-full bg-accent animate-bounce" />
                      <div className="absolute -bottom-3 -left-3 w-2.5 h-2.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0.5s' }} />
                    </div>
                  </div>

                  {/* Content / Text Side */}
                  <div className="flex-1 text-center lg:text-left">
                    {/* Step Number Watermark Badge */}
                    <div className="inline-block mb-2">
                      <span className="text-4xl md:text-5xl font-bold bg-gradient-to-br from-primary to-accent bg-clip-text text-transparent opacity-20">
                        0{index + 1}
                      </span>
                    </div>
                    {/* Feature Title */}
                    <h3 className="font-display text-2xl md:text-3xl font-bold mb-3 bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">
                      {feature.title}
                    </h3>
                    {/* Feature Description */}
                    <p className="text-muted-foreground text-base md:text-lg leading-relaxed max-w-md mx-auto lg:mx-0">
                      {feature.description}
                    </p>

                    {/* Decorative Gradient Line */}
                    <div className="mt-4 h-1 w-16 bg-gradient-to-r from-primary to-accent rounded-full mx-auto lg:mx-0" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>


      {/* How It Works */}
      <section className="py-24 bg-secondary/50">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center mb-16">
            <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl mb-4">
              How It Works
            </h2>
            <p className="text-muted-foreground text-lg">
              Three simple steps to verify any identity.
            </p>
          </div>

          <div className="mx-auto max-w-3xl">
            {[
              { step: '01', title: 'Sign In', description: 'Create an account or sign in to access the verification portal.' },
              { step: '02', title: 'Enter Identification Number', description: 'Input the unique identification number you want to verify.' },
              { step: '03', title: 'Get Results', description: 'Instantly receive verified identity information including name, photo, and organization.' },
            ].map((item, index) => (
              <div
                key={item.step}
                className="flex gap-6 items-start mb-8 last:mb-0 animate-slide-up"
                style={{ animationDelay: `${0.1 * index}s` }}
              >
                <div className="flex-shrink-0 w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center font-display text-xl font-bold text-primary-foreground">
                  {item.step}
                </div>
                <div className="pt-2">
                  <h3 className="font-display text-xl font-semibold mb-1">{item.title}</h3>
                  <p className="text-muted-foreground">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24">
        <div className="container">
          <div className="mx-auto max-w-3xl text-center rounded-3xl gradient-hero p-12">
            <CheckCircle2 className="h-12 w-12 text-accent mx-auto mb-6" />
            <h2 className="font-display text-3xl font-bold text-primary-foreground mb-4">
              Ready to Get Started?
            </h2>
            <p className="text-primary-foreground/70 mb-8 max-w-xl mx-auto">
              Join thousands of organizations using VerifyID for secure identity verification.
            </p>
            {user ? (
              <Link to="/verify">
                <Button size="lg" className="gradient-accent border-0 gap-2">
                  Go to Verification
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            ) : (
              <Link to="/register">
                <Button size="lg" className="gradient-accent border-0 gap-2">
                  Register Your Institution
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            )}
          </div>
        </div>
      </section>
    </Layout>
  );
}