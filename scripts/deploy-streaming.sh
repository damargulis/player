#!/usr/bin/env bash
# Builds and pushes the streaming image, then applies the Terraform.
#
# Terraform cannot build images, so this is the one step that has to be a script. It tags by
# git SHA rather than :latest so a rollback is picking an older tag rather than rebuilding, and
# so Cloud Run actually sees a new revision - re-pushing :latest leaves the digest unchanged
# and the deploy silently does nothing.
set -euo pipefail

cd "$(dirname "$0")/.."

if ! command -v gcloud >/dev/null 2>&1; then
  echo "gcloud is not installed. It is needed to push images and for Terraform's credentials."
  echo "  brew install --cask google-cloud-sdk && gcloud auth login && gcloud auth application-default login"
  exit 1
fi

if [ ! -f terraform/terraform.tfvars ]; then
  echo "terraform/terraform.tfvars is missing; copy terraform.tfvars.example and fill it in."
  exit 1
fi

TAG="$(git rev-parse --short HEAD)"
[ -z "$(git status --porcelain streaming/)" ] || TAG="${TAG}-dirty"

REPO="$(cd terraform && terraform output -raw image_repository 2>/dev/null || true)"
if [ -z "$REPO" ]; then
  echo "No image_repository output yet - run the first apply with a placeholder image:"
  echo "  cd terraform && terraform apply -var='image=us-docker.pkg.dev/cloudrun/container/hello'"
  exit 1
fi

IMAGE="${REPO}/streaming:${TAG}"
echo "building ${IMAGE}"
gcloud auth configure-docker "${REPO%%/*}" --quiet
docker build --platform linux/amd64 -t "$IMAGE" streaming/
docker push "$IMAGE"

echo "applying terraform"
cd terraform
terraform apply -var="image=${IMAGE}"
