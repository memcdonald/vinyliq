'use client';

import { DollarSign } from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import { Badge } from '@/components/ui/badge';

interface PricingBadgeProps {
  releaseId: number;
}

export function PricingBadge({ releaseId }: PricingBadgeProps) {
  const { data, isLoading } = trpc.album.getReleasePricing.useQuery(
    { releaseId },
    { enabled: !!releaseId },
  );

  if (isLoading) {
    return (
      <Badge variant="outline" className="animate-pulse text-xs">
        <DollarSign className="mr-0.5 h-3 w-3" />
        ...
      </Badge>
    );
  }

  if (!data) return null;

  if (data.lowestPrice !== null && data.lowestPrice > 0) {
    return (
      <Badge variant="outline" className="text-xs">
        <DollarSign className="mr-0.5 h-3 w-3" />
        From ${data.lowestPrice.toFixed(2)}
        {data.numForSale > 0 && (
          <span className="ml-1 text-muted-foreground">
            ({data.numForSale} for sale)
          </span>
        )}
      </Badge>
    );
  }

  if (data.numForSale > 0) {
    return (
      <Badge variant="outline" className="text-xs">
        <DollarSign className="mr-0.5 h-3 w-3" />
        {data.numForSale} for sale
      </Badge>
    );
  }

  return null;
}
