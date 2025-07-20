import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { connectDB } from '../config/database';
import { User } from '../models/User';
import { Site } from '../models/Site';
import { Task } from '../models/Task';
import { Message } from '../models/Message';
import { Absence } from '../models/Absence';

const seedData = async () => {
  try {
    // Connect to database
    await connectDB();

    // Clear existing data
    console.log('🗑️  Clearing existing data...');
    await User.deleteMany({});
    await Site.deleteMany({});
    await Task.deleteMany({});
    await Message.deleteMany({});
    await Absence.deleteMany({});

    // Create sample users for all roles
    console.log('👥 Creating sample users...');
    const hashedPassword = await bcrypt.hash('password123', 10);

    const users = await User.create([
      {
        firstName: 'Admin',
        lastName: 'User',
        email: 'admin@tm-paysage.com',
        password: hashedPassword,
        role: 'Administrator',
        phone: '+33123456789',
        address: '123 Admin Street, Paris',
        isActive: true
      },
      {
        firstName: 'Marie',
        lastName: 'Dubois',
        email: 'rh@tm-paysage.com',
        password: hashedPassword,
        role: 'RH',
        phone: '+33234567890',
        address: '456 RH Avenue, Lyon',
        isActive: true
      },
      {
        firstName: 'Pierre',
        lastName: 'Martin',
        email: 'purchase@tm-paysage.com',
        password: hashedPassword,
        role: 'Purchase Department',
        phone: '+33345678901',
        address: '789 Purchase Boulevard, Marseille',
        isActive: true
      },
      {
        firstName: 'Jean',
        lastName: 'Moreau',
        email: 'worker@tm-paysage.com',
        password: hashedPassword,
        role: 'Worker',
        phone: '+33456789012',
        address: '321 Worker Road, Toulouse',
        isActive: true
      },
      {
        firstName: 'Sophie',
        lastName: 'Bernard',
        email: 'workshop@tm-paysage.com',
        password: hashedPassword,
        role: 'Workshop',
        phone: '+33567890123',
        address: '654 Workshop Lane, Nice',
        isActive: true
      },
      {
        firstName: 'Laurent',
        lastName: 'Durand',
        email: 'conductors@tm-paysage.com',
        password: hashedPassword,
        role: 'Conductors of Work',
        phone: '+33678901234',
        address: '987 Conductors Street, Nantes',
        isActive: true
      },
      {
        firstName: 'Isabelle',
        lastName: 'Lefebvre',
        email: 'accounting@tm-paysage.com',
        password: hashedPassword,
        role: 'Accounting',
        phone: '+33789012345',
        address: '147 Accounting Plaza, Strasbourg',
        isActive: true
      },
      {
        firstName: 'Thomas',
        lastName: 'Garcia',
        email: 'design@tm-paysage.com',
        password: hashedPassword,
        role: 'Bureau d\'Études',
        phone: '+33890123456',
        address: '258 Design Center, Bordeaux',
        isActive: true
      }
    ]);

    console.log(`✅ Created ${users.length} users`);

    // Create sample construction sites
    console.log('🏗️  Creating construction sites...');
    const sites = await Site.create([
      {
        name: 'Résidence Les Jardins',
        description: 'Construction of a luxury residential complex with 50 apartments',
        address: '123 Avenue des Jardins',
        city: 'Lyon',
        postalCode: '69001',
        startDate: new Date('2024-01-15'),
        expectedEndDate: new Date('2024-12-15'),
        status: 'Active',
        budget: 2500000,
        currentCost: 850000,
        projectManager: users.find(u => u.role === 'Conductors of Work')?._id,
        assignedUsers: [
          users.find(u => u.role === 'Conductors of Work')?._id,
          users.find(u => u.role === 'Worker')?._id,
          users.find(u => u.role === 'Workshop')?._id
        ],
        clientName: 'Immobilier Lyon SAS',
        clientContact: 'M. Dupont',
        clientEmail: 'dupont@immobilierlyon.fr',
        clientPhone: '+33472123456',
        priority: 'High',
        coordinates: {
          latitude: 45.7640,
          longitude: 4.8357
        }
      },
      {
        name: 'Centre Commercial Horizon',
        description: 'Renovation and expansion of existing shopping center',
        address: '456 Boulevard du Commerce',
        city: 'Marseille',
        postalCode: '13001',
        startDate: new Date('2024-03-01'),
        expectedEndDate: new Date('2024-10-31'),
        status: 'Active',
        budget: 1800000,
        currentCost: 450000,
        projectManager: users.find(u => u.role === 'Conductors of Work')?._id,
        assignedUsers: [
          users.find(u => u.role === 'Conductors of Work')?._id,
          users.find(u => u.role === 'Worker')?._id,
          users.find(u => u.role === 'Bureau d\'Études')?._id
        ],
        clientName: 'Commerce Méditerranée',
        clientContact: 'Mme. Laurent',
        clientEmail: 'laurent@commerce-med.fr',
        clientPhone: '+33491234567',
        priority: 'Medium',
        coordinates: {
          latitude: 43.2965,
          longitude: 5.3698
        }
      }
    ]);

    console.log(`✅ Created ${sites.length} construction sites`);

    // Update users with assigned sites
    await User.findByIdAndUpdate(
      users.find(u => u.role === 'Conductors of Work')?._id,
      { assignedSites: sites.map(s => s._id) }
    );
    await User.findByIdAndUpdate(
      users.find(u => u.role === 'Worker')?._id,
      { assignedSites: [sites[0]._id] }
    );
    await User.findByIdAndUpdate(
      users.find(u => u.role === 'Workshop')?._id,
      { assignedSites: [sites[0]._id] }
    );

    // Create sample tasks
    console.log('📋 Creating tasks...');
    const tasks = await Task.create([
      {
        title: 'Foundation Excavation',
        description: 'Complete excavation work for building foundation',
        site: sites[0]._id,
        assignedTo: [users.find(u => u.role === 'Worker')?._id],
        createdBy: users.find(u => u.role === 'Conductors of Work')?._id,
        status: 'In Progress',
        priority: 'High',
        startDate: new Date('2024-01-20'),
        dueDate: new Date('2024-02-15'),
        estimatedHours: 120,
        actualHours: 85,
        category: 'Foundation',
        location: 'Building A - Ground Level'
      },
      {
        title: 'Electrical Installation Planning',
        description: 'Plan electrical systems for residential units',
        site: sites[0]._id,
        assignedTo: [users.find(u => u.role === 'Bureau d\'Études')?._id],
        createdBy: users.find(u => u.role === 'Conductors of Work')?._id,
        status: 'Not Started',
        priority: 'Medium',
        dueDate: new Date('2024-03-01'),
        estimatedHours: 40,
        category: 'Electrical',
        location: 'All Buildings'
      },
      {
        title: 'Shopping Center Structural Assessment',
        description: 'Assess current structural integrity before renovation',
        site: sites[1]._id,
        assignedTo: [users.find(u => u.role === 'Bureau d\'Études')?._id],
        createdBy: users.find(u => u.role === 'Conductors of Work')?._id,
        status: 'Completed',
        priority: 'Critical',
        startDate: new Date('2024-03-05'),
        dueDate: new Date('2024-03-20'),
        completedDate: new Date('2024-03-18'),
        estimatedHours: 60,
        actualHours: 55,
        category: 'Structure',
        location: 'Main Structure'
      }
    ]);

    console.log(`✅ Created ${tasks.length} tasks`);

    // Create sample messages
    console.log('💬 Creating messages...');
    const messages = await Message.create([
      {
        sender: users.find(u => u.role === 'Conductors of Work')?._id,
        recipients: [users.find(u => u.role === 'Worker')?._id],
        subject: 'Foundation Work Update Required',
        content: 'Please provide an update on the foundation excavation progress. We need to coordinate with the concrete delivery schedule.',
        messageType: 'Internal',
        priority: 'High',
        category: 'Task',
        relatedSite: sites[0]._id,
        relatedTask: tasks[0]._id
      },
      {
        sender: users.find(u => u.role === 'Administrator')?._id,
        recipients: [
          users.find(u => u.role === 'RH')?._id,
          users.find(u => u.role === 'Accounting')?._id
        ],
        subject: 'Monthly Site Progress Meeting',
        content: 'Schedule monthly meeting to review progress on all active construction sites. Please prepare your reports.',
        messageType: 'Internal',
        priority: 'Medium',
        category: 'General'
      },
      {
        sender: users.find(u => u.role === 'Purchase Department')?._id,
        recipients: [],
        subject: 'Material Delivery Confirmation',
        content: 'Confirming delivery of steel beams for Résidence Les Jardins project scheduled for next Tuesday.',
        messageType: 'External Email',
        externalEmail: 'achat@tm-paysage.fr',
        priority: 'Medium',
        category: 'Purchase',
        relatedSite: sites[0]._id
      }
    ]);

    console.log(`✅ Created ${messages.length} messages`);

    // Create sample absences
    console.log('📅 Creating absences...');
    const absences = await Absence.create([
      {
        user: users.find(u => u.role === 'Worker')?._id,
        type: 'Vacation',
        startDate: new Date('2024-02-15'),
        endDate: new Date('2024-02-22'),
        reason: 'Family vacation',
        status: 'Approved',
        requestType: 'Request',
        isFullDay: true,
        dayCount: 6,
        approvedBy: users.find(u => u.role === 'RH')?._id,
        approvedAt: new Date('2024-02-01'),
        affectedSites: [sites[0]._id]
      },
      {
        user: users.find(u => u.role === 'Workshop')?._id,
        type: 'Sick Leave',
        startDate: new Date('2024-01-25'),
        endDate: new Date('2024-01-25'),
        reason: 'Medical appointment',
        status: 'Approved',
        requestType: 'Declaration',
        isFullDay: false,
        startTime: '14:00',
        endTime: '18:00',
        dayCount: 0.5,
        approvedBy: users.find(u => u.role === 'RH')?._id
      },
      {
        user: users.find(u => u.role === 'Bureau d\'Études')?._id,
        type: 'Training',
        startDate: new Date('2024-03-10'),
        endDate: new Date('2024-03-12'),
        reason: 'CAD software training',
        status: 'Pending',
        requestType: 'Request',
        isFullDay: true,
        dayCount: 3
      }
    ]);

    console.log(`✅ Created ${absences.length} absences`);

    console.log('\n🎉 Seed data created successfully!');
    console.log('\n📊 Summary:');
    console.log(`👥 Users: ${users.length}`);
    console.log(`🏗️  Sites: ${sites.length}`);
    console.log(`📋 Tasks: ${tasks.length}`);
    console.log(`💬 Messages: ${messages.length}`);
    console.log(`📅 Absences: ${absences.length}`);
    
    console.log('\n🔐 Login credentials (all users have password: password123):');
    users.forEach(user => {
      console.log(`${user.role}: ${user.email}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding data:', error);
    process.exit(1);
  }
};

// Run the seed function
if (require.main === module) {
  seedData();
} 