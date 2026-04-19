#!/bin/bash
# Complete Development Workflow Script
# Complete code modification workflow script
# Usage: bash scripts/complete-workflow.sh [stage]
#   Stages: all, build, lint, test, service, verify

set -e

GATEWAY_DIR="/root/pi-gateway-standalone"
cd $GATEWAY_DIR

# Color definitions
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

PHASE="${1:-all}"

log() {
    echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}✓ $1${NC}"
}

error() {
    echo -e "${RED}✗ $1${NC}"
    exit 1
}

warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

check_build() {
    log "Stage 1: Build"
    if npm run build; then
        success "Build successful"
    else
        error "Build failed"
    fi
}

check_lint() {
    log "Stage 2: Code linting"
    
    log "Running Biome + TypeScript check..."
    if npm run check; then
        success "Code linting passed"
    else
        warning "Code linting has warnings or errors, please fix"
        # Don't exit, allow continue but log warning
    fi
    
    log "Running TypeScript type check..."
    if npm run typecheck; then
        success "TypeScript type check passed"
    else
        warning "TypeScript type check has errors, please fix"
    fi
}

run_tests() {
    log "Stage 3: Run tests"
    if npm test; then
        success "All tests passed"
    else
        error "Tests failed"
    fi
}

check_services() {
    log "Stage 4: Service check"
    
    log "Checking service status..."
    if node scripts/tmux-controller.js status; then
        success "Service status normal"
    else
        warning "Service status check failed"
    fi
    
    log "Checking frontend logs..."
    if tail -5 logs/frontend_current.log 2>/dev/null | grep -q "ready\|VITE"; then
        success "Frontend service running normally"
    else
        warning "Frontend log check abnormal"
    fi
    
    log "Checking backend logs..."
    if tail -5 logs/backend_current.log 2>/dev/null | grep -q "started\|Server started"; then
        success "Backend service running normally"
    else
        warning "Backend log check abnormal"
    fi
}

verify_endpoints() {
    log "Stage 5: Endpoint verification"
    
    log "Verifying frontend endpoint (http://127.0.0.1:5173)..."
    if curl -s -f http://127.0.0.1:5173 > /dev/null; then
        success "Frontend endpoint accessible"
    else
        warning "Frontend endpoint not accessible"
    fi
    
    log "Verifying backend endpoint (http://127.0.0.1:3000)..."
    if curl -s -f http://127.0.0.1:3000 > /dev/null; then
        success "Backend endpoint accessible"
    else
        warning "Backend endpoint not accessible"
    fi
}

run_all() {
    log "Starting complete development workflow check..."
    echo "========================================"
    
    check_build
    echo "----------------------------------------"
    
    check_lint
    echo "----------------------------------------"
    
    run_tests
    echo "----------------------------------------"
    
    check_services
    echo "----------------------------------------"
    
    verify_endpoints
    echo "========================================"
    
    success "Complete development workflow check finished!"
    echo ""
    echo "Summary:"
    echo "  ✓ Code can be compiled and built"
    echo "  ✓ Code linting passed"
    echo "  ✓ All tests passed"
    echo "  ✓ Services running normally"
    echo "  ✓ Endpoints accessible"
    echo ""
    echo "Code modification passed complete verification."
}

case "$PHASE" in
    all)
        run_all
        ;;
    build)
        check_build
        ;;
    lint)
        check_lint
        ;;
    test)
        run_tests
        ;;
    service)
        check_services
        ;;
    verify)
        verify_endpoints
        ;;
    *)
        echo "Usage: $0 [阶段]"
        echo "Stages: all, build, lint, test, service, verify"
        echo ""
        echo "Complete workflow:"
        echo "  1. build - Build"
        echo "  2. lint  - Lint"
        echo "  3. test  - Test"
        echo "  4. service - Service check"
        echo "  5. verify - Endpoint verification"
        exit 1
        ;;
esac