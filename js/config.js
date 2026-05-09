// js/config.js
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabaseUrl = "https://modsgjjtwxbdnlycvifp.supabase.co";
const supabaseKey = "sb_publishable_dbMty7e93fQwcZWdu_xeqw_3PUPc_3D";

// Створюємо клієнт
export const supabase = createClient(supabaseUrl, supabaseKey);

// Додатково прикріплюємо до window, щоб старі скрипти (не модулі) теж працювали
window.supabase = supabase;

console.log("Supabase ініціалізовано через config.js");