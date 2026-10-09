import { useEffect, useState } from 'react';
import { fetchReviewHeadlines } from './fetchReviewHeadlines';
import type { ReviewHeadlinesResponse } from './types';

/** One read when Review mounts. A miss leaves the strip hidden. */
export function useReviewHeadlines(): ReviewHeadlinesResponse | null {
  const [body, setBody] = useState<ReviewHeadlinesResponse | null>(null);
  useEffect(() => {
    let live = true;
    void fetchReviewHeadlines().then((result) => {
      if (!live) return;
      setBody(result.ok ? result.body : null);
    });
    return () => {
      live = false;
    };
  }, []);
  return body;
}
