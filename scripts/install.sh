#!/bin/bash
set -e

# ═══════════════════════════════════════════════════════════════
# RingSnap (Ruflo) - One-Line Installer
# Usage: curl -fsSL https://cdn.jsdelivr.net/gh/ruvnet/ruflo@main/scripts/install.sh | bash
# ═══════════════════════════════════════════════════════════════

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

REPO_URL="https://github.com/streamercat/ringsnap.git"
INSTALL_DIR="${RINGSNAP_DIR:-$HOME/ringsnap}"
MIN_NODE_MAJOR=18

# ─────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────
info()    { echo -e "${BLUE}  →${NC} $*"; }
success() { echo -e "${GREEN}  ✓${NC} $*"; }
warn()    { echo -e "${YELLOW}  ⚠${NC} $*"; }
error()   { echo -e "${RED}  ✗${NC} $*" >&2; }
die()     { error "$*"; exit 1; }

confirm() {
  local prompt="$1"
  local default="${2:-n}"
  local yn
  if [[ "$default" == "y" ]]; then
    read -rp "$(echo -e "${YELLOW}?${NC} ${prompt} [Y/n]: ")" yn
    yn="${yn:-y}"
  else
    read -rp "$(echo -e "${YELLOW}?${NC} ${prompt} [y/N]: ")" yn
    yn="${yn:-n}"
  fi
  [[ "$yn" =~ ^[Yy]$ ]]
}

# ─────────────────────────────────────────────────────────────
# Banner
# ─────────────────────────────────────────────────────────────
echo ""
echo -e "${BLUE}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                                                          ║${NC}"
echo -e "${BLUE}║   ${BOLD}${CYAN}RingSnap${NC}${BLUE} — AI-Powered Call Answering Platform         ║${NC}"
echo -e "${BLUE}║                                                          ║${NC}"
echo -e "${BLUE}║   Powered by Ruflo  •  https://github.com/ruvnet/ruflo  ║${NC}"
echo -e "${BLUE}║                                                          ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""

# ─────────────────────────────────────────────────────────────
# Prerequisites
# ─────────────────────────────────────────────────────────────
echo -e "${BOLD}Checking prerequisites...${NC}"
echo ""

# git
if ! command -v git &>/dev/null; then
  die "git is required but not installed. Install it from https://git-scm.com"
fi
success "git $(git --version | awk '{print $3}')"

# node
if ! command -v node &>/dev/null; then
  die "Node.js is required but not installed. Install v${MIN_NODE_MAJOR}+ from https://nodejs.org"
fi
NODE_MAJOR=$(node -e "process.stdout.write(process.version.slice(1).split('.')[0])")
if (( NODE_MAJOR < MIN_NODE_MAJOR )); then
  die "Node.js v${MIN_NODE_MAJOR}+ required (found v${NODE_MAJOR}). Upgrade from https://nodejs.org"
fi
success "Node.js $(node --version)"

# npm
if ! command -v npm &>/dev/null; then
  die "npm is required but not installed."
fi
success "npm $(npm --version)"

# supabase CLI (optional but recommended)
if command -v supabase &>/dev/null; then
  success "Supabase CLI $(supabase --version 2>/dev/null | head -1)"
  HAS_SUPABASE=true
else
  warn "Supabase CLI not found — database/functions setup will be skipped"
  warn "Install later: brew install supabase/tap/supabase  OR  npm i -g supabase"
  HAS_SUPABASE=false
fi

echo ""

# ─────────────────────────────────────────────────────────────
# Clone / update repo
# ─────────────────────────────────────────────────────────────
echo -e "${BOLD}Setting up repository...${NC}"
echo ""

if [[ -d "$INSTALL_DIR/.git" ]]; then
  warn "Directory $INSTALL_DIR already exists."
  if confirm "Pull latest changes?" "y"; then
    info "Pulling latest changes..."
    git -C "$INSTALL_DIR" pull --ff-only
    success "Repository updated"
  else
    info "Skipping pull — using existing code"
  fi
else
  if [[ -d "$INSTALL_DIR" ]] && [[ -n "$(ls -A "$INSTALL_DIR" 2>/dev/null)" ]]; then
    die "Directory $INSTALL_DIR exists and is not empty. Remove it or set RINGSNAP_DIR to a different path."
  fi
  info "Cloning RingSnap into $INSTALL_DIR ..."
  git clone "$REPO_URL" "$INSTALL_DIR"
  success "Repository cloned"
