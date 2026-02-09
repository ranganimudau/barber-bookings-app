import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

// 1. Replace these with your actual Project credentials
const supabaseUrl = "https://lrafqfmpxpjkvqfeabxx.supabase.co";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxyYWZxZm1weHBqa3ZxZmVhYnh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA1MDA0MTMsImV4cCI6MjA4NjA3NjQxM30.efVQqMhzPyRdo_onNsrVK9PG84GOxAfmTACqhVEZw4c";

// 2. Initialize the Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInTab: false,
  },
});
