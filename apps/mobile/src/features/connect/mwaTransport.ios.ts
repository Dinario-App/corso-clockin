import { MwaError, type MwaTransact } from './mwaTypes';

export const mwaTransact: MwaTransact = async () => {
  throw new MwaError('platform_unsupported');
};
