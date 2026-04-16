import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://afvhvhnzmrcykpqlmqnr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_b5qxLBFPNW64wwYfCuoalA_oAUo3Viu";
// Get this from: Supabase Dashboard → Settings → API → anon public

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);