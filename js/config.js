// js/config.js
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabaseUrl = "https://ofgkxoteuyldkwasydwp.supabase.co";
const supabaseKey = "sb_publishable_vUKrMriTZUzGve5JnhS_MQ_tvQ1fTQK";

// Чистимо та зчитуємо роль з локального сховища
const currentUserId = localStorage.getItem('userId') || '';
let userRole = localStorage.getItem('userRole') || ''; 

// Нормалізуємо роль: якщо на фронтенді вона записана як super_admin, приводимо до super-admin для бази
if (userRole === 'super_admin') {
  userRole = 'super-admin';
}

// Створюємо клієнт, передаючи захищені заголовки для RLS політик
export const supabase = createClient(supabaseUrl, supabaseKey, {
  global: {
    headers: {
      'X-Publisher-Id': currentUserId,
      'X-User-Role': userRole
    }
  },
  auth: {
    persistSession: true, // Зберігає системну сесію авторизації в браузері
    autoRefreshToken: true // Автоматично оновлює токени безпеки
  }
});

window.supabase = supabase;

console.log(`Supabase авторизовано! Роль в заголовках: ${userRole}`);