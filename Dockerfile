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

# Set the working directory
WORKDIR $HOME/app

# 3. Copy package files and install dependencies
# We use --chown=pwuser:pwuser to ensure the non-root user owns these files
COPY --chown=pwuser:pwuser package*.json package-lock.json* ./
RUN npm ci

# 4. Copy the rest of the application code
COPY --chown=pwuser:pwuser . .

# 5. Switch to the built-in pwuser before generating Prisma client or installing browsers
USER pwuser

# Generate the Prisma client
RUN npx prisma generate

# Final check: Ensure Playwright browsers are installed
RUN npx playwright install chromium

# Expose the port used by the health check server (and Hugging Face Spaces default)
EXPOSE 7860

# The command to start the background worker process
# This uses the 'workers' script defined in package.json
CMD ["npm", "run", "workers"]
