# syntax=docker/dockerfile:1.4
FROM node:20-alpine

# Verify Node.js version (for debugging) - do this early so we see it even if build fails
RUN node --version && npm --version

WORKDIR /app

# Copy files (if Root Directory is set to example-projects/express-api-mock, 
# the build context is already that directory, so we copy from .)
# If Root Directory is root, we'd need example-projects/express-api-mock/ but
# Railway with Root Directory set means context is already the subdirectory
COPY . ./

# Copy mockifyer source code from parent directory to avoid GitHub Packages auth
# This works because we're in the same repository
RUN mkdir -p /tmp/mockifyer && \
    if [ -d "../../src" ]; then \
      cp -r ../../src /tmp/mockifyer/ && \
      cp ../../package.json /tmp/mockifyer/ && \
      cp ../../tsconfig.json /tmp/mockifyer/ 2>/dev/null || true; \
    fi

# Verify source files exist
RUN ls -la package*.json || (echo "ERROR: package files not found!" && exit 1)

# Copy production package files
RUN cp package.prod.json package.json

# npm 10.8.2 has a bug parsing lockfiles - delete it and let npm generate fresh one
RUN rm -f package-lock.json package-lock.prod.json

# Replace @sgedda/mockifyer dependency with local file path to avoid GitHub Packages auth
# This works because we're building from the same repository
RUN if [ -d "/tmp/mockifyer/src" ]; then \
      echo "Using local mockifyer from repository" && \
      npm pkg set dependencies.@sgedda/mockifyer=file:/tmp/mockifyer || \
      sed -i 's|"@sgedda/mockifyer": "[^"]*"|"@sgedda/mockifyer": "file:/tmp/mockifyer"|' package.json; \
    else \
      echo "WARNING: Could not find mockifyer source, will try GitHub Packages" && \
      if [ -n "${GITHUB_TOKEN:-}" ]; then \
        echo "//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}" >> .npmrc && \
        echo "✓ Configured GitHub token"; \
      elif [ -n "${NPM_TOKEN:-}" ]; then \
        echo "//npm.pkg.github.com/:_authToken=${NPM_TOKEN}" >> .npmrc && \
        echo "✓ Configured NPM token"; \
      else \
        echo "✗ ERROR: No mockifyer source and no token available"; \
        exit 1; \
      fi; \
    fi

# Install dependencies (will generate new lockfile)
RUN npm install

# Build the application
RUN npm run build

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]

