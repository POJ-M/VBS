import { useRef, useCallback, useState } from 'react';

/**
 * Prevents duplicate submissions from double-clicks or rapid triggers.
 * Usage:
 *   const { submit, loading } = useSubmit(async () => { await api.create(data); });
 *   <button onClick={submit} disabled={loading}>Save</button>
 */
export function useSubmit(fn, onError) {
  const inFlight = useRef(false);
  const [loading, setLoading] = useState(false);

  const submit = useCallback(async (...args) => {
    if (inFlight.current) return;      // gate: block duplicate call
    inFlight.current = true;
    setLoading(true);
    try {
      await fn(...args);
    } catch (err) {
      if (onError) onError(err);
      else throw err;
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, [fn, onError]);

  return { submit, loading };
}

/**
 * Wraps a TanStack useMutation's mutateAsync to prevent double-clicks.
 * Usage:
 *   const mut = useMutation({ mutationFn: ... });
 *   const { submit, loading } = useMutationSubmit(mut);
 */
export function useMutationSubmit(mutation) {
  const inFlight = useRef(false);
  const [localLoading, setLocalLoading] = useState(false);

  const submit = useCallback(async (variables) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setLocalLoading(true);
    try {
      return await mutation.mutateAsync(variables);
    } finally {
      inFlight.current = false;
      setLocalLoading(false);
    }
  }, [mutation]);

  return {
    submit,
    loading: localLoading || mutation.isPending,
  };
}