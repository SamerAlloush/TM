import mongoose from 'mongoose';
import { connectDB } from '../config/database';
import { User } from '../models/User';

/**
 * Migration script to fix invalid 'Mechanics' role
 * Updates all users with role 'Mechanics' to 'Worker'
 */

const fixMechanicsRole = async () => {
  try {
    console.log('🔧 Starting Mechanics role migration...\n');
    
    // Connect to database
    await connectDB();
    console.log('✅ Connected to database');

    // Find users with invalid 'Mechanics' role
    const mechanicsUsers = await User.find({ role: 'Mechanics' });
    console.log(`🔍 Found ${mechanicsUsers.length} user(s) with invalid 'Mechanics' role:`);
    
    if (mechanicsUsers.length === 0) {
      console.log('ℹ️  No users found with "Mechanics" role. Nothing to fix.');
      process.exit(0);
    }

    // Display users that will be updated
    mechanicsUsers.forEach((user, index) => {
      console.log(`   ${index + 1}. ${user.firstName} ${user.lastName} (${user.email})`);
    });

    console.log('\n🔄 Updating roles from "Mechanics" to "Worker"...');

    // Update all users with 'Mechanics' role to 'Worker'
    const updateResult = await User.updateMany(
      { role: 'Mechanics' },
      { $set: { role: 'Worker' } }
    );

    console.log(`✅ Successfully updated ${updateResult.modifiedCount} user(s)`);
    
    // Verify the update
    const remainingMechanics = await User.countDocuments({ role: 'Mechanics' });
    const newWorkers = await User.find({ 
      email: { $in: mechanicsUsers.map(u => u.email) },
      role: 'Worker' 
    });

    console.log('\n📊 Migration Results:');
    console.log(`   - Users with "Mechanics" role remaining: ${remainingMechanics}`);
    console.log(`   - Users successfully converted to "Worker": ${newWorkers.length}`);
    
    if (remainingMechanics === 0 && newWorkers.length === mechanicsUsers.length) {
      console.log('\n🎉 Migration completed successfully!');
      console.log('✅ All users with "Mechanics" role have been updated to "Worker"');
    } else {
      console.log('\n⚠️  Migration may have issues. Please verify manually.');
    }

    console.log('\n📋 Next Steps:');
    console.log('1. Restart your backend server');
    console.log('2. Test login with affected users');
    console.log('3. Update seed scripts to prevent future issues');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    // Close database connection
    await mongoose.connection.close();
    console.log('\n📝 Database connection closed');
    process.exit(0);
  }
};

// Run the migration if this script is executed directly
if (require.main === module) {
  fixMechanicsRole();
}

export default fixMechanicsRole; 