# Product ROI Tool - Setup Guide

## 🚀 Quick Start

The Product ROI Tool is now running at `http://localhost:3000`! Here's what you need to do to get started:

### 1. Set Up Supabase (Required)

1. **Create a Supabase Project**
   - Go to [supabase.com](https://supabase.com) and create a new project
   - Note down your project URL and anon key

2. **Configure Environment Variables**
   - Create a `.env.local` file in the project root
   - Add your Supabase credentials:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url_here
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
   ```

3. **Set Up Database Schema**
   - Go to your Supabase project dashboard
   - Navigate to the SQL Editor
   - Copy and paste the entire contents of `database/schema.sql`
   - Run the SQL commands to create all tables, functions, and RLS policies

4. **Test Invite Code Functionality (Optional)**
   - Run the test script `database/test-invite-codes.sql` in the SQL Editor
   - This will verify that the invite code system is working correctly

### 2. Test the Application

1. **Visit the Application**
   - Open `http://localhost:3000` in your browser
   - You should see the login/signup page

2. **Create an Account**
   - Click "Sign up" and create a new account
   - Verify your email (check your inbox)

3. **Set Up Organization**
   - After signing in, you'll be prompted to create or join an organization
   - **Create a new organization**: Enter your organization name
   - **Join an existing organization**: Use an invite code from your admin
   - After creating an organization, you'll see the invite code to share with team members

4. **Create Your First Product Idea**
   - Use the "Create New Project" button
   - Fill out the 3-step form with your product idea details

## 📁 Project Structure

```
product-roi-tool/
├── src/
│   ├── app/                    # Next.js app directory
│   │   ├── globals.css        # Global styles with Tailwind
│   │   ├── layout.tsx         # Root layout component
│   │   └── page.tsx           # Main application page
│   ├── components/            # Reusable UI components
│   │   ├── ProductIdeaForm.tsx    # Product creation form
│   │   ├── ProjectDashboard.tsx   # Project listing dashboard
│   │   └── OrganizationSetup.tsx  # Organization setup flow
│   └── lib/                   # Utilities and configurations
│       ├── supabase.ts        # Supabase client and types
│       └── roi-calculations.ts # ROI calculation utilities
├── database/
│   ├── schema.sql            # Complete database schema
│   ├── reset-schema.sql      # Reset script for RLS issues
│   └── test-invite-codes.sql # Test script for invite codes
├── documentation/
│   └── product_roi_tool_prd.md # Product requirements document
├── package.json              # Dependencies and scripts
├── tailwind.config.js        # Tailwind CSS configuration
├── tsconfig.json            # TypeScript configuration
└── README.md                # Project overview
```

## 🛠️ Features Implemented

### ✅ Core Features (MVP)
- **Authentication**: User signup/login with Supabase Auth
- **Multi-tenancy**: Organization-based access control with RLS
- **Product Idea Management**: Create and manage product concepts
- **Organization Setup**: Create or join organizations with invite codes
- **Invite Code System**: Generate, display, and share organization invite codes
- **Project Dashboard**: View and filter product ideas
- **Responsive UI**: Modern, mobile-friendly interface

### 🔄 In Progress
- Sales forecasting input forms
- Cost estimation tools
- ROI calculation and display
- Project detail views
- Team collaboration features

### 📋 Database Schema
The application uses 6 main tables:
- `organizations` - Multi-tenant organization management with invite codes
- `users` - User accounts with role-based permissions
- `ideas` - Product idea definitions
- `sales_forecasts` - Revenue projections
- `cost_estimates` - Cost modeling data
- `roi_summaries` - Calculated financial metrics

## 🎨 UI Components

### Design System
- **Colors**: Primary blue, success green, warning yellow, danger red
- **Typography**: Inter font family
- **Components**: Cards, buttons, forms, navigation
- **Responsive**: Mobile-first design with Tailwind CSS

### Key Components
1. **ProductIdeaForm**: Multi-step form for creating product ideas
2. **ProjectDashboard**: Grid view of projects with filtering and invite code display
3. **OrganizationSetup**: Create or join organization flow with invite code sharing
4. **Authentication**: Sign up/in forms with validation

## 🔧 Development

### Available Scripts
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run type-check   # Run TypeScript type checking
```

### Tech Stack
- **Frontend**: Next.js 14, React 18, TypeScript
- **Styling**: Tailwind CSS, Headless UI
- **Backend**: Supabase (PostgreSQL, Auth, RLS)
- **Forms**: React Hook Form, Zod validation
- **Charts**: Recharts (ready for implementation)

## 🚧 Next Steps

### Immediate Tasks
1. **Set up Supabase** with the provided schema
2. **Test the authentication flow**
3. **Create your first organization and product idea**
4. **Test the invite code functionality**

### Upcoming Features
1. **Sales Forecasting Module**
   - Monthly volume input forms
   - Channel/customer management
   - Ramp-up period configuration

2. **Cost Estimation Module**
   - BOM (Bill of Materials) input
   - Tooling cost estimation
   - Engineering time tracking
   - Marketing budget planning

3. **ROI Analysis Dashboard**
   - NPV, IRR, and break-even calculations
   - Interactive charts and graphs
   - Assumption management
   - Export capabilities

4. **Team Collaboration**
   - User role management
   - Comment and feedback system
   - Approval workflows
   - Activity tracking

## 🐛 Troubleshooting

### Common Issues

1. **Module not found errors**
   - Run `npm install` to install dependencies
   - Restart the development server

2. **Supabase connection errors**
   - Verify your environment variables are correct
   - Check that your Supabase project is active
   - Ensure the database schema has been applied

3. **Authentication issues**
   - Check that email confirmation is enabled in Supabase
   - Verify RLS policies are correctly set up
   - Check browser console for error messages

4. **Organization setup problems**
   - Ensure the database functions are created
   - Check that the user trigger is working
   - Verify RLS policies allow organization operations

5. **Invite code issues**
   - Run the test script `database/test-invite-codes.sql` to verify functions
   - Check that RLS policies allow organization creation and joining
   - Ensure the `generate_invite_code()` function exists
   - Verify that admins can view their organization's invite code

### Invite Code Troubleshooting

If invite codes aren't working:

1. **Check Database Functions**
   ```sql
   -- Run this in Supabase SQL Editor
   SELECT routine_name FROM information_schema.routines 
   WHERE routine_schema = 'public' 
   AND routine_name IN ('create_organization', 'join_organization', 'generate_invite_code');
   ```

2. **Verify RLS Policies**
   ```sql
   -- Check organization policies
   SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'organizations';
   ```

3. **Test Organization Creation**
   ```sql
   -- Test creating an organization
   SELECT create_organization('Test Org') as org_id;
   ```

4. **Check User Permissions**
   - Ensure the user is authenticated
   - Verify the user doesn't already have an organization_id
   - Check that the user has the correct role

### Getting Help
- Check the browser console for error messages
- Review the Supabase logs in your project dashboard
- Ensure all database functions and triggers are created
- Verify RLS policies are correctly configured
- Run the test scripts to verify functionality

## 📈 Success Metrics

The application is designed to track:
- Number of organizations created
- Product ideas logged per organization
- User engagement with forecasting tools
- ROI calculations completed
- Team collaboration metrics
- Invite code usage and organization growth

## 🔐 Security Features

- **Row Level Security (RLS)**: Users can only access data from their organization
- **Role-based Access**: Admins can manage users and view invite codes
- **Invite Code System**: Secure organization joining with unique codes
- **Multi-tenant Architecture**: Complete data isolation between organizations

---

**Ready to start evaluating product ideas?** 🚀

Visit `http://localhost:3000` and begin creating your first product ROI analysis! 