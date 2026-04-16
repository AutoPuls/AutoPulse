# Use the official Microsoft Playwright image as the base
# We upgrade to v1.50.1-jammy to ensure Node.js is >= 22.12 (Prisma 7.7.0 requirement)
FROM mcr.microsoft.com/playwright:v1.50.1-jammy

# 1. Use the pre-existing Playwright user (UID 1000) for Hugging Face compatibility
# The base image already has 'pwuser' with UID 1000.
ENV HOME=/home/pwuser
ENV PATH=$HOME/.local/bin:$PATH

# 2. Set up writable paths for Playwright browsers
# Hugging Face runs containers as non-root, so we use the built-in pwuser's home.
ENV PLAYWRIGHT_BROWSERS_PATH=$HOME/pw-browsers

# 3. Initialize app directory and ensure non-root ownership (as root)
# This prevents EACCES errors when creating subdirectories (like .prisma) in node_modules later.
RUN mkdir -p $HOME/app && chown -R pwuser:pwuser $HOME

# Set the working directory
WORKDIR $HOME/app

# Switch to the non-privileged user before doing anything else
USER pwuser

# 4. Copy package files and install dependencies (as pwuser)
# We use --chown=pwuser:pwuser to ensure the non-root user owns these files
COPY --chown=pwuser:pwuser package*.json package-lock.json* ./
RUN npm ci

# 5. Copy the rest of the application code
COPY --chown=pwuser:pwuser . .

# 6. Generate the Prisma client
# We provide a placeholder DATABASE_URL because the build environment lacks the real secret,
# and Prisma 7.7.0+ config validation requires it to be present.
RUN DATABASE_URL=postgresql://dummy:dummy@localhost:5432/dummy npx prisma generate

# Final check: Ensure Playwright browsers are installed
RUN npx playwright install chromium

# Expose the port used by the health check server (and Hugging Face Spaces default)
EXPOSE 7860

# The command to start the background worker process
# This uses the 'workers' script defined in package.json
CMD ["npm", "run", "workers"]