fi

cd "$INSTALL_DIR"
echo ""

# ─────────────────────────────────────────────────────────────
# Install npm dependencies
# ─────────────────────────────────────────────────────────────
echo -e "${BOLD}Installing dependencies...${NC}"
echo ""
info "Running npm install..."
npm install --silent
success "Dependencies installed"
echo ""

# ─────────────────────────────────────────────────────────────
# Environment setup
# ─────────────────────────────────────────────────────────────
echo -e "${BOLD}Configuring environment...${NC}"
echo ""

if [[ -f ".env" ]]; then
  warn ".env already exists — skipping creation"
else
  cp .env.example .env
  success "Created .env from .env.example"
  echo ""
  echo -e "  ${YELLOW}Open ${BOLD}.env${NC}${YELLOW} and fill in your API keys before proceeding:${NC}"
  echo ""
  echo "    Required keys:"
  echo "      VITE_SUPABASE_URL          — Supabase project URL"
  echo "      VITE_SUPABASE_PUBLISHABLE_KEY  — Supabase anon key"
  echo "      VITE_STRIPE_PUBLISHABLE_KEY    — Stripe publishable key"
  echo "      VITE_VAPI_PUBLIC_KEY        — Vapi public key"
  echo "      VITE_VAPI_WIDGET_ASSISTANT_ID  — Vapi assistant ID"
  echo ""
  echo "    Backend (edge functions):"
  echo "      SUPABASE_SERVICE_ROLE_KEY  — Supabase service role key"
  echo "      STRIPE_SECRET_KEY          — Stripe secret key"
  echo "      VAPI_API_KEY               — Vapi API key"
  echo "      RESEND_PROD_KEY            — Resend email API key"
  echo "      TWILIO_ACCOUNT_SID         — Twilio account SID"
  echo "      TWILIO_AUTH_TOKEN          — Twilio auth token"
  echo ""
fi

# ─────────────────────────────────────────────────────────────
# Supabase setup (optional)
# ─────────────────────────────────────────────────────────────
if [[ "$HAS_SUPABASE" == "true" ]]; then
  echo ""
  echo -e "${BOLD}Supabase setup${NC}"
  echo ""

  if confirm "Run Supabase project setup now? (requires a Supabase project)"; then
    ./scripts/setup-new-supabase.sh

    echo ""
    if confirm "Apply database migrations now?"; then
      ./scripts/migrate-schema.sh
    else
      info "Skipping migrations. Run later: ${YELLOW}./scripts/migrate-schema.sh${NC}"
    fi

    echo ""
    if confirm "Configure edge function secrets now?"; then
      ./scripts/configure-secrets.sh
    else
      info "Skipping secrets. Run later: ${YELLOW}./scripts/configure-secrets.sh${NC}"
    fi

    echo ""
    if confirm "Deploy edge functions now?"; then
      ./scripts/deploy-functions.sh
    else
      info "Skipping deploy. Run later: ${YELLOW}./scripts/deploy-functions.sh${NC}"
    fi
  else
    info "Skipping Supabase setup. Run individual scripts when ready."
  fi
fi

# ─────────────────────────────────────────────────────────────
# Done
# ─────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                                                          ║${NC}"
echo -e "${GREEN}║   ${BOLD}Installation complete!${NC}${GREEN}                              ║${NC}"
echo -e "${GREEN}║                                                          ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BOLD}Next steps:${NC}"
echo ""
echo -e "  1. ${CYAN}Edit .env${NC} with your API keys (if not done already)"
echo -e "     ${YELLOW}cd $INSTALL_DIR && \$EDITOR .env${NC}"
echo ""
echo -e "  2. ${CYAN}Start dev server${NC}"
echo -e "     ${YELLOW}cd $INSTALL_DIR && npm run dev${NC}"
echo ""
echo -e "  3. ${CYAN}Set up Supabase${NC} (first time)"
echo -e "     ${YELLOW}./scripts/setup-new-supabase.sh${NC}"
echo -e "     ${YELLOW}./scripts/migrate-schema.sh${NC}"
echo -e "     ${YELLOW}./scripts/configure-secrets.sh${NC}"
echo -e "     ${YELLOW}./scripts/deploy-functions.sh${NC}"
echo ""
echo -e "  Docs: ${BLUE}https://github.com/streamercat/ringsnap${NC}"
echo ""
