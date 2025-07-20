import mongoose from 'mongoose';
import { User } from '../models/User';
import { Document } from '../models/Document';
import { connectDB } from '../config/database';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

interface MigrationResult {
  success: boolean;
  usersUpdated: number;
  documentsUpdated: number;
  errors: string[];
}

/**
 * Role Migration Script
 * 
 * This script performs the following migrations:
 * 1. Updates all users with role 'Mechanics' to 'Worker'
 * 2. Updates all documents with 'Mechanics' in accessPermissions.roles to 'Worker'
 * 3. Provides detailed logging and rollback information
 */
class RoleMigration {
  
  static async migrateRoles(): Promise<MigrationResult> {
    const result: MigrationResult = {
      success: false,
      usersUpdated: 0,
      documentsUpdated: 0,
      errors: []
    };

    try {
      console.log('\n🚀 ===== ROLE MIGRATION STARTED =====');
      console.log('Migrating roles: Mechanics → Worker');
      console.log('=====================================\n');

      // Connect to database
      await connectDB();
      console.log('✅ Connected to database');

      // Start transaction for data consistency
      const session = await mongoose.startSession();
      await session.withTransaction(async () => {
        
        // 1. Migrate Users
        console.log('\n📊 Phase 1: Migrating User Roles');
        console.log('--------------------------------');
        
        const usersToUpdate = await User.find({ role: 'Mechanics' }).session(session);
        console.log(`Found ${usersToUpdate.length} users with role 'Mechanics'`);
        
        if (usersToUpdate.length > 0) {
          // Show users that will be updated
          console.log('\nUsers to be updated:');
          usersToUpdate.forEach(user => {
            console.log(`  - ${user.firstName} ${user.lastName} (${user.email})`);
          });

          // Update users
          const userUpdateResult = await User.updateMany(
            { role: 'Mechanics' },
            { $set: { role: 'Worker' } },
            { session }
          );
          
          result.usersUpdated = userUpdateResult.modifiedCount;
          console.log(`✅ Updated ${result.usersUpdated} users from 'Mechanics' to 'Worker'`);
        } else {
          console.log('ℹ️  No users with role "Mechanics" found');
        }

        // 2. Migrate Documents
        console.log('\n📄 Phase 2: Migrating Document Access Permissions');
        console.log('------------------------------------------------');
        
        const documentsToUpdate = await Document.find({
          'accessPermissions.roles': 'Mechanics'
        }).session(session);
        
        console.log(`Found ${documentsToUpdate.length} documents with 'Mechanics' in access permissions`);
        
        if (documentsToUpdate.length > 0) {
          // Show documents that will be updated
          console.log('\nDocuments to be updated:');
          documentsToUpdate.forEach(doc => {
            console.log(`  - ${doc.title} (ID: ${doc._id})`);
          });

          // Update documents by replacing 'Mechanics' with 'Worker' in the roles array
          const documentUpdateResult = await Document.updateMany(
            { 'accessPermissions.roles': 'Mechanics' },
            { 
              $set: { 
                'accessPermissions.roles.$[elem]': 'Worker' 
              } 
            },
            { 
              arrayFilters: [{ 'elem': 'Mechanics' }],
              session 
            }
          );
          
          result.documentsUpdated = documentUpdateResult.modifiedCount;
          console.log(`✅ Updated ${result.documentsUpdated} documents with access permissions`);
        } else {
          console.log('ℹ️  No documents with "Mechanics" role permissions found');
        }

        // 3. Verify Migration
        console.log('\n🔍 Phase 3: Verification');
        console.log('------------------------');
        
        const remainingMechanicsUsers = await User.countDocuments({ 
          role: 'Mechanics' 
        }).session(session);
        
        const remainingMechanicsDocuments = await Document.countDocuments({
          'accessPermissions.roles': 'Mechanics'
        }).session(session);
        
        if (remainingMechanicsUsers > 0 || remainingMechanicsDocuments > 0) {
          throw new Error(`Migration incomplete: ${remainingMechanicsUsers} users and ${remainingMechanicsDocuments} documents still have 'Mechanics' role`);
        }
        
        console.log('✅ Verification passed - no remaining "Mechanics" references found');
        
      });

      await session.endSession();
      
      // 4. Final Summary
      console.log('\n🎉 ===== MIGRATION COMPLETED SUCCESSFULLY =====');
      console.log(`✅ Users migrated: ${result.usersUpdated}`);
      console.log(`✅ Documents migrated: ${result.documentsUpdated}`);
      console.log('===============================================\n');
      
      result.success = true;
      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error(`❌ Migration failed: ${errorMessage}`);
      result.errors.push(errorMessage);
      return result;
    }
  }

