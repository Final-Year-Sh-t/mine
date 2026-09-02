import { Card, CardContent } from '@/components/ui/card';
import { Search, CheckCircle2, XCircle } from 'lucide-react';

interface DashboardStats {
  totalVerifications: number;
  successfulVerifications: number;
  failedVerifications: number;
  recentVerifications?: any[];
}

interface DashboardStatsGridProps {
  stats: DashboardStats | null;
  isLoading?: boolean;
}

export function DashboardStatsGrid({ stats }: DashboardStatsGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <Card className="bg-card border-border shadow-sm">
        <CardContent className="p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Verifications</p>
            <h3 className="font-display text-2xl font-bold mt-1">{stats?.totalVerifications ?? 0}</h3>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Search className="h-5 w-5" />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border shadow-sm">
        <CardContent className="p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Successful</p>
            <h3 className="font-display text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{stats?.successfulVerifications ?? 0}</h3>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border shadow-sm">
        <CardContent className="p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Failed / No Match</p>
            <h3 className="font-display text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">{stats?.failedVerifications ?? 0}</h3>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
            <XCircle className="h-5 w-5" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
