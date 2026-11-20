#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# [WO-120] Drive Therapy Google Cloud Project CLI Bootstrapper (`npm run gcp:setup`)
# Uses ~/.local/bin/gcloud to authenticate, create a clean dedicated Google Cloud
# project, enable only drive.googleapis.com and photospicker.googleapis.com, and
# print direct links to the project's OAuth Consent Screen and Credentials pages.

set -e

GCLOUD="$HOME/.local/bin/gcloud"
if [ ! -x "$GCLOUD" ]; then
  GCLOUD="$(command -v gcloud || true)"
fi

if [ -z "$GCLOUD" ]; then
  echo "[gcp:setup] Error: gcloud CLI not found."
  exit 1
fi

PROJECT_ID="${GCP_PROJECT_ID:-drive-therapy-studio}"
PROJECT_NAME="${GCP_PROJECT_NAME:-Drive Therapy}"

ACTIVE_ACCOUNT=$("$GCLOUD" auth list --filter=status:ACTIVE --format="value(account)" 2>/dev/null || true)
if [ -z "$ACTIVE_ACCOUNT" ]; then
  echo "[gcp:setup] Opening browser for Google Cloud CLI authentication..."
  "$GCLOUD" auth login
  ACTIVE_ACCOUNT=$("$GCLOUD" auth list --filter=status:ACTIVE --format="value(account)" 2>/dev/null || true)
fi

echo "[gcp:setup] Authenticated as: $ACTIVE_ACCOUNT"

if ! "$GCLOUD" projects describe "$PROJECT_ID" >/dev/null 2>&1; then
  echo "[gcp:setup] Creating new Google Cloud Project: $PROJECT_ID ($PROJECT_NAME)..."
  "$GCLOUD" projects create "$PROJECT_ID" --name="$PROJECT_NAME"
else
  echo "[gcp:setup] Project $PROJECT_ID already exists."
fi

"$GCLOUD" config set project "$PROJECT_ID"

echo "[gcp:setup] Enabling Google Drive API and Google Photos Picker API on $PROJECT_ID..."
"$GCLOUD" services enable drive.googleapis.com photospicker.googleapis.com --project="$PROJECT_ID"

echo ""
echo "=========================================================================="
echo " Drive Therapy Google Cloud Project ($PROJECT_ID) Ready!"
echo "=========================================================================="
echo "1. OAuth Consent Screen / Branding:"
echo "   https://console.cloud.google.com/apis/credentials/consent?project=$PROJECT_ID"
echo "2. Create OAuth 2.0 Web Client ID:"
echo "   https://console.cloud.google.com/apis/credentials/oauthclient?project=$PROJECT_ID"
echo "3. After downloading client_secret_*.json, run:"
echo "   npm run oauth:import-secret"
echo "=========================================================================="
