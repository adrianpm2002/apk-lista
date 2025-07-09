import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://kathcxgrriikfdwvqhpz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImthdGhjeGdycmlpa2Zkd3ZxaHB6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIwOTI3MzgsImV4cCI6MjA2NzY2ODczOH0.68aj45VrDvrcJT0dNX3OSIGZeLjld-W4du3SbVxkSKE';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);