 import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kpjomltsvhpvvtelxjfm.supabase.co';
const supabaseKey = 'sb_publishable_EphWs_iXGBMhsNI6tck4vg_1xlUlON5';

export const supabase = createClient(supabaseUrl, supabaseKey);