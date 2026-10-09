import { fetch as expoFetch } from 'expo/fetch';
import type { PriceStreamOpener } from './usePriceStream';

export const openPriceStream: PriceStreamOpener = async (url, signal) => {
  const response = await expoFetch(url, {
    method: 'GET',
    headers: { accept: 'text/event-stream' },
    signal,
  });
  return { status: response.status, body: response.body };
};
