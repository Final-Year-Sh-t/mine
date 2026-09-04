import { Search, Loader2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

interface UserInstitution {
  institution_id: string;
  institution_name: string;
  institution_slug: string;
  role: string;
  status: 'pending' | 'approved' | 'rejected';
}

interface InstitutionSearchResult {
  id: string;
  name: string;
  slug: string;
}

interface InstitutionSearchListProps {
  joinCode: string;
  setJoinCode: (code: string) => void;
  handleSearchInstitutions: () => void;
  searchResults: InstitutionSearchResult[];
  selectedInstitution: string | null;
  setSelectedInstitution: (id: string | null) => void;
  userInstitutions: UserInstitution[];
  isOnboardingLoading: boolean;
  isSwitching: boolean;
  handleJoinInstitution: () => void;
  handleSwitchInstitution: (instId: string) => void;
  onBack?: () => void;
  isModal?: boolean;
}

export function InstitutionSearchList({
  joinCode,
  setJoinCode,
  handleSearchInstitutions,
  searchResults,
  selectedInstitution,
  setSelectedInstitution,
  userInstitutions,
  isOnboardingLoading,
  isSwitching,
  handleJoinInstitution,
  handleSwitchInstitution,
  onBack,
  isModal = false,
}: InstitutionSearchListProps) {
  const getSelectedMembership = () => {
    if (!selectedInstitution) return null;
    return userInstitutions.find((ui) => ui.institution_id === selectedInstitution);
  };

  const renderSmartActionButton = () => {
    const membership = getSelectedMembership();

    if (membership?.status === 'approved') {
      return (
        <Button
          onClick={() => {
            if (selectedInstitution) {
              handleSwitchInstitution(selectedInstitution);
              if (onBack) onBack();
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

  return (
    <div className="space-y-5">
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
        {onBack && (
          <Button
            type="button"
            variant="outline"
            onClick={onBack}
            disabled={isOnboardingLoading}
            className="flex-1"
          >
            Back
          </Button>
        )}
        {renderSmartActionButton()}
      </div>
    </div>
  );
}
