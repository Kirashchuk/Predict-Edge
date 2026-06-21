import { Link } from 'react-router-dom';
import { Button } from '@/shared/ui/primitives/button';

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <p className="font-mono text-heading-lg text-primary">404</p>
      <p className="text-muted-foreground">This market does not exist.</p>
      <Button asChild>
        <Link to="/">Back to markets</Link>
      </Button>
    </div>
  );
}
