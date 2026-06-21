import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogFooter,
} from '@/shared/ui/primitives/dialog';
import { Button } from '@/shared/ui/primitives/button';
import { Input } from '@/shared/ui/primitives/input';
import { toast } from '@/shared/ui/primitives/sonner';
import { createMarket } from './api/markets';

export function CreateMarketDialog() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => createMarket(title.trim()),
    onSuccess: (m) => {
      toast.success(`Market created: ${m.title}`);
      setTitle('');
      setOpen(false);
      void qc.invalidateQueries({ queryKey: ['user-markets'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" /> Create Market
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a new market</DialogTitle>
          <DialogDescription>
            Deploys a fresh EventBasedPredictionMarket + AMM on Arc Testnet and seeds 1,000 ARCT of
            liquidity. The server signs with the deployer key.
          </DialogDescription>
        </DialogHeader>
        <Input
          autoFocus
          placeholder="Will ETH flip BTC by 2027?"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <DialogFooter>
          <Button
            disabled={title.trim().length === 0 || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {mutation.isPending ? 'Deploying…' : 'Deploy market'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
