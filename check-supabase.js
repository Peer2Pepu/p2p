const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Supabase client
const supabase = createClient(
  `https://${process.env.NEXT_PUBLIC_SUPABASE_PROJECT_ID}.supabase.co`,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkSupabase() {
  console.log('Environment check:');
  console.log('Project ID:', process.env.NEXT_PUBLIC_SUPABASE_PROJECT_ID);
  console.log('Anon Key:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'Present' : 'Missing');
  console.log('Supabase URL:', `https://${process.env.NEXT_PUBLIC_SUPABASE_PROJECT_ID}.supabase.co`);
  console.log('');

  try {
    console.log('Fetching all markets from Supabase...');
    const { data, error } = await supabase
      .from('market')
      .select('*');

    if (error) {
      console.error('Supabase error:', error);
      return;
    }

    console.log('Found', data?.length || 0, 'markets');
    console.log('');
    
    if (data && data.length > 0) {
      console.log('Markets:');
      data.forEach((market, index) => {
        console.log(`${index + 1}. Market ID: ${market.market_id}`);
        console.log(`   IPFS: ${market.ipfs}`);
        console.log(`   Image: ${market.image}`);
        console.log(`   Creator: ${market.creator}`);
        console.log('');
      });
    } else {
      console.log('No markets found in Supabase!');
    }

  } catch (error) {
    console.error('Script error:', error);
  }
}

checkSupabase();