  /**
   * Rollback migration (emergency use only)
   */
  static async rollbackMigration(): Promise<MigrationResult> {
    const result: MigrationResult = {
      success: false,
      usersUpdated: 0,
      documentsUpdated: 0,
      errors: []
    };

    try {
      console.log('\n⚠️  ===== ROLLBACK MIGRATION STARTED =====');
      console.log('Rolling back: Worker → Mechanics');
      console.log('CAUTION: This will revert role changes!');
      console.log('=========================================\n');

      await connectDB();
      
      const session = await mongoose.startSession();
      await session.withTransaction(async () => {
        
        // Rollback Users
        const userRollbackResult = await User.updateMany(
          { role: 'Worker' },
          { $set: { role: 'Mechanics' } },
          { session }
        );
        result.usersUpdated = userRollbackResult.modifiedCount;
        
        // Rollback Documents
        const documentRollbackResult = await Document.updateMany(
          { 'accessPermissions.roles': 'Worker' },
          { 
            $set: { 
              'accessPermissions.roles.$[elem]': 'Mechanics' 
            } 
          },
          { 
            arrayFilters: [{ 'elem': 'Worker' }],
            session 
          }
        );
        result.documentsUpdated = documentRollbackResult.modifiedCount;
        
      });

      await session.endSession();
      
      console.log(`✅ Rollback completed: ${result.usersUpdated} users, ${result.documentsUpdated} documents`);
      result.success = true;
      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error(`❌ Rollback failed: ${errorMessage}`);
      result.errors.push(errorMessage);
      return result;
    }
  }

  /**
   * Check current role status without making changes
   */
  static async checkRoleStatus(): Promise<void> {
    try {
      console.log('\n📊 ===== ROLE STATUS CHECK =====');
      
      await connectDB();
      
      // Count users by role
      const userRoleCounts = await User.aggregate([
        {
          $group: {
            _id: '$role',
            count: { $sum: 1 }
          }
        },
        {
          $sort: { _id: 1 }
        }
      ]);
      
      console.log('\nUser Role Distribution:');
      userRoleCounts.forEach(roleCount => {
        console.log(`  ${roleCount._id}: ${roleCount.count} users`);
      });
      
      // Count documents with role permissions
      const mechanicsUsers = await User.countDocuments({ role: 'Mechanics' });
      const workerUsers = await User.countDocuments({ role: 'Worker' });
      const mechanicsDocuments = await Document.countDocuments({
        'accessPermissions.roles': 'Mechanics'
      });
      const workerDocuments = await Document.countDocuments({
        'accessPermissions.roles': 'Worker'
      });
      
      console.log('\nMigration Status:');
      console.log(`  Users with "Mechanics" role: ${mechanicsUsers}`);
      console.log(`  Users with "Worker" role: ${workerUsers}`);
      console.log(`  Documents with "Mechanics" permissions: ${mechanicsDocuments}`);
      console.log(`  Documents with "Worker" permissions: ${workerDocuments}`);
      
      if (mechanicsUsers === 0 && mechanicsDocuments === 0) {
        console.log('\n✅ Migration appears to be complete');
      } else {
        console.log('\n⚠️  Migration may be needed');
      }
      
      console.log('==============================\n');
      
    } catch (error) {
      console.error('❌ Status check failed:', error);
    } finally {
      await mongoose.connection.close();
    }
  }
}

// Command line interface
async function main() {
  const command = process.argv[2];
  
  switch (command) {
    case 'migrate':
      console.log('Starting role migration...');
      const migrateResult = await RoleMigration.migrateRoles();
      console.log('\nMigration Result:', migrateResult);
      break;
      
    case 'rollback':
      console.log('⚠️  Starting rollback (use with caution)...');
      const rollbackResult = await RoleMigration.rollbackMigration();
      console.log('\nRollback Result:', rollbackResult);
      break;
      
    case 'status':
      await RoleMigration.checkRoleStatus();
      break;
      
    default:
      console.log('\n🔧 Role Migration Tool');
      console.log('======================');
      console.log('Usage: npm run migrate-roles <command>');
      console.log('\nCommands:');
      console.log('  migrate  - Migrate "Mechanics" role to "Worker"');
      console.log('  rollback - Rollback "Worker" role to "Mechanics" (emergency only)');
      console.log('  status   - Check current role distribution');
      console.log('\nExample:');
      console.log('  npm run migrate-roles migrate');
      console.log('  npm run migrate-roles status\n');
      break;
  }
  
  // Close database connection
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
  
  process.exit(0);
}

// Only run main if this script is executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Script execution failed:', error);
    process.exit(1);
  });
}

export { RoleMigration }; 