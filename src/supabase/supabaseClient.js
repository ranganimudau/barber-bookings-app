import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

// 1. Replace these with your actual Project credentials
export const supabaseUrl = "https://lrafqfmpxpjkvqfeabxx.supabase.co";
export const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxyYWZxZm1weHBqa3ZxZmVhYnh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA1MDA0MTMsImV4cCI6MjA4NjA3NjQxM30.efVQqMhzPyRdo_onNsrVK9PG84GOxAfmTACqhVEZw4c";

// 2. Initialize the Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // React Native has no address bar to read a session out of.
    detectSessionInUrl: false,
    // Critical for OAuth on native: PKCE returns the credential as ?code= in
    // the query string. The implicit flow returns it in the URL *fragment*
    // (#access_token=…), and Android routinely drops the fragment when it
    // hands a barberapp:// deep link to the app — so the callback arrived
    // carrying nothing, no session was created, and sign-in silently landed
    // back on the form even though the account had been created server-side.
    flowType: "pkce",
  },
});
