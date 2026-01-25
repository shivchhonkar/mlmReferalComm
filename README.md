# ReferGrow

A referral-based membership platform with binary tree structure and business volume (BV) income distribution.

## Project Structure

This is a monorepo containing two main applications:

- **Backend** (`/backend`): Express.js REST API server
- **Frontend** (`/frontend`): Next.js web application

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- MongoDB database (local or cloud)

### Installation

1. Clone the repository
2. Install dependencies for both projects:
   ```bash
   # Backend
   cd backend
   npm install
   
   # Frontend
   cd ../frontend
   npm install
   ```

3. Configure environment variables:
   - Backend: Copy `.env` and update with your credentials
   - Frontend: Create `.env.local` with `NEXT_PUBLIC_API_BASE_URL=http://localhost:4000`

### Running the Application

Start both servers (in separate terminals):

```bash
# Terminal 1: Backend API (port 4000)
cd backend
npm run dev

# Terminal 2: Frontend UI (port 3000)
cd frontend
npm run dev
```

Visit http://localhost:3000 to access the application.

## Initial Setup

### Create First Admin Account

1. Start the backend server
2. Create the first admin account (only works if no admin exists):
   ```bash
   curl -X POST http://localhost:4000/api/admin/setup \
     -H "Content-Type: application/json" \
     -d '{
       "secret": "your-ADMIN_SETUP_SECRET",
       "email": "admin@example.com",
       "password": "StrongPass123!"
     }'
   ```

3. Log in at http://localhost:3000/login with admin credentials
4. Create services and distribution rules via the admin panel

### Core Workflow

1. **Admin creates distribution rules**
   - `POST /api/admin/rules`
   - `basePayoutPerBV`: Level-1 payout = `purchaseBV * basePayoutPerBV`
   - Each next level gets half the previous level

2. **Admin creates services**
   - Each service has a fixed BV (Business Volume)
   - Services can be activated/deactivated

3. **Users register with referral code**
   - First user in fresh database can register without referral code
   - All subsequent users require a valid referral code
   - Automatic binary tree placement (left/right)

4. **Users purchase services**
   - Generates Business Volume (BV)
   - Creates income entries for upline referrers
   - Distributes income based on active rules

## Features

### User Features
- User registration with referral codes
- Binary tree referral structure (left/right placement)
- Purchase services to generate Business Volume (BV)
- View referral tree and income history
- Account management

### Admin Features
- Dashboard with statistics
- Service management (create, update, activate/deactivate)
- Distribution rule management
- View all users and transactions
- User management

### Technical Features
- JWT-based authentication (httpOnly cookies)
- Automatic binary tree placement
- Multi-level income distribution
- Transaction-safe BV calculations (with fallback for non-transactional MongoDB)
- Email notifications
- Rate limiting and security middleware
- Role-based access control (admin, user)

## Tech Stack

### Backend
- Express.js - REST API framework
- MongoDB/Mongoose - Database
- TypeScript - Type safety
- JWT (jose) - Authentication
- Nodemailer - Email service

### Frontend
- Next.js 15+ - React framework (App Router)
- React 19 - UI library
- TypeScript - Type safety
- Tailwind CSS - Styling

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/me` - Get current user info

### Services
- `GET /api/services` - List active services
- `GET /api/purchases` - User purchases
- `POST /api/purchases` - Create purchase

### Referrals
- `GET /api/referrals` - Get referral tree
- `GET /api/referrals/tree` - Get detailed tree

### Income
- `GET /api/income` - Get user income history

### Admin
- `POST /api/admin/setup` - Initial admin setup
- `GET /api/admin/dashboard` - Admin statistics
- `GET /api/admin/services` - Manage services
- `POST /api/admin/services` - Create service
- `PUT /api/admin/services/:id` - Update service
- `GET /api/admin/rules` - Distribution rules
- `POST /api/admin/rules` - Create rule
- `PUT /api/admin/rules/:id` - Update rule

## Project Structure

```
refergrow/
├── backend/
│   ├── src/
│   │   ├── models/          # Mongoose models
│   │   │   ├── User.ts
│   │   │   ├── Service.ts
│   │   │   ├── Purchase.ts
│   │   │   ├── Income.ts
│   │   │   ├── IncomeLog.ts
│   │   │   ├── Rule.ts
│   │   │   └── DistributionRule.ts
│   │   ├── lib/             # Utility functions
│   │   │   ├── db.ts
│   │   │   ├── jwt.ts
│   │   │   ├── password.ts
│   │   │   ├── email.ts
│   │   │   ├── env.ts
│   │   │   ├── referral.ts
│   │   │   ├── binaryPlacement.ts
│   │   │   ├── bvDistribution.ts
│   │   │   ├── payout.ts
│   │   │   └── referralTree.ts
│   │   ├── routes.ts        # API route handlers
│   │   └── index.ts         # Express server entry
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── app/             # Next.js App Router pages
│   │   │   ├── about/
│   │   │   ├── account/
│   │   │   ├── admin/
│   │   │   ├── dashboard/
│   │   │   ├── login/
│   │   │   ├── register/
│   │   │   └── services/
│   │   └── lib/
│   │       └── apiClient.ts
│   ├── package.json
│   └── tsconfig.json
├── .gitignore
├── README.md
├── start-dev.ps1
└── start-dev.sh
```

## Notes

- The referral tree supports unlimited depth in the data model
- The UI/API tree view is intentionally depth-limited for response safety
- If your MongoDB doesn't support transactions (common in local dev), the purchase + income write falls back to non-transactional writes
- Authentication uses httpOnly cookies for enhanced security

## License

Private - All rights reserved
