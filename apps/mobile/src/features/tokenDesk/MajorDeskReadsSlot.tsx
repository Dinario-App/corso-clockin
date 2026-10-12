import { usePlainRisk } from '@/src/features/plainRisk/usePlainRisk';
import { MajorDeskReads } from '@/src/ui/majorDetail/MajorDeskReads';
import { presentMajorDeskReads } from './majorDeskReads';
import { useMajorDeskReads } from './useMajorDeskReads';

export function MajorDeskReadsSlot({ mint }: { mint: string }) {
  const { vitals, mood } = useMajorDeskReads(mint);
  const risk = usePlainRisk(mint);
  return (
    <MajorDeskReads
      model={presentMajorDeskReads({ vitals, mood, nowMs: Date.now() })}
      risk={risk}
    />
  );
}
