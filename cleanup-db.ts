import { createClient } from '@supabase/supabase-js';

// Get environment variables
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://rmyvvbqnccpfeyowidrq.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('❌ ERROR: SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  console.log('\n📝 Please set it with:');
  console.log('export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"');
  console.log('\nYou can find this key in your Supabase project settings under API > service_role key');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const keepUserId = '9bb89fc3-926f-4ce4-9f85-19a6269a0c85';
const keepUserEmail = 'josh@launchedgepro.com';

async function cleanupDatabase() {
  console.log('🚀 Starting database cleanup...\n');
  console.log(`✅ Will keep user: ${keepUserEmail} (${keepUserId})\n`);

  try {
    // Step 1: Check current state
    console.log('📊 Step 1: Checking current database state...');
    const { data: currentUsers, error: listError } = await supabase.auth.admin.listUsers();

    if (listError) {
      console.error('❌ Error listing users:', listError);
      return;
    }

    console.log(`   Found ${currentUsers.users.length} total users:`);
    currentUsers.users.forEach(u => {
      const isKeep = u.id === keepUserId ? '✅ KEEP' : '❌ DELETE';
      console.log(`   ${isKeep} - ${u.email} (${u.id})`);
    });
    console.log();

    // Step 2: Show what will be deleted
    const usersToDelete = currentUsers.users.filter(u => u.id !== keepUserId);
    console.log(`🗑️  Step 2: Will delete ${usersToDelete.length} users\n`);

    if (usersToDelete.length === 0) {
      console.log('✨ No users to delete. Database is already clean!');
      return;
    }

    // Step 3: Cleanup
    console.log('🧹 Step 3: Starting cleanup...\n');

    // Delete role audit logs
    console.log('   Deleting role_audit_log entries...');
    const { error: auditError, count: auditCount } = await supabase
      .from('role_audit_log')
      .delete({ count: 'exact' })
      .neq('target_user_id', keepUserId);

    if (auditError) {
      console.error('   ⚠️  Error deleting audit logs:', auditError.message);
    } else {
      console.log(`   ✅ Deleted ${auditCount || 0} audit log entries`);
    }

    // Delete staff roles
    console.log('   Deleting staff_roles entries...');
    const { error: staffError, count: staffCount } = await supabase
      .from('staff_roles')
      .delete({ count: 'exact' })
      .neq('user_id', keepUserId);

    if (staffError) {
      console.error('   ⚠️  Error deleting staff roles:', staffError.message);
    } else {
      console.log(`   ✅ Deleted ${staffCount || 0} staff role entries`);
    }

    // Delete profiles
    console.log('   Deleting profiles...');
    const { error: profileError, count: profileCount } = await supabase
      .from('profiles')
      .delete({ count: 'exact' })
      .neq('id', keepUserId);

    if (profileError) {
      console.error('   ⚠️  Error deleting profiles:', profileError.message);
    } else {
      console.log(`   ✅ Deleted ${profileCount || 0} profiles`);
    }

    // Delete auth users
    console.log('   Deleting auth.users...');
    let deletedCount = 0;
    for (const user of usersToDelete) {
      const { error } = await supabase.auth.admin.deleteUser(user.id);
      if (error) {
        console.error(`   ⚠️  Failed to delete ${user.email}:`, error.message);
      } else {
        deletedCount++;
        console.log(`   ✅ Deleted user: ${user.email}`);
      }
    }
    console.log(`   Deleted ${deletedCount}/${usersToDelete.length} users\n`);

    // Step 4: Ensure correct role
    console.log('🔐 Step 4: Verifying your account...\n');

    console.log('   Upserting staff_role...');
    const { error: roleUpsertError } = await supabase
      .from('staff_roles')
      .upsert({
        user_id: keepUserId,
        role: 'platform_owner'
      }, {
        onConflict: 'user_id'
      });

    if (roleUpsertError) {
      console.error('   ⚠️  Error upserting staff role:', roleUpsertError.message);
    } else {
      console.log('   ✅ Staff role set to platform_owner');
    }

    console.log('   Upserting profile...');
    const { error: profileUpsertError } = await supabase
      .from('profiles')
      .upsert({
        id: keepUserId,
        name: 'Josh',
        email: keepUserEmail,
        phone: '',
        account_id: null
      }, {
        onConflict: 'id'
      });

    if (profileUpsertError) {
      console.error('   ⚠️  Error upserting profile:', profileUpsertError.message);
    } else {
      console.log('   ✅ Profile updated\n');
    }

    // Step 5: Final verification
    console.log('✨ Step 5: Final verification...\n');

    const { data: finalUsers } = await supabase.auth.admin.listUsers();
    const { count: staffCount2 } = await supabase.from('staff_roles').select('*', { count: 'exact', head: true });
    const { count: profileCount2 } = await supabase.from('profiles').select('*', { count: 'exact', head: true });

    console.log('📊 Final counts:');
    console.log(`   👥 Total users: ${finalUsers?.users.length || 0}`);
    console.log(`   🛡️  Total staff roles: ${staffCount2}`);
    console.log(`   👤 Total profiles: ${profileCount2}`);

    if (finalUsers && finalUsers.users.length > 0) {
      console.log(`\n   Remaining user: ${finalUsers.users[0].email}`);
    }

    console.log('\n✅ Database cleanup completed successfully! 🎉\n');

  } catch (error) {
    console.error('\n❌ Error during cleanup:', error);
    if (error instanceof Error) {
      console.error('Stack trace:', error.stack);
    }
  }
}

cleanupDatabase();
