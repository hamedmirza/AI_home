# AI Smart Home Setup Instructions

## Quick Start

1. **Copy environment file:**
   ```bash
   cp .env.example .env
   ```

2. **Configure Supabase (Optional):**
   - Create a Supabase project at https://supabase.com
   - Copy your project URL and anon key to `.env` file
   - If you don't configure Supabase, the app will run in offline mode

3. **Install dependencies:**
   ```bash
   npm install
   ```

4. **Start development server:**
   ```bash
   npm run dev
   ```

## Environment Variables

The following environment variables are required:

- `VITE_SUPABASE_URL`: Your Supabase project URL (optional)
- `VITE_SUPABASE_ANON_KEY`: Your Supabase anon key (optional)

## Features

- **Offline Mode**: Works without Supabase configuration
- **Home Assistant Integration**: Connect to your Home Assistant instance
- **AI Assistant**: Multiple AI providers supported
- **Energy Dashboard**: Monitor solar, battery, and grid power
- **Smart Dashboards**: Create custom dashboard views

## Troubleshooting

### Bad Request Error
If you see a "Bad Request" error, it's likely due to missing Supabase configuration. The app will work in offline mode without Supabase.

### Home Assistant Connection
1. Go to Settings > Connection Settings
2. Enter your Home Assistant URL and access token
3. Ensure CORS is configured in Home Assistant

## Version
Current version: 2.0.1