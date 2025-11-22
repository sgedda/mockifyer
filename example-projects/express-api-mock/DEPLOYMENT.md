# Deployment Guide

This guide explains how to deploy the example app to free hosting platforms with CI/CD.

## Option 1: Railway (Recommended - Free Tier)

Railway offers a free tier with automatic deployments from GitHub.

### Setup Steps:

1. **Create Railway Account**
   - Go to https://railway.app
   - Sign up with GitHub

2. **Create New Project**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your `mockifyer` repository
   - Select the root directory

3. **Configure Service**
   - **IMPORTANT**: In the service settings, go to "Settings" → "Source"
   - Set the **Root Directory** to: `example-projects/express-api-mock`
   - **IMPORTANT**: In "Settings" → "Build", set **Builder** to: `Nixpacks` (or leave as auto-detect)
   - Railway will use Railpack (Nixpacks) which reads `nixpacks.toml` configuration
   - The `nixpacks.toml` handles copying production files, regenerating lockfile, and building correctly

4. **Set Environment Variables**
   - Go to the service settings → Variables
   - Add these variables:
     ```
     WEATHER_API_KEY=your_weather_api_key_here
     PORT=3000
     NODE_ENV=production
     MOCKIFYER_ENABLED=true
     MOCKIFYER_RECORD=true  # Set to true initially to record mocks
     MOCKIFYER_PATH=./mock-data
     GITHUB_TOKEN=your_github_token_with_read_packages_scope
     ```
   - **Important**: Add `GITHUB_TOKEN` with a GitHub Personal Access Token that has `read:packages` scope
     - This is needed to install `@sgedda/mockifyer` from GitHub Packages
     - Create token at: https://github.com/settings/tokens/new
     - Select scope: `read:packages`
     - The build process will automatically configure npm to use this token
   
   **Recording Mocks:**
   - Initially set `MOCKIFYER_RECORD=true` to record mock data on the server
   - Make some API calls through your deployed app to record the responses
   - After mocks are recorded, set `MOCKIFYER_RECORD=false` to use the recorded mocks
   - The mock data files will be created in the `mock-data` directory on the server

5. **Deploy**
   - Railway will automatically deploy on every push to `main`
   - Or trigger manually from the Railway dashboard

### Railway Auto-Deploy

Railway automatically deploys when you push to the main branch. No GitHub Actions needed!

## Option 2: Render (Free Tier)

1. **Create Account**
   - Go to https://render.com
   - Sign up with GitHub

2. **Create New Web Service**
   - Click "New" → "Web Service"
   - Connect your GitHub repository
   - Select the repository

3. **Configure**
   - **Name**: `mockifyer-example`
   - **Root Directory**: `example-projects/express-api-mock`
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`

4. **Set Environment Variables**
   - Add the same variables as Railway

5. **Deploy**
   - Render will auto-deploy on every push

## Option 3: Using GitHub Actions (Manual)

If you prefer using GitHub Actions for deployment, you can use the workflow file at `.github/workflows/deploy-example.yml`.

### Setup:

1. **Get Railway Token** (if using Railway)
   ```bash
   npm install -g @railway/cli
   railway login
   railway link
   railway tokens
   ```

2. **Add GitHub Secrets**
   - Go to your repo → Settings → Secrets and variables → Actions
   - Add `RAILWAY_TOKEN` with your Railway token
   - Add `RAILWAY_SERVICE_ID` with your service ID

3. **Deploy**
   - Push to `main` branch
   - The workflow will automatically deploy

## Environment Variables

Required environment variables:

- `WEATHER_API_KEY` - Your WeatherAPI key (get one at https://www.weatherapi.com/)
- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Set to `production` for production
- `MOCKIFYER_ENABLED` - Set to `true` to enable mockifyer
- `MOCKIFYER_RECORD` - Set to `false` to use mocks (not record)
- `MOCKIFYER_PATH` - Path to mock data (default: `./mock-data`)

## Accessing Your Deployed App

Once deployed, you'll get a URL like:
- Railway: `https://your-app-name.up.railway.app`
- Render: `https://your-app-name.onrender.com`

Visit the URL to see the web dashboard!

## Troubleshooting

### Build Fails
- Make sure the root directory is set to `example-projects/express-api-mock`
- Check that all dependencies are in `package.json`

### App Crashes
- Check environment variables are set correctly
- Check logs in the hosting platform dashboard
- Make sure `WEATHER_API_KEY` is set

### Mock Data Not Working
- Ensure `MOCKIFYER_ENABLED=true`
- Check that mock data files are included in the deployment
- Verify `MOCKIFYER_PATH` is correct

