import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface Institution {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  welcome_text: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  institutionId: string | null;
  institution: Institution | null;
  isLoading: boolean;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithOAuth: (provider: 'google' | 'github') => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [institutionId, setInstitutionId] = useState<string | null>(null);
  const [institution, setInstitution] = useState<Institution | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const checkRolesAndInstitution = async (userId: string) => {
    try {
      // Fetch roles + active institution flag + status
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('role, institution_id, is_active, status')
        .eq('user_id', userId);

      if (rolesError) {
        console.error('Error checking roles:', rolesError);
        return { isAdmin: false, isSuperAdmin: false, institutionId: null };
      }

      const approvedRoles = roles?.filter((r: any) => !r.status || r.status === 'approved') ?? [];
      const hasSuperAdmin = roles?.some((r) => r.role === 'super_admin') ?? false;

      // Prefer the explicitly active institution among approved roles
      const activeInstitutionId =
        approvedRoles.find((r) => r.is_active && r.institution_id)?.institution_id ??
        approvedRoles.find((r) => r.institution_id)?.institution_id ??
        null;

      // Admin should be scoped to the active institution (super_admin overrides)
      const hasAdminForActiveInstitution = activeInstitutionId
        ? approvedRoles.some((r) => r.role === 'admin' && r.institution_id === activeInstitutionId) ?? false
        : false;

      return {
        isAdmin: hasSuperAdmin || hasAdminForActiveInstitution,
        isSuperAdmin: hasSuperAdmin,
        institutionId: activeInstitutionId,
      };
    } catch (error) {
      console.error('Error checking roles:', error);
      return { isAdmin: false, isSuperAdmin: false, institutionId: null };
    }
  };

  const fetchInstitution = async (instId: string) => {
    try {
      const { data, error } = await supabase
        .from('institutions')
        .select('*')
        .eq('id', instId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching institution:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error fetching institution:', error);
      return null;
    }
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          setTimeout(async () => {
            const result = await checkRolesAndInstitution(session.user.id);
            setIsAdmin(result.isAdmin);
            setIsSuperAdmin(result.isSuperAdmin);
            setInstitutionId(result.institutionId);
            
            if (result.institutionId) {
              const inst = await fetchInstitution(result.institutionId);
              setInstitution(inst);
            } else {
              setInstitution(null);
            }
            setIsLoading(false);
          }, 0);
        } else {
          setIsAdmin(false);
          setIsSuperAdmin(false);
          setInstitutionId(null);
          setInstitution(null);
          setIsLoading(false);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        const result = await checkRolesAndInstitution(session.user.id);
        setIsAdmin(result.isAdmin);
        setIsSuperAdmin(result.isSuperAdmin);
        setInstitutionId(result.institutionId);
        
        if (result.institutionId) {
          const inst = await fetchInstitution(result.institutionId);
          setInstitution(inst);
        }
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, fullName: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
        },
      },
    });

    return { error: error as Error | null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    return { error: error as Error | null };
  };

  const signInWithOAuth = async (provider: 'google' | 'github') => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/dashboard`,
      },
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setIsAdmin(false);
    setIsSuperAdmin(false);
    setInstitutionId(null);
    setInstitution(null);
  };

  const refreshAuth = async () => {
    if (!user) return;
    
    const result = await checkRolesAndInstitution(user.id);
    setIsAdmin(result.isAdmin);
    setIsSuperAdmin(result.isSuperAdmin);
    setInstitutionId(result.institutionId);
    
    if (result.institutionId) {
      const inst = await fetchInstitution(result.institutionId);
      setInstitution(inst);
    } else {
      setInstitution(null);
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      session, 
      isAdmin, 
      isSuperAdmin, 
      institutionId, 
      institution,
      isLoading, 
      signUp, 
      signIn, 
      signInWithOAuth,
      signOut,
      refreshAuth
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
