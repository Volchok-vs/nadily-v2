// js/config.js
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabaseUrl = "https://pufuhmzcuwkujgmgpidi.supabase.co";
const supabaseKey = "sb_publishable_pMd6T2MEOTferloGG2To9g_UaRsLIcA";

// Створюємо клієнт
export const supabase = createClient(supabaseUrl, supabaseKey);

// Додатково прикріплюємо до window, щоб старі скрипти (не модулі) теж працювали
window.supabase = supabase;

console.log("Supabase ініціалізовано через config.js");