import type { CorsoSession } from '@/src/features/session/types';
import type { StepUpPolicy } from '@/src/lib/apiConfig';
import type { StepUpSignContext } from '@/src/features/security/getActiveSigner';

type PreparedStepUp =
  | { needed: false; policy: StepUpPolicy }
  | {
      needed: true;
      policy: StepUpPolicy;
      verifyPrivyMfa?: () => Promise<boolean>;
    };

type MessageSigner = {
  signMessage(message: Uint8Array): Promise<Uint8Array>;
  clear?: () => void;
};

export async function performRoutineMessageSignature(args: {
  session: CorsoSession;
  message: Uint8Array;
  prepareStepUp(input: {
    session: CorsoSession;
    notionalSol: null;
    surface: 'swap';
  }): Promise<PreparedStepUp>;
  getActiveSigner(context: StepUpSignContext): Promise<MessageSigner>;
}): Promise<Uint8Array> {
  const prepared = await args.prepareStepUp({
    session: args.session,
    notionalSol: null,
    surface: 'swap',
  });
  if (prepared.needed) {
    if (!prepared.verifyPrivyMfa || !(await prepared.verifyPrivyMfa())) {
      throw new Error('Routine step-up was not verified.');
    }
  }

  const signer = await args.getActiveSigner({
    session: args.session,
    notionalSol: null,
    surface: 'swap',
    verifyPrivyMfa: prepared.needed ? prepared.verifyPrivyMfa : undefined,
    policy: prepared.policy,
  });
  try {
    return await signer.signMessage(args.message);
  } finally {
    signer.clear?.();
  }
}
