import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabaseUrl = "https://modsgjjtwxbdnlycvifp.supabase.co";
const supabaseKey = "sb_publishable_dbMty7e93fQwcZWdu_xeqw_3PUPc_3D";

// Створюємо клієнт один раз
export const supabase = createClient(supabaseUrl, supabaseKey);