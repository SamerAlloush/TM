# GS - Construction Site Manager

A full-stack cross-platform mobile application for construction company management with role-based access control, task management, messaging, and absence tracking.

## 🏗️ Features

### 👥 User Roles & Permissions (RBAC)
- **Administrator** - Full system access and user management
- **RH (Human Resources)** - Employee management and absence approvals
- **Purchase Department** - Material requests and supplier communications
- **Mechanics** - Field work and task execution
- **Workshop (Atelier)** - Equipment and workshop management
- **Conductors of Work** - Project supervision and coordination
- **Accounting** - Financial tracking and reporting
- **Bureau d'Études** - Design and planning

### 📊 Core Features
- **Dashboard** - Real-time construction site monitoring and metrics
- **Construction Site Management** - Site selection, task tracking, progress monitoring
- **Messaging System** - Internal messaging + external email integration
- **Profile Management** - User profiles with calendar view (work/absence days)
- **Document & Workflow Management** - Form submissions, approvals, file uploads
- **Absence Management** - Request/declaration system with approval workflow

### 📱 Technical Features
- Cross-platform mobile app (iOS/Android) built with React Native + Expo
- Secure JWT-based authentication with role-based access control
- RESTful API with Express.js and MongoDB
- Real-time notifications and updates
- File upload and document management
- Calendar integration for absence tracking
- External email integration (achat@tm-paysage.fr, atelier@tm-paysage.fr)

## 🛠️ Technology Stack

### Frontend
- **React Native** with TypeScript
- **Expo** for cross-platform development
- **React Navigation** for routing
- **React Native Paper** for UI components
- **React Query** for state management
- **Formik & Yup** for form handling

### Backend
- **Node.js** with TypeScript
- **Express.js** framework
- **MongoDB** with Mongoose ODM
- **JWT** for authentication
- **Bcrypt** for password hashing
- **Multer** for file uploads
- **Nodemailer** for email integration

### Security & Performance
- Helmet for security headers
- CORS configuration
- Rate limiting
- Input validation with express-validator
- Password encryption
- File size and type restrictions

## 🚀 Quick Start

### Prerequisites
- Node.js (v16 or higher)
- MongoDB (local or cloud)
- Expo CLI (`npm install -g @expo/cli`)
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd tm-paysage-site-manager
   ```

2. **Install all dependencies**
   ```bash
   npm run install:all
   ```

3. **Environment Setup**
   ```bash
   # Copy environment template
   cp env.example .env
   
   # Edit .env file with your configuration
   # Update MongoDB URI, JWT secret, email settings, etc.
   ```

4. **Start the application**
   ```bash
   # Start both backend and frontend
   npm run dev
   
   # Or start individually:
   npm run dev:backend  # Backend only
   npm run dev:frontend # Frontend only
   ```

5. **Seed the database** (Optional - adds sample data)
   ```bash
   npm run seed
   ```

### Default Login Credentials

After seeding, you can login with any of these accounts (password: `password123`):

- **Administrator**: admin@tm-paysage.com
- **RH**: rh@tm-paysage.com
- **Purchase**: purchase@tm-paysage.com
- **Mechanics**: mechanics@tm-paysage.com
- **Workshop**: workshop@tm-paysage.com
- **Conductors**: conductors@tm-paysage.com
- **Accounting**: accounting@tm-paysage.com
- **Design Office**: design@tm-paysage.com

## 📱 Mobile App Development

### Running on Physical Device
```bash
cd frontend
expo start
# Scan QR code with Expo Go app (Android) or Camera app (iOS)
```

### Building for Production
```bash
# Android APK
cd frontend
expo build:android

# iOS Build
expo build:ios
```

## 🗄️ Database Schema

### Models
- **User** - User accounts with roles and permissions
- **Site** - Construction sites with project details
- **Task** - Individual tasks assigned to sites and users
- **Message** - Internal messaging and external email logs
- **Absence** - Employee absence requests and declarations
- **Document** - File uploads and workflow documents

### Sample Data
The seed script creates:
- 8 users (one for each role)
- 2 construction sites
- Multiple tasks, messages, and absences
- Realistic relationships between entities

## 🔧 Configuration

### Environment Variables
Key configuration options in `.env`:

```env
# Server
NODE_ENV=development
PORT=5000

# Database
MONGODB_URI=mongodb://localhost:27017/tm-paysage

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRE=30d

# Email (for external messaging)
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-password
PURCHASE_EMAIL=achat@tm-paysage.fr
WORKSHOP_EMAIL=atelier@tm-paysage.fr

# Frontend
FRONTEND_URL=http://localhost:19006
```

## 📋 Available Scripts

### Root Level
- `npm run install:all` - Install backend and frontend dependencies
- `npm run dev` - Start both backend and frontend
- `npm run build` - Build both applications
- `npm run lint` - Lint both applications
- `npm run test` - Run tests for both applications
- `npm run seed` - Populate database with sample data

### Backend (`/backend`)
- `npm run dev` - Start development server with nodemon
- `npm run build` - Build TypeScript to JavaScript
- `npm run start` - Start production server
- `npm run seed` - Run database seeding script
- `npm run lint` - ESLint code analysis

### Frontend (`/frontend`)
- `npm start` - Start Expo development server
- `npm run android` - Start on Android
- `npm run ios` - Start on iOS
- `npm run web` - Start web version
- `npm run build` - Build for production

## 🏗️ Project Structure

```
tm-paysage-site-manager/
├── backend/                 # Node.js API server
│   ├── src/
│   │   ├── config/         # Database configuration
│   │   ├── controllers/    # Route controllers
│   │   ├── middleware/     # Auth, validation, error handling
│   │   ├── models/         # MongoDB schemas
│   │   ├── routes/         # API routes
│   │   ├── scripts/        # Utility scripts (seeding)
│   │   └── server.ts       # Main server file
│   ├── package.json
│   └── tsconfig.json
├── frontend/               # React Native mobile app
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── screens/        # App screens
│   │   ├── context/        # React context providers
│   │   ├── services/       # API service calls
│   │   ├── theme/          # App theming
│   │   └── types/          # TypeScript definitions
│   ├── App.tsx             # Main app component
│   ├── app.json            # Expo configuration
│   ├── package.json
│   └── tsconfig.json
├── package.json            # Root package.json with scripts
├── env.example             # Environment variables template
└── README.md
```

## 🔒 Security Features

- JWT-based authentication with secure token storage
- Role-based access control (RBAC) for all endpoints
- Password hashing with bcrypt
- Input validation and sanitization
- Rate limiting to prevent abuse
- CORS configuration for cross-origin requests
- Helmet for security headers
- File upload restrictions and validation

## 🚀 Deployment

### Backend Deployment
The backend is cloud-agnostic and can be deployed to:
- **AWS** (EC2, Elastic Beanstalk, Lambda)
- **Azure** (App Service, Container Instances)
- **Google Cloud** (App Engine, Cloud Run)
- **Heroku** (Platform as a Service)

### Database Deployment
- **MongoDB Atlas** (recommended for production)
- **AWS DocumentDB**
- **Azure Cosmos DB**
- Self-hosted MongoDB on VPS

### Mobile App Deployment
- **Google Play Store** (Android)
- **Apple App Store** (iOS)
- **Expo Application Services** for automated builds

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 📞 Support

For support and questions:
- Create an issue in the repository
- Contact the development team
- Check the documentation and troubleshooting guide

---

**TM Paysage Site Manager** - Streamlining construction project management with modern technology. 