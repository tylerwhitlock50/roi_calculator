# Product ROI Tool

A web application for evaluating new product ideas with data-driven ROI analysis. Built with Next.js, Supabase, and TypeScript.

## Features

- **Authentication & Multi-tenancy**: Secure user management with organization-based access control
- **Product Idea Management**: Create and manage product concepts with detailed specifications
- **Sales Forecasting**: Collaborative revenue forecasting across customers and channels
- **Cost Estimation**: Detailed cost modeling with BOM parts, labor by activity rates, overhead and support factors
- **ROI Calculations**: Automatic calculation of NPV, IRR, break-even, and per-unit profitability
- **Team Collaboration**: Multi-user support with role-based permissions

## Tech Stack

- **Frontend**: Next.js 14, React 18, TypeScript
- **Styling**: Tailwind CSS, Headless UI
- **Backend**: Supabase (PostgreSQL, Auth, Row Level Security)
- **Forms**: React Hook Form, Zod validation
- **Charts**: Recharts for data visualization

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Supabase account

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd product-roi-tool
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up Supabase**
   - Create a new Supabase project at [supabase.com](https://supabase.com)
   - Get your project URL and anon key from Settings > API
   - Create a `.env.local` file in the root directory:

   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Set up the database schema**
   - Run the SQL commands from `database/schema.sql` in your Supabase SQL editor
   - Enable Row Level Security (RLS) on all tables
   - Set up the RLS policies as defined in the schema

5. **Start the development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## Database Schema

The application uses the following main tables:

- `organizations` - Multi-tenant organization management
- `users` - User accounts with role-based permissions
- `ideas` - Product idea definitions
- `sales_forecasts` - Revenue projections
- `cost_estimates` - Cost estimate summary
- `bom_parts` - Purchased part line items
- `labor_entries` - Labor by activity
- `activity_rates` - Hourly rates per organization
- `roi_summaries` - Calculated financial metrics

## Project Structure

```
src/
├── app/                 # Next.js app directory
│   ├── globals.css     # Global styles
│   ├── layout.tsx      # Root layout
│   └── page.tsx        # Home page
├── components/         # Reusable UI components
├── lib/               # Utilities and configurations
│   └── supabase.ts    # Supabase client setup
└── types/             # TypeScript type definitions
```

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript type checking

### Environment Variables

Create a `.env.local` file with the following variables:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Admin Invitation Script

Admins can pre-create users and generate invite links with a service role key. A
simple helper script is included in `scripts/invite_user.py`:

```bash
python scripts/invite_user.py user@example.com tempPassword ORGANIZATION_ID
```

The script creates the user, assigns them to the specified organization and out
puts an invite link they can use to finish the sign‑up process.


### Database Utility Script

A helper CLI at `scripts/db_cli.py` can apply or reset the database schema. It reads `SUPABASE_DB_URL` for the connection string.

```bash
# Apply the schema
python scripts/db_cli.py apply

# Reset RLS policies
python scripts/db_cli.py reset
```

## Deployment

The application can be deployed to Vercel, Netlify, or any other Next.js-compatible platform.

1. **Build the application**
   ```bash
   npm run build
   ```

2. **Set environment variables** in your deployment platform

3. **Deploy** using your preferred platform's deployment process

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For support, please open an issue in the GitHub repository or contact the development team. 