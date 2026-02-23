const { createClient } = require('@supabase/supabase-js');
// Load env vars
require('dotenv').config({ path: '../../apps/web/.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in env check.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runTest() {
  console.log('Sending direct update to payroll_entries without status field...');
  const { data, error } = await supabase
    .from('payroll_entries')
    .update({ validated_hours: 1 })
    .eq('id', 'be03171c-acf3-4fa2-ba63-2bd379e8a4aa');
  
  if (error) {
    console.error('Update Failed:', JSON.stringify(error, null, 2));
  } else {
    console.log('Update Success!');
  }
}

runTest();
