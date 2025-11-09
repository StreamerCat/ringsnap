import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lytnlrkdccqmxgdmdxef.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx5dG5scmtkY2NxbXhnZG1keGVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1ODQ3MDAsImV4cCI6MjA3NzE2MDcwMH0.57VMwoc9QQ0fTv-yELHY0pZO2LbYkJaR520PiB-i-6c';

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanupDatabase() {
  console.log('🚀 Starting database cleanup...\n');

  try {
    const { data, error } = await supabase.functions.invoke('cleanup-database', {
      body: {}
    });

    if (error) {
      console.error('❌ Error:', error);
      return;
    }

    console.log('✅ Cleanup completed successfully!\n');
    console.log('📊 Results:\n');
    console.log(JSON.stringify(data, null, 2));

  } catch (err) {
    console.error('❌ Failed to run cleanup:', err);
  }
}

cleanupDatabase();
