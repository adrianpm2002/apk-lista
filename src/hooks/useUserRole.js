import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

export default function useUserRole() {
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setRole(null); setLoading(false); return; }
        const { data, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .maybeSingle();
        if (error) throw error;
        setRole(data?.role || null);
      } catch (e) {
        setError(e.message || 'role_fetch_error');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return { role, loading, error };
}
