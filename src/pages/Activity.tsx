import { useEffect, useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
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
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Trash2,
  Search,
  Globe,
  Monitor,
} from 'lucide-react';

interface LogRow {
  id: string;
  index_number: string;
  verification_result: boolean;
  created_at: string;
  ip_address: string | null;
  user_agent: string | null;
  verified_by: string | null;
  institution_id: string | null;
}

export default function Activity() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [toDelete, setToDelete] = useState<LogRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (user) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function load() {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('verification_logs')
      .select('id, index_number, verification_result, created_at, ip_address, user_agent, verified_by, institution_id')
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) {
      toast({ title: 'Failed to load activity', description: error.message, variant: 'destructive' });
    } else {
      setLogs((data as LogRow[]) || []);
    }
    setIsLoading(false);
  }

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    const { error } = await supabase.from('verification_logs').delete().eq('id', toDelete.id);
    setDeleting(false);
    if (error) {
      toast({ title: 'Delete failed', description: error.message, variant: 'destructive' });
    } else {
      setLogs((prev) => prev.filter((l) => l.id !== toDelete.id));
      toast({ title: 'Log deleted' });
    }
    setToDelete(null);
  }

  if (authLoading) {
    return (
      <Layout>
        <div className="flex justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;

  const filtered = logs.filter((l) =>
    !search.trim() ? true : l.index_number.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Layout>
      <div className="container max-w-4xl mx-auto px-4 py-6 md:py-10">
        <div className="mb-6">
          <Link to="/dashboard" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3">
            <ArrowLeft className="h-4 w-4" /> Back to dashboard
          </Link>
          <h1 className="font-display text-2xl md:text-3xl font-semibold">Verification Activity</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Complete log of verification attempts. {logs.length} total.
          </p>
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by ID number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {isLoading ? (
          <div className="flex justify-center py-24">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-16 text-center text-sm text-muted-foreground">
              No activity found.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {filtered.map((log) => (
              <Card key={log.id}>
                <CardContent className="p-4 flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full shrink-0 ${
                      log.verification_result ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
                    }`}>
                      {log.verification_result ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-mono text-sm font-semibold truncate">{log.index_number}</p>
                        <Badge variant={log.verification_result ? 'default' : 'destructive'} className="text-[10px]">
                          {log.verification_result ? 'Verified' : 'No match'}
                        </Badge>
                      </div>
                      <div className="mt-1.5 space-y-1 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3 w-3" />
                          {new Date(log.created_at).toLocaleString()}
                        </div>
                        {log.ip_address && (
                          <div className="flex items-center gap-1.5">
                            <Globe className="h-3 w-3" />
                            <span className="font-mono">{log.ip_address}</span>
                          </div>
                        )}
                        {log.user_agent && (
                          <div className="flex items-start gap-1.5">
                            <Monitor className="h-3 w-3 mt-0.5 shrink-0" />
                            <span className="truncate" title={log.user_agent}>{log.user_agent}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setToDelete(log)}
                    className="text-muted-foreground hover:text-destructive shrink-0"
                    aria-label="Delete log"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this log?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the verification log for{' '}
              <span className="font-mono font-semibold">{toDelete?.index_number}</span>. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); confirmDelete(); }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
