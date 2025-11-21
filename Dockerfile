FROM node:20.19.5-alpine

# Verify Node.js version (for debugging) - do this early so we see it even if build fails
RUN node --version && npm --version

WORKDIR /app

# Copy files (if Root Directory is set to example-projects/express-api-mock, 
# the build context is already that directory, so we copy from .)
# If Root Directory is root, we'd need example-projects/express-api-mock/ but
# Railway with Root Directory set means context is already the subdirectory
COPY . ./

# Verify source files exist
RUN ls -la package*.json || (echo "ERROR: package files not found!" && exit 1)

# Copy production package files
RUN cp package.prod.json package.json

# npm 10.8.2 has a bug parsing lockfiles - delete it and let npm generate fresh one
RUN rm -f package-lock.json package-lock.prod.json

# Install dependencies (will generate new lockfile)
# npm 10.8.2 has a bug - use --legacy-peer-deps to work around it
RUN npm install --legacy-peer-deps || npm install --force

# Build the application
RUN npm run build

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]

