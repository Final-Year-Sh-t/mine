import { Link, useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { ShieldAlert, Home, ArrowLeft, Search, HelpCircle } from 'lucide-react';

const NotFound = () => {
  const navigate = useNavigate();

  return (
    <Layout>
      <div className="min-h-[75vh] flex items-center justify-center relative overflow-hidden py-16 px-4">
        {/* Ambient Glow Background Spheres */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-10 right-1/4 w-80 h-80 bg-accent/10 rounded-full blur-3xl pointer-events-none" />

        <div className="container relative z-10 max-w-xl text-center">
          {/* Animated 404 Badge Container */}
          <div className="relative inline-flex items-center justify-center mb-6">
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-primary/20 to-accent/20 blur-xl scale-125 animate-pulse" />
            <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-3xl gradient-primary flex items-center justify-center shadow-2xl">
              <ShieldAlert className="w-12 h-12 sm:w-14 sm:h-14 text-primary-foreground animate-bounce" strokeWidth={1.5} style={{ animationDuration: '3s' }} />
            </div>
          </div>

          {/* Large 404 Number */}
          <h1 className="font-michroma text-6xl sm:text-7xl font-bold bg-gradient-to-r from-primary via-indigo-600 to-accent bg-clip-text text-transparent mb-3 tracking-tight">
            404
          </h1>

          {/* Heading & Subtitle */}
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-foreground mb-3">
            Page Not Found
          </h2>
          <p className="text-muted-foreground text-base sm:text-lg mb-8 max-w-md mx-auto leading-relaxed">
            The page you are looking for doesn't exist, was moved, or is temporarily unavailable.
          </p>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center mb-10">
            <Button
              size="lg"
              className="gradient-primary border-0 gap-2 w-full sm:w-auto px-7 h-11 text-base shadow-lg hover:shadow-xl transition-all"
              onClick={() => navigate('/')}
            >
              <Home className="w-4 h-4" />
              Return to Home
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-slate-300 bg-white/80 hover:bg-white text-slate-900 gap-2 w-full sm:w-auto px-6 h-11 text-base shadow-sm"
              onClick={() => navigate(-1)}
            >
              <ArrowLeft className="w-4 h-4" />
              Go Back
            </Button>
          </div>

          {/* Quick Helpful Links */}
          <div className="pt-6 border-t border-border/60 flex flex-wrap justify-center gap-6 text-sm text-muted-foreground">
            <Link to="/verify" className="flex items-center gap-1.5 hover:text-primary transition-colors">
              <Search className="w-4 h-4 text-primary" />
              Verify ID
            </Link>
            <Link to="/docs" className="flex items-center gap-1.5 hover:text-primary transition-colors">
              <HelpCircle className="w-4 h-4 text-accent" />
              Documentation
            </Link>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default NotFound;

