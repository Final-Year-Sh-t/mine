import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Shield, Building2, ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react';
import { z } from 'zod';
import { useAuth } from '@/lib/auth';
import { useInstitution } from '@/lib/contexts/InstitutionContext';

const registrationSchema = z.object({
  institutionName: z.string().trim().min(2, 'Institution name must be at least 2 characters').max(100, 'Institution name must be less than 100 characters'),
});

export default function InstitutionRegister() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, signInWithOAuth } = useAuth();
  const { refreshInstitution } = useInstitution();
  const [isLoading, setIsLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);
  const [institutionName, setInstitutionName] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleOAuthSignIn = async (provider: 'google' | 'github') => {
    setOauthLoading(provider);
    try {
      const { error } = await signInWithOAuth(provider);
      if (error) throw error;
    } catch (err: any) {
      console.error('OAuth sign in error:', err);
      toast({
        title: 'Authentication Error',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setOauthLoading(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = registrationSchema.safeParse({ institutionName });
    if (!result.success) {
      const formatted: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) formatted[err.path[0] as string] = err.message;
      });
      setErrors(formatted);
      return;
    }

    if (!user) {
      toast({
        title: 'Authentication required',
        description: 'Please sign in via OAuth first to create an institution.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      const { data: newInstitutionId, error } = await supabase.rpc('create_institution_for_current_user', {
        _name: institutionName.trim(),
      });

      if (error) throw error;

      if (newInstitutionId) {
        if (user) {
          localStorage.setItem(`verifyid_last_institution_${user.id}`, newInstitutionId);
        }
        await supabase.rpc('switch_active_institution', {
          _institution_id: newInstitutionId,
        });
      }

      toast({
        title: 'Institution created!',
        description: 'Welcome to your new institution dashboard.',
      });

      await refreshInstitution();
      navigate('/dashboard', { replace: true });
    } catch (error: any) {
      console.error('Institution creation error:', error);
      toast({
        title: 'Error creating institution',
        description: error.message || 'Failed to create institution.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-secondary/20 p-4">
      <div className="w-full max-w-lg">
        <Link 
          to="/" 
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </Link>

        <div className="bg-card rounded-2xl shadow-xl border border-border p-8">
          <div className="text-center mb-8">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl gradient-primary mx-auto mb-4">
              <Shield className="h-7 w-7 text-primary-foreground" />
            </div>
            <h1 className="font-display text-2xl font-bold mb-2">Register Your Institution</h1>
            <p className="text-muted-foreground">
              Create your institution account and start verifying identities securely
            </p>
          </div>

          {!user ? (
            <div className="space-y-6">
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 text-sm text-muted-foreground flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <span>
                  All administrator accounts require OAuth verification (Google or GitHub) to ensure provider-verified email authenticity.
                </span>
              </div>

              <div className="space-y-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleOAuthSignIn('google')}
                  disabled={oauthLoading !== null}
                  className="w-full py-6 text-sm font-medium flex items-center justify-center gap-3 border-border hover:bg-secondary transition-all"
                >
                  {oauthLoading === 'google' ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <svg className="h-5 w-5" viewBox="0 0 24 24">
                      <path
                        fill="currentColor"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="currentColor"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                  )}
                  Authenticate with Google
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleOAuthSignIn('github')}
                  disabled={oauthLoading !== null}
                  className="w-full py-6 text-sm font-medium flex items-center justify-center gap-3 border-border hover:bg-secondary transition-all"
                >
                  {oauthLoading === 'github' ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                      <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                    </svg>
                  )}
                  Authenticate with GitHub
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="institutionName" className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  Institution Name
                </Label>
                <Input
                  id="institutionName"
                  placeholder="Acme University"
                  value={institutionName}
                  onChange={(e) => setInstitutionName(e.target.value)}
                  className={errors.institutionName ? 'border-destructive' : ''}
                  disabled={isLoading}
                />
                {errors.institutionName && (
                  <p className="text-sm text-destructive">{errors.institutionName}</p>
                )}
              </div>

              <Button 
                type="submit" 
                className="w-full gradient-primary border-0 h-12 text-base"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    Creating your institution...
                  </>
                ) : (
                  'Create Institution'
                )}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
