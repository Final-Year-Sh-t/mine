import { useState, useEffect } from 'react';
import { Navigate, Link, useSearchParams } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  Search, 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  ArrowRight,
  Clock,
  Shield,
  Users,
  Settings,
  FileText,
  Building2,
  Plus,
  RefreshCw,
  ChevronDown
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface DashboardStats {
  totalVerifications: number;
  successfulVerifications: number;
  failedVerifications: number;
  recentVerifications: Array<{
    id: string;
    index_number: string;
    verification_result: boolean;
    created_at: string;
  }>;
}

interface UserInstitution {
  institution_id: string;
  institution_name: string;
  institution_slug: string;
  role: string;
  is_active: boolean;
  status?: 'pending' | 'approved' | 'rejected';
}

type OnboardingStep = 'choice' | 'create' | 'join';

export default function Dashboard() {
  const { user, isAdmin, institution, institutionId, isLoading: authLoading, refreshAuth } = useAuth();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Onboarding state
  const [onboardingStep, setOnboardingStep] = useState<OnboardingStep>('choice');
  const [isOnboardingLoading, setIsOnboardingLoading] = useState(false);
  const [institutionName, setInstitutionName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ id: string; name: string; slug: string }>>([]);
  const [selectedInstitution, setSelectedInstitution] = useState<string | null>(null);
  
  // Step-up Identity Linking state
  const [showLinkIdentityModal, setShowLinkIdentityModal] = useState(false);
  const [isLinkingProvider, setIsLinkingProvider] = useState<string | null>(null);

  // Institution switching modal state
  const [showInstitutionModal, setShowInstitutionModal] = useState(false);
  const [showConfirmSwitch, setShowConfirmSwitch] = useState(false);
  const [pendingAction, setPendingAction] = useState<'create' | 'join' | null>(null);
  
  // User institutions list
  const [userInstitutions, setUserInstitutions] = useState<UserInstitution[]>([]);
  const [isSwitching, setIsSwitching] = useState(false);

  // Check if user has an OAuth provider linked
  const checkHasOAuthProvider = () => {
    try {
      if (!user) return false;
      const providers: string[] = (user as any)?.app_metadata?.providers || [];
      const identities: any[] = (user as any)?.identities || [];
      const hasOAuthProvider = Array.isArray(providers) && providers.some((p: string) => typeof p === 'string' && p !== 'email');
      const hasOAuthIdentity = Array.isArray(identities) && identities.some((id: any) => id?.provider && id?.provider !== 'email');
      return hasOAuthProvider || hasOAuthIdentity;
    } catch (err) {
      console.error('Error checking OAuth provider:', err);
      return false;
    }
  };

  // Auto-join handling after returning from linkIdentity redirect
  useEffect(() => {
    const autoJoinId = searchParams.get('autoJoin');
    if (autoJoinId && user) {
      const runAutoJoin = async () => {
        try {
          const { error } = await supabase.rpc('join_institution_for_current_user', {
            _institution_id: autoJoinId,
          });
          if (error) throw error;

          toast({
            title: 'Identity Linked & Join Request Submitted!',
            description: 'Your identity provider has been linked and your join request is pending administrator approval.',
          });

          await refreshAuth();
          await fetchUserInstitutions();
          searchParams.delete('autoJoin');
          setSearchParams(searchParams, { replace: true });
        } catch (err: any) {
          console.error('Auto-join error after identity link:', err);
        }
      };
      runAutoJoin();
    }
  }, [user, searchParams]);

  useEffect(() => {
    if (user) {
      fetchUserInstitutions();
      if (institutionId) {
        setIsLoading(true);
        fetchDashboardStats();
      } else {
        setIsLoading(false);
      }
    }
  }, [user, institutionId]);

  const fetchUserInstitutions = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase.rpc('get_user_institutions', {
        _user_id: user.id
      });
      if (error) throw error;
      setUserInstitutions(data || []);
    } catch (err) {
      console.error('Error fetching user institutions:', err);
    }
  };

  const fetchDashboardStats = async () => {
    try {
      const { data: logs, error } = await supabase
        .from('verification_logs')
        .select('id, index_number, verification_result, created_at')
        .eq('verified_by', user?.id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) {
        console.error('Error fetching stats:', error);
        return;
      }

      const { count: totalCount } = await supabase
        .from('verification_logs')
        .select('*', { count: 'exact', head: true })
        .eq('verified_by', user?.id);

      const { count: successCount } = await supabase
        .from('verification_logs')
        .select('*', { count: 'exact', head: true })
        .eq('verified_by', user?.id)
        .eq('verification_result', true);

      setStats({
        totalVerifications: totalCount || 0,
        successfulVerifications: successCount || 0,
        failedVerifications: (totalCount || 0) - (successCount || 0),
        recentVerifications: logs || [],
      });
    } catch (err) {
      console.error('Dashboard stats error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateInstitution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !institutionName.trim()) return;

    setIsOnboardingLoading(true);
    try {
      const { data: newInstitutionId, error } = await supabase.rpc(
        'create_institution_for_current_user',
        { _name: institutionName.trim() }
      );

      if (error) throw error;

      if (newInstitutionId) {
        await supabase.rpc('switch_active_institution', {
          _institution_id: newInstitutionId,
        });
      }

      toast({
        title: 'Institution created!',
        description: 'You are now the admin of your institution.',
      });

      await refreshAuth();
      await fetchUserInstitutions();
      setInstitutionName('');
      setShowInstitutionModal(false);
    } catch (error: any) {
      console.error('Create institution error:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create institution.',
        variant: 'destructive',
      });
    } finally {
      setIsOnboardingLoading(false);
    }
  };

  const handleSearchInstitutions = async () => {
    if (!joinCode.trim()) return;

    setIsOnboardingLoading(true);
    try {
      const { data, error } = await supabase
        .from('institutions')
        .select('id, name, slug')
        .or(`slug.ilike.%${joinCode}%,name.ilike.%${joinCode}%`)
        .limit(5);

      if (error) throw error;

      setSearchResults(data || []);
      if (data?.length === 0) {
        toast({
          title: 'No institutions found',
          description: 'Try a different search term.',
        });
      }
    } catch (error: any) {
      console.error('Search error:', error);
      toast({
        title: 'Search failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsOnboardingLoading(false);
    }
  };

  const handleLinkProvider = async (provider: 'google' | 'github') => {
    if (!selectedInstitution) return;
    setIsLinkingProvider(provider);
    try {
      const redirectUrl = `${window.location.origin}/dashboard?autoJoin=${selectedInstitution}`;
      const { error } = await supabase.auth.linkIdentity({
        provider,
        options: { redirectTo: redirectUrl },
      });
      if (error) throw error;
    } catch (err: any) {
      console.error('Link identity error:', err);
      toast({
        title: 'Linking error',
        description: err.message || 'Failed to link identity provider.',
        variant: 'destructive',
      });
      setIsLinkingProvider(null);
    }
  };

  const handleJoinInstitution = async () => {
    console.log('handleJoinInstitution triggered:', { userId: user?.id, selectedInstitution });
    if (!user || !selectedInstitution) {
      console.warn('handleJoinInstitution missing user or selectedInstitution');
      toast({
        title: 'Please select an institution',
        description: 'Choose an institution from the list before requesting to join.',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Check if user has an OAuth provider linked
      const hasOAuth = checkHasOAuthProvider();
      console.log('checkHasOAuthProvider result:', hasOAuth);

      if (!hasOAuth) {
        setShowInstitutionModal(false);
        setShowLinkIdentityModal(true);
        return;
      }

      setIsOnboardingLoading(true);
      const { error } = await supabase.rpc('join_institution_for_current_user', {
        _institution_id: selectedInstitution,
      });

      if (error) throw error;

      toast({
        title: 'Request Submitted!',
        description: 'Your request to join the institution is pending administrator approval.',
      });

      await refreshAuth();
      await fetchUserInstitutions();
      setJoinCode('');
      setSearchResults([]);
      setSelectedInstitution(null);
      setOnboardingStep('choice');
      setShowInstitutionModal(false);
    } catch (error: any) {
      console.error('Join error:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to submit join request.',
        variant: 'destructive',
      });
    } finally {
      setIsOnboardingLoading(false);
    }
  };

  const handleSwitchInstitution = async (instId: string) => {
    if (!user || instId === institutionId) return;
    
    setIsSwitching(true);
    try {
      const { error } = await supabase.rpc('switch_active_institution', {
        _institution_id: instId,
      });
      
      if (error) throw error;
      
      toast({
        title: 'Switched institution',
        description: 'You are now viewing a different institution.',
      });
      
      await refreshAuth();
      await fetchUserInstitutions();
    } catch (error: any) {
      console.error('Switch error:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to switch institution.',
        variant: 'destructive',
      });
    } finally {
      setIsSwitching(false);
    }
  };

  const getSelectedMembership = () => {
    if (!selectedInstitution) return null;
    return userInstitutions.find((ui) => ui.institution_id === selectedInstitution);
  };

  const renderSmartActionButton = (isModal = false) => {
    const membership = getSelectedMembership();

    if (membership?.status === 'approved') {
      return (
        <Button
          onClick={() => {
            if (selectedInstitution) {
              handleSwitchInstitution(selectedInstitution);
              if (isModal) setShowInstitutionModal(false);
            }
          }}
          className={`flex-1 ${isModal ? '' : 'gradient-primary border-0'}`}
          disabled={isOnboardingLoading || isSwitching || !selectedInstitution}
        >
          {isSwitching ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Switching...
            </>
          ) : (
            'Enter Institution'
          )}
        </Button>
      );
    }

    if (membership?.status === 'pending') {
      return (
        <Button
          disabled
          variant="outline"
          className="flex-1 border-amber-500/30 text-amber-600 bg-amber-500/10 cursor-not-allowed font-medium"
        >
          <Clock className="h-4 w-4 mr-2" />
          Pending Approval
        </Button>
      );
    }

    return (
      <Button
        onClick={handleJoinInstitution}
        className={`flex-1 ${isModal ? '' : 'gradient-primary border-0'}`}
        disabled={isOnboardingLoading || !selectedInstitution}
      >
        {isOnboardingLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Submitting Request...
          </>
        ) : (
          'Request to Join'
        )}
      </Button>
    );
  };

  if (authLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  const quickActions = isAdmin
    ? [
        {
          icon: Search,
          title: 'Verify Identity',
          description: 'Search and verify records',
          href: '/verify',
          primary: true,
        },
        {
          icon: Users,
          title: 'Manage Records',
          description: 'View all records',
          href: '/admin',
        },
        {
          icon: Settings,
          title: 'Settings',
          description: 'Configure your account',
          href: '/settings',
        },
        {
          icon: FileText,
          title: 'Help',
          description: 'API & guides',
          href: '/docs',
        },
      ]
    : [
        {
          icon: Search,
          title: 'Verify Identity',
          description: 'Search and verify records',
          href: '/verify',
          primary: true,
        },
        {
          icon: FileText,
          title: 'Help',
          description: 'API & guides',
          href: '/docs',
        },
      ];

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const firstName = user.user_metadata?.full_name?.split(' ')[0] || 'there';

  const handleOpenSwitchModal = (action: 'create' | 'join') => {
    if (institutionId) {
      setPendingAction(action);
      setShowConfirmSwitch(true);
    } else {
      setOnboardingStep(action);
      setShowInstitutionModal(true);
    }
  };

  const handleConfirmSwitch = () => {
    setShowConfirmSwitch(false);
    if (pendingAction) {
      setOnboardingStep(pendingAction);
      setShowInstitutionModal(true);
      setPendingAction(null);
    }
  };

  const handleCloseModal = () => {
    setShowInstitutionModal(false);
    setOnboardingStep('choice');
    setJoinCode('');
    setSearchResults([]);
    setSelectedInstitution(null);
    setInstitutionName('');
  };

  // Show onboarding if user has no institution
  if (!institutionId) {
    return (
      <Layout>
        <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center p-4">
          <div className="w-full max-w-lg">
            <div className="text-center mb-8">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl gradient-primary mx-auto mb-4">
                <Shield className="h-7 w-7 text-primary-foreground" />
              </div>
              <h1 className="font-display text-2xl font-bold mb-2">
                {getGreeting()}, {firstName}!
              </h1>
              <p className="text-muted-foreground">
                {onboardingStep === 'choice' && 'Get started by creating or joining an institution'}
                {onboardingStep === 'create' && 'Create your new institution'}
                {onboardingStep === 'join' && 'Find and join an existing institution'}
              </p>
            </div>

            {userInstitutions.some((inst) => inst.status === 'pending') && (
              <Card className="border-amber-500/20 bg-amber-500/5 mb-6">
                <CardContent className="p-6 space-y-3">
                  <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-semibold">
                    <Clock className="h-5 w-5" />
                    <span>Pending Join Requests</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Your request to join the following institution(s) is pending administrator approval:
                  </p>
                  <div className="space-y-2 pt-1">
                    {userInstitutions
                      .filter((inst) => inst.status === 'pending')
                      .map((inst) => (
                        <div
                          key={inst.institution_id}
                          className="flex items-center justify-between p-3 rounded-lg border border-amber-500/20 bg-card"
                        >
                          <div>
                            <div className="font-medium text-sm">{inst.institution_name}</div>
                            <div className="text-xs text-muted-foreground font-mono">{inst.institution_slug}</div>
                          </div>
                          <Badge variant="outline" className="border-amber-500/50 text-amber-600 dark:text-amber-400 bg-amber-500/10 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Pending Approval
                          </Badge>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {onboardingStep === 'choice' && (
              <div className="grid gap-4">
                <Card 
                  className="cursor-pointer transition-all hover:shadow-lg hover:border-primary/50 group"
                  onClick={() => setOnboardingStep('create')}
                >
                  <CardContent className="p-6 flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                      <Plus className="h-6 w-6" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold mb-1">Create Institution</h3>
                      <p className="text-sm text-muted-foreground">
                        Start fresh and set up your own verification portal
                      </p>
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                  </CardContent>
                </Card>

                <Card 
                  className="cursor-pointer transition-all hover:shadow-lg hover:border-primary/50 group"
                  onClick={() => setOnboardingStep('join')}
                >
                  <CardContent className="p-6 flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary text-foreground shrink-0 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                      <Users className="h-6 w-6" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold mb-1">Request to Join Institution</h3>
                      <p className="text-sm text-muted-foreground">
                        Request authorization to connect with an existing institution
                      </p>
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                  </CardContent>
                </Card>
              </div>
            )}

            {onboardingStep === 'create' && (
              <Card>
                <CardContent className="p-6">
                  <form onSubmit={handleCreateInstitution} className="space-y-5">
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
                        disabled={isOnboardingLoading}
                        required
                      />
                    </div>

                    <div className="flex gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setOnboardingStep('choice')}
                        disabled={isOnboardingLoading}
                        className="flex-1"
                      >
                        Back
                      </Button>
                      <Button
                        type="submit"
                        className="flex-1 gradient-primary border-0"
                        disabled={isOnboardingLoading || !institutionName.trim()}
                      >
                        {isOnboardingLoading ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            Creating...
                          </>
                        ) : (
                          'Create Institution'
                        )}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}

            {onboardingStep === 'join' && (
              <Card>
                <CardContent className="p-6 space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="joinCode" className="flex items-center gap-2">
                      <Search className="h-4 w-4 text-muted-foreground" />
                      Search by Name or Code
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        id="joinCode"
                        placeholder="Institution name or code..."
                        value={joinCode}
                        onChange={(e) => setJoinCode(e.target.value)}
                        disabled={isOnboardingLoading}
                      />
                      <Button
                        type="button"
                        onClick={handleSearchInstitutions}
                        disabled={isOnboardingLoading || !joinCode.trim()}
                        variant="secondary"
                      >
                        {isOnboardingLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Search'}
                      </Button>
                    </div>
                  </div>

                  {searchResults.length > 0 && (
                    <div className="space-y-2">
                      <Label>Select Institution</Label>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {searchResults.map((inst) => {
                          const membership = userInstitutions.find((ui) => ui.institution_id === inst.id);
                          return (
                            <div
                              key={inst.id}
                              onClick={() => setSelectedInstitution(inst.id)}
                              className={`p-3 rounded-lg border cursor-pointer transition-colors flex items-center justify-between ${
                                selectedInstitution === inst.id
                                  ? 'border-primary bg-primary/5'
                                  : 'border-border hover:border-primary/50'
                              }`}
                            >
                              <div>
                                <div className="font-medium text-sm">{inst.name}</div>
                                <div className="text-xs text-muted-foreground font-mono">{inst.slug}</div>
                              </div>
                              {membership?.status === 'approved' && (
                                <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 text-xs">
                                  Member
                                </Badge>
                              )}
                              {membership?.status === 'pending' && (
                                <Badge variant="outline" className="border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10 text-xs flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  Pending
                                </Badge>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setOnboardingStep('choice');
                        setSearchResults([]);
                        setSelectedInstitution(null);
                      }}
                      disabled={isOnboardingLoading}
                      className="flex-1"
                    >
                      Back
                    </Button>
                    {renderSmartActionButton(false)}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-[calc(100vh-8rem)]">
        {/* Hero Welcome Section */}
        <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-b border-border/50">
          <div className="container px-4 py-8 md:py-12">
            <div className="animate-fade-in">
              <div className="flex items-center gap-2 text-primary mb-2">
                <Shield className="h-5 w-5" />
                <span className="text-sm font-medium">VerifyID Home</span>
              </div>
              <h1 className="font-display text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight mb-2">
                {getGreeting()}, {firstName}!
              </h1>
              <p className="text-muted-foreground text-sm sm:text-base max-w-md">
                {institution ? `${institution.name} • ` : ''}
                Ready to verify identities and manage your records.
              </p>
            </div>
          </div>
        </div>

        <div className="container px-4 py-6 md:py-8 space-y-6 md:space-y-8">
          {/* Quick Actions */}
          <div className="animate-fade-in" style={{ animationDelay: '0.2s' }}>
            <h2 className="font-display text-lg font-semibold mb-4">Quick Actions</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
              {quickActions.map((action) => (
                <Link key={action.title} to={action.href}>
                  <Card 
                    className={`h-full transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 cursor-pointer group ${
                      action.primary 
                        ? 'bg-gradient-to-br from-primary to-primary/80 text-primary-foreground border-0' 
                        : 'hover:border-primary/30'
                    }`}
                  >
                    <CardContent className="p-4 md:p-5">
                      <action.icon className={`h-5 w-5 md:h-6 md:w-6 mb-3 ${
                        action.primary ? 'text-primary-foreground' : 'text-primary'
                      }`} />
                      <h3 className={`font-medium text-sm md:text-base mb-1 ${
                        action.primary ? '' : 'text-foreground'
                      }`}>
                        {action.title}
                      </h3>
                      <p className={`text-xs hidden sm:block ${
                        action.primary ? 'text-primary-foreground/80' : 'text-muted-foreground'
                      }`}>
                        {action.description}
                      </p>
                      <ArrowRight className={`h-4 w-4 mt-2 transition-transform group-hover:translate-x-1 ${
                        action.primary ? 'text-primary-foreground/70' : 'text-muted-foreground'
                      }`} />
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>

          {/* Institution Management */}
          <div className="animate-fade-in" style={{ animationDelay: '0.25s' }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg font-semibold">Institution</h2>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2" disabled={isSwitching}>
                    {isSwitching ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    <span className="hidden sm:inline">Switch</span>
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-72 bg-popover border border-border shadow-lg">
                  <DropdownMenuLabel className="text-xs text-muted-foreground">
                    Your Institutions ({userInstitutions.length})
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {userInstitutions.length === 0 ? (
                    <div className="px-2 py-3 text-sm text-muted-foreground text-center">
                      No other institutions
                    </div>
                  ) : (
                    userInstitutions.map((inst) => (
                      <DropdownMenuItem
                        key={inst.institution_id}
                        onClick={() => !inst.is_active && handleSwitchInstitution(inst.institution_id)}
                        className={`cursor-pointer ${inst.is_active ? 'bg-primary/10 border-l-2 border-primary' : 'hover:bg-muted'}`}
                      >
                        <div className="flex items-center gap-3 w-full py-1">
                          <div className={`flex h-8 w-8 items-center justify-center rounded-lg shrink-0 ${inst.is_active ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                            <Building2 className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{inst.institution_name}</p>
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <span className="capitalize">{inst.role}</span>
                              {inst.is_active && <span className="text-primary">• Active</span>}
                            </p>
                          </div>
                          {inst.is_active ? (
                            <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                          ) : (
                            <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                          )}
                        </div>
                      </DropdownMenuItem>
                    ))
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => handleOpenSwitchModal('join')} className="cursor-pointer">
                    <Users className="h-4 w-4 mr-2" />
                    Join Existing Institution
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleOpenSwitchModal('create')} className="cursor-pointer">
                    <Plus className="h-4 w-4 mr-2" />
                    Create New Institution
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="space-y-3">
              {/* Current Institution */}
              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="p-4 md:p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 md:h-12 md:w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shrink-0">
                        <Building2 className="h-5 w-5 md:h-6 md:w-6" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium">{institution?.name || 'Unknown'}</h3>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground font-medium">
                            Active
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground font-mono">{institution?.slug || ''}</p>
                      </div>
                    </div>
                    <div className="flex gap-2 sm:hidden">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenSwitchModal('join')}
                        className="gap-1.5"
                      >
                        <Users className="h-3.5 w-3.5" />
                        Join
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenSwitchModal('create')}
                        className="gap-1.5"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        New
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Other Institutions */}
              {userInstitutions.filter(inst => !inst.is_active).length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Other Memberships</p>
                  {userInstitutions
                    .filter(inst => !inst.is_active)
                    .map((inst) => (
                      <Card 
                        key={inst.institution_id} 
                        className="cursor-pointer hover:border-primary/50 transition-colors group"
                        onClick={() => handleSwitchInstitution(inst.institution_id)}
                      >
                        <CardContent className="p-3 md:p-4 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 md:h-10 md:w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground shrink-0 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                              <Building2 className="h-4 w-4 md:h-5 md:w-5" />
                            </div>
                            <div>
                              <h4 className="font-medium text-sm">{inst.institution_name}</h4>
                              <p className="text-xs text-muted-foreground">
                                <span className="font-mono">{inst.institution_slug}</span>
                                <span className="mx-1">•</span>
                                <span className="capitalize">{inst.role}</span>
                              </p>
                            </div>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            disabled={isSwitching}
                            className="gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            {isSwitching ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <>
                                <RefreshCw className="h-3.5 w-3.5" />
                                Switch
                              </>
                            )}
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                </div>
              )}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="animate-fade-in" style={{ animationDelay: '0.3s' }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg font-semibold">Recent Activity</h2>
              {stats?.recentVerifications && stats.recentVerifications.length > 0 && (
                <Link to="/activity" className="text-sm text-primary hover:underline flex items-center gap-1">
                  View all <ArrowRight className="h-3 w-3" />
                </Link>
              )}
            </div>

            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : stats?.recentVerifications && stats.recentVerifications.length > 0 ? (
              <div className="space-y-2">
                {stats.recentVerifications.map((log) => (
                  <Card key={log.id} className="hover:bg-muted/30 transition-colors">
                    <CardContent className="p-3 md:p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-9 w-9 md:h-10 md:w-10 items-center justify-center rounded-full shrink-0 ${
                          log.verification_result 
                            ? 'bg-success/10 text-success' 
                            : 'bg-destructive/10 text-destructive'
                        }`}>
                          {log.verification_result ? (
                            <CheckCircle2 className="h-4 w-4 md:h-5 md:w-5" />
                          ) : (
                            <XCircle className="h-4 w-4 md:h-5 md:w-5" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-mono text-sm font-medium truncate">
                            {log.index_number}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {log.verification_result ? 'Verified successfully' : 'No match found'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                        <Clock className="h-3 w-3" />
                        <span className="hidden sm:inline">
                          {new Date(log.created_at).toLocaleDateString()}
                        </span>
                        <span className="sm:hidden">
                          {new Date(log.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center">
                  <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                    <Search className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <h3 className="font-medium mb-1">No verifications yet</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Start by verifying your first identity
                  </p>
                  <Link to="/verify">
                    <Button size="sm" className="gap-2">
                      <Search className="h-4 w-4" />
                      Start Verifying
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmSwitch} onOpenChange={setShowConfirmSwitch}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Switch Institution?</AlertDialogTitle>
            <AlertDialogDescription>
              You will leave your current institution ({institution?.name}). 
              {pendingAction === 'create' 
                ? ' You will become the admin of your new institution.'
                : ' You will join as a regular member of the new institution.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmSwitch}>
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Institution Modal */}
      <Dialog open={showInstitutionModal} onOpenChange={(open) => !open && handleCloseModal()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {onboardingStep === 'choice' && 'Manage Institution'}
              {onboardingStep === 'create' && 'Create New Institution'}
              {onboardingStep === 'join' && 'Join Institution'}
            </DialogTitle>
            <DialogDescription>
              {onboardingStep === 'choice' && 'Create a new institution or join an existing one'}
              {onboardingStep === 'create' && 'Set up your own verification portal'}
              {onboardingStep === 'join' && 'Search and join an existing institution'}
            </DialogDescription>
          </DialogHeader>

          {onboardingStep === 'choice' && (
            <div className="grid gap-3 pt-2">
              <Card 
                className="cursor-pointer transition-all hover:shadow-md hover:border-primary/50 group"
                onClick={() => setOnboardingStep('create')}
              >
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <Plus className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-sm">Create Institution</h3>
                    <p className="text-xs text-muted-foreground">Start fresh with your own portal</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </CardContent>
              </Card>

              <Card 
                className="cursor-pointer transition-all hover:shadow-md hover:border-primary/50 group"
                onClick={() => setOnboardingStep('join')}
              >
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-foreground shrink-0 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <Users className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-sm">Join Institution</h3>
                    <p className="text-xs text-muted-foreground">Connect with an existing one</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </CardContent>
              </Card>
            </div>
          )}

          {onboardingStep === 'create' && (
            <form onSubmit={handleCreateInstitution} className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="modalInstitutionName" className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  Institution Name
                </Label>
                <Input
                  id="modalInstitutionName"
                  placeholder="Acme University"
                  value={institutionName}
                  onChange={(e) => setInstitutionName(e.target.value)}
                  disabled={isOnboardingLoading}
                  required
                />
              </div>

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOnboardingStep('choice')}
                  disabled={isOnboardingLoading}
                  className="flex-1"
                >
                  Back
                </Button>
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={isOnboardingLoading || !institutionName.trim()}
                >
                  {isOnboardingLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Creating...
                    </>
                  ) : (
                    'Create Institution'
                  )}
                </Button>
              </div>
            </form>
          )}

          {onboardingStep === 'join' && (
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="modalJoinCode" className="flex items-center gap-2">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  Search by Name or Code
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="modalJoinCode"
                    placeholder="Institution name or code..."
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value)}
                    disabled={isOnboardingLoading}
                  />
                  <Button
                    type="button"
                    onClick={handleSearchInstitutions}
                    disabled={isOnboardingLoading || !joinCode.trim()}
                    variant="secondary"
                  >
                    {isOnboardingLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Search'}
                  </Button>
                </div>
              </div>

              {searchResults.length > 0 && (
                <div className="space-y-2">
                  <Label>Select Institution</Label>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {searchResults.map((inst) => {
                      const membership = userInstitutions.find((ui) => ui.institution_id === inst.id);
                      return (
                        <div
                          key={inst.id}
                          onClick={() => setSelectedInstitution(inst.id)}
                          className={`p-3 rounded-lg border cursor-pointer transition-colors flex items-center justify-between ${
                            selectedInstitution === inst.id
                              ? 'border-primary bg-primary/5'
                              : 'border-border hover:border-primary/50'
                          }`}
                        >
                          <div>
                            <div className="font-medium text-sm">{inst.name}</div>
                            <div className="text-xs text-muted-foreground font-mono">{inst.slug}</div>
                          </div>
                          {membership?.status === 'approved' && (
                            <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 text-xs">
                              Member
                            </Badge>
                          )}
                          {membership?.status === 'pending' && (
                            <Badge variant="outline" className="border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10 text-xs flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Pending
                            </Badge>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setOnboardingStep('choice');
                    setSearchResults([]);
                    setSelectedInstitution(null);
                  }}
                  disabled={isOnboardingLoading}
                  className="flex-1"
                >
                  Back
                </Button>
                {renderSmartActionButton(true)}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Step-Up Identity Verification Modal */}
      <Dialog open={showLinkIdentityModal} onOpenChange={setShowLinkIdentityModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary mb-3">
              <Shield className="h-6 w-6" />
            </div>
            <DialogTitle className="text-center text-xl font-bold">Step-Up Verification Required</DialogTitle>
            <DialogDescription className="text-center pt-2">
              Joining an institution requires linking a provider-verified OAuth identity (Google or GitHub) to your account.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleLinkProvider('google')}
              disabled={isLinkingProvider !== null}
              className="w-full py-5 text-sm font-medium flex items-center justify-center gap-3 border-border hover:bg-secondary"
            >
              {isLinkingProvider === 'google' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <svg className="h-4 w-4" viewBox="0 0 24 24">
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
              Link Google Account & Continue
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => handleLinkProvider('github')}
              disabled={isLinkingProvider !== null}
              className="w-full py-5 text-sm font-medium flex items-center justify-center gap-3 border-border hover:bg-secondary"
            >
              {isLinkingProvider === 'github' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                  <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                </svg>
              )}
              Link GitHub Account & Continue
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
