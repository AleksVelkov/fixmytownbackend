const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function testUserStats() {
  // Create Supabase client
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    // Get users from database - look for valid UUID
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, name, email')
      .limit(10);

    if (usersError) {
      console.error('❌ Error fetching users:', usersError);
      return;
    }

    if (!users || users.length === 0) {
      console.log('⚠️  No users found in database');
      return;
    }

    // Find a user with a valid UUID (format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const user = users.find(u => uuidRegex.test(u.id)) || users[0];
    
    console.log('✅ Found user:', { id: user.id, name: user.name, email: user.email });
    
    if (!uuidRegex.test(user.id)) {
      console.log('⚠️  User ID is not a valid UUID, API might reject it');
    }

    // Test the stats endpoint
    const response = await fetch(`http://localhost:3000/api/users/${user.id}/stats`);
    const data = await response.json();

    console.log('\n📊 User Stats Response:');
    console.log(JSON.stringify(data, null, 2));

    if (data.success) {
      console.log('\n✅ Stats endpoint is working!');
      console.log('Stats breakdown:');
      console.log(`  - Submitted: ${data.data.submitted}`);
      console.log(`  - Approved: ${data.data.approved}`);
      console.log(`  - In Progress: ${data.data.inProgress}`);
      console.log(`  - Resolved: ${data.data.resolved}`);
      console.log(`  - Upvotes Received: ${data.data.upvotesReceived}`);
      console.log(`  - Downvotes Received: ${data.data.downvotesReceived}`);
    } else {
      console.error('❌ Stats endpoint returned an error:', data);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testUserStats();

