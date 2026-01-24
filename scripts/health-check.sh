#!/bin/bash
# =============================================================================
# SWALO Health Check Script
# Vérifie la santé de tous les services (API, Web, Database)
# =============================================================================
# Usage: ./scripts/health-check.sh [--prod|--staging|--local]
# Exit codes: 0 = all healthy, 1 = at least one service down
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default to production
ENV="${1:-prod}"

# Configure URLs based on environment
case "$ENV" in
  --prod|prod)
    API_URL="https://swalo-api.onrender.com/api/health"
    WEB_URL="https://swalo-web.vercel.app"
    ENV_NAME="Production"
    ;;
  --staging|staging)
    API_URL="${STAGING_API_URL:-https://swalo-api-staging.onrender.com/api/health}"
    WEB_URL="${STAGING_WEB_URL:-https://swalo-staging.vercel.app}"
    ENV_NAME="Staging"
    ;;
  --local|local)
    API_URL="http://localhost:3000/api/health"
    WEB_URL="http://localhost:5173"
    ENV_NAME="Local"
    ;;
  *)
    echo "Usage: $0 [--prod|--staging|--local]"
    exit 1
    ;;
esac

echo "=============================================="
echo "SWALO Health Check - $ENV_NAME Environment"
echo "=============================================="
echo ""

FAILED=0
TIMEOUT=30  # seconds

# Function to check a service
check_service() {
  local name=$1
  local url=$2
  local expected_status=${3:-200}

  printf "Checking %-15s... " "$name"

  # Use curl with timeout and capture status
  status=$(curl -s -o /dev/null -w "%{http_code}" --max-time $TIMEOUT --connect-timeout 10 "$url" 2>/dev/null || echo "000")

  if [ "$status" = "$expected_status" ]; then
    echo -e "${GREEN}OK${NC} (HTTP $status)"
    return 0
  elif [ "$status" = "000" ]; then
    echo -e "${RED}FAILED${NC} (Connection timeout)"
    return 1
  elif [ "$status" = "502" ] || [ "$status" = "503" ]; then
    echo -e "${YELLOW}WAKING UP${NC} (HTTP $status - Cold start?)"
    return 1
  else
    echo -e "${RED}FAILED${NC} (HTTP $status, expected $expected_status)"
    return 1
  fi
}

# Function to check API with retry (for cold starts)
check_api_with_retry() {
  local name=$1
  local url=$2
  local max_attempts=3
  local attempt=1

  while [ $attempt -le $max_attempts ]; do
    printf "Checking %-15s... " "$name (attempt $attempt/$max_attempts)"

    status=$(curl -s -o /dev/null -w "%{http_code}" --max-time $TIMEOUT --connect-timeout 10 "$url" 2>/dev/null || echo "000")

    if [ "$status" = "200" ]; then
      echo -e "${GREEN}OK${NC} (HTTP $status)"
      return 0
    elif [ "$status" = "502" ] || [ "$status" = "503" ] || [ "$status" = "000" ]; then
      if [ $attempt -lt $max_attempts ]; then
        echo -e "${YELLOW}Waiting${NC} (HTTP $status - retrying in 30s...)"
        sleep 30
        attempt=$((attempt + 1))
      else
        echo -e "${RED}FAILED${NC} after $max_attempts attempts"
        return 1
      fi
    else
      echo -e "${RED}FAILED${NC} (HTTP $status)"
      return 1
    fi
  done

  return 1
}

# Check each service
echo "Services:"
echo "----------------------------------------------"

# API Health Check (with retry for cold starts)
if ! check_api_with_retry "API" "$API_URL"; then
  FAILED=1
fi

# Web Health Check
if ! check_service "Web Dashboard" "$WEB_URL"; then
  FAILED=1
fi

echo ""
echo "----------------------------------------------"

# Check API detailed health (if API is up)
if [ "$FAILED" -eq 0 ]; then
  echo ""
  echo "API Details:"
  echo "----------------------------------------------"

  # Get API health response body
  health_response=$(curl -s --max-time $TIMEOUT "$API_URL" 2>/dev/null || echo '{"error": "Failed to fetch"}')
  echo "$health_response" | python3 -m json.tool 2>/dev/null || echo "$health_response"
fi

echo ""
echo "=============================================="

# Summary
if [ "$FAILED" -eq 0 ]; then
  echo -e "${GREEN}All services are healthy!${NC}"
  exit 0
else
  echo -e "${RED}Some services are down or unhealthy.${NC}"
  echo ""
  echo "Troubleshooting:"
  echo "1. Check Render Dashboard: https://dashboard.render.com"
  echo "2. Check Vercel Dashboard: https://vercel.com/dashboard"
  echo "3. Check Neon Console: https://console.neon.tech"
  echo "4. Review GitHub Actions: Check keep-alive workflow"
  exit 1
fi
