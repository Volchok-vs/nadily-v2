// js/config.js
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabaseUrl = "https://gwzfvvwnolxtjzwenccy.supabase.co";
const supabaseKey = "sb_publishable_reCTcDU2QDwLBvuFwUrnRQ_u4pEBlgZ";

// Беремо точні дані, які є в твоєму браузері
const currentUserId = localStorage.getItem('userId') || '';
const userRole = localStorage.getItem('userRole') || ''; 

// Створюємо клієнт, передаючи ID та Роль у заголовках
export const supabase = createClient(supabaseUrl, supabaseKey, {
  global: {
    headers: {
      'X-Publisher-Id': currentUserId,
      'X-User-Role': userRole // Сюди передається 'super_admin'
    }
  }
});

window.supabase = supabase;

console.log(`Supabase авторизовано! Роль: ${userRole}`);