/**
 * @fileoverview Authentication hook — extracted from App.jsx.
 */
import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

/**
 * Manages Supabase auth session state.
 * @returns {{ session: Object|null, authLoading: boolean }}
 */
export function useAuth() {
    const [session, setSession] = useState(null);
    const [authLoading, setAuthLoading] = useState(true);

    useEffect(() => {
        if (!supabase) {
            setAuthLoading(false);
            return;
        }

        supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
            setSession(currentSession);
            setAuthLoading(false);
        });

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, newSession) => {
            setSession(newSession);
        });

        return () => subscription.unsubscribe();
    }, []);

    return { session, authLoading };
}
