'use client';

import { memo } from 'react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import type { ProblemType } from '@/lib/constants';

interface ProblemTypeSelectorProps {
  selectedProblemType: ProblemType;
  onProblemTypeChange: (problemType: ProblemType) => void;
}

function PureProblemTypeSelector({
  selectedProblemType,
  onProblemTypeChange,
}: ProblemTypeSelectorProps) {
  return (
    <div className="flex items-center gap-4 rounded-lg border border-border bg-muted/50 p-2 px-3">
      <span className="text-muted-foreground text-xs">Problem Type:</span>
      <RadioGroup
        value={selectedProblemType}
        onValueChange={(value) => onProblemTypeChange(value as ProblemType)}
        className="flex gap-4"
      >
        <div className="flex items-center gap-2">
          <RadioGroupItem value="math" id="math" />
          <Label htmlFor="math" className="cursor-pointer font-normal text-sm">
            Math
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <RadioGroupItem value="fermi" id="fermi" />
          <Label htmlFor="fermi" className="cursor-pointer font-normal text-sm">
            Fermi
          </Label>
        </div>
      </RadioGroup>
    </div>
  );
}

export const ProblemTypeSelector = memo(
  PureProblemTypeSelector,
  (prevProps, nextProps) => {
    return prevProps.selectedProblemType === nextProps.selectedProblemType;
  },
);
