import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';

export interface Institution {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  welcome_text: string;
}

export interface UserInstitution {
  institution_id: string;
  institution_name: string;
  institution_slug: string;
  role: string;
  is_active: boolean;
  status: 'pending' | 'approved' | 'rejected';
}

interface InstitutionContextType {
  institutionId: string | null;
  institution: Institution | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  userInstitutions: UserInstitution[];
  isLoading: boolean;
  refreshInstitution: () => Promise<void>;
}

const InstitutionContext = createContext<InstitutionContextType | undefined>(undefined);

export function InstitutionProvider({ children }: { children: ReactNode }) {
  const { user, isLoading: authLoading } = useAuth();
  const [institutionId, setInstitutionId] = useState<string | null>(null);
  const [institution, setInstitution] = useState<Institution | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [userInstitutions, setUserInstitutions] = useState<UserInstitution[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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

  const fetchUserInstitutions = async (userId: string) => {
    try {
      const { data, error } = await supabase.rpc('get_user_institutions', { _user_id: userId });
      if (error) {
        console.error('Error fetching user institutions:', error);
        return [];
      }
      return (data || []) as UserInstitution[];
    } catch (error) {
      console.error('Error fetching user institutions:', error);
      return [];
    }
  };

  const checkRolesAndInstitution = async (userId: string) => {
    try {
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('role, institution_id, is_active, status')
        .eq('user_id', userId);

      if (rolesError) {
        console.error('Error checking roles:', rolesError);
        return { isAdmin: false, isSuperAdmin: false, institutionId: null };
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('institution_id')
        .eq('user_id', userId)
        .maybeSingle();

      const approvedRoles = roles?.filter((r: any) => !r.status || r.status === 'approved') ?? [];
      const hasSuperAdmin = roles?.some((r) => r.role === 'super_admin') ?? false;

      const activeInstitutionId =
        approvedRoles.find((r) => r.is_active && r.institution_id)?.institution_id ??
        (profile?.institution_id && approvedRoles.some((r) => r.institution_id === profile.institution_id) ? profile.institution_id : null) ??
        approvedRoles.find((r) => r.institution_id)?.institution_id ??
        null;

      if (activeInstitutionId && !approvedRoles.some((r) => r.is_active && r.institution_id === activeInstitutionId)) {
        supabase.rpc('switch_active_institution', { _institution_id: activeInstitutionId }).then(({ error }) => {
          if (error) console.error('Error auto-activating institution:', error);
        });
      }

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

  const refreshInstitution = async () => {
    if (authLoading) {
      setIsLoading(true);
      return;
    }

    if (!user) {
      setInstitutionId(null);
      setInstitution(null);
      setIsAdmin(false);
      setIsSuperAdmin(false);
      setUserInstitutions([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const [roleResult, instList] = await Promise.all([
        checkRolesAndInstitution(user.id),
        fetchUserInstitutions(user.id),
      ]);

      setIsAdmin(roleResult.isAdmin);
      setIsSuperAdmin(roleResult.isSuperAdmin);
      setInstitutionId(roleResult.institutionId);
      setUserInstitutions(instList);

      if (roleResult.institutionId) {
        const instData = await fetchInstitution(roleResult.institutionId);
        setInstitution(instData);
      } else {
        setInstitution(null);
      }
    } catch (error) {
      console.error('Error in refreshInstitution:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshInstitution();
  }, [user?.id, authLoading]);

  return (
    <InstitutionContext.Provider
      value={{
        institutionId,
        institution,
        isAdmin,
        isSuperAdmin,
        userInstitutions,
        isLoading: isLoading || authLoading,
        refreshInstitution,
      }}
    >
      {children}
    </InstitutionContext.Provider>
  );
}

export function useInstitution() {
  const context = useContext(InstitutionContext);
  if (context === undefined) {
    throw new Error('useInstitution must be used within an InstitutionProvider');
  }
  return context;
}
