# Terraform — streaming stack

Manages the streaming service and nothing else. Per the IaC policy in `CLAUDE.md`, Terraform is
for resources that are **cheap to destroy and recreate**.

## The bucket is not managed here

It holds the only offsite copy of ~163GB of music. It is referenced through a
`data "google_storage_bucket"` source, so Terraform can read its name but has no power to
modify or destroy it — the config enforces the policy rather than relying on anyone remembering
it.

The one place Terraform does touch the bucket is a `google_storage_bucket_iam_member` granting
the service read access. That resource type is **additive** and deliberate: the `_binding` and
`_policy` forms are authoritative and would silently strip every other member on the role,
including the backup writer's `objectCreator` grant. Never change `_member` to either of those.

## Prerequisites

Neither is installed on this machine yet:

- **gcloud** — for Application Default Credentials and pushing images.
  `brew install --cask google-cloud-sdk`, then `gcloud auth login` and
  `gcloud auth application-default login`.
- **terraform** — Homebrew here is an Intel prefix on Apple Silicon ("Tier 3"), and the
  `terraform` formula is not available to it. Use the official installer, OpenTofu
  (`brew install opentofu`, drop-in: substitute `tofu` for `terraform`), or run it through
  Docker without installing anything:

  ```
  docker run --rm -v "$PWD/terraform:/tf" -w /tf hashicorp/terraform:1.9 validate
  ```

## First run

1. Create the state bucket **by hand**, versioning on, separate from the music bucket:
   `<project>-tfstate` in `us-central1`.
2. `cp backend.hcl.example backend.hcl` and `cp terraform.tfvars.example terraform.tfvars`,
   filling both in from `infrastructure.local.md`. Both are gitignored; this repo is public.
3. Mint a device token: `node ../streaming/mint-token.js daniel-phone`, and put the
   `hash:label` in `device_tokens`.
4. `terraform init -backend-config=backend.hcl`
5. The first apply needs an image that exists, before the registry has one:

   ```
   terraform apply -var='image=us-docker.pkg.dev/cloudrun/container/hello'
   ```

6. Then build and push the real one: `../scripts/deploy-streaming.sh`.

Record the `service_url` and `service_account` outputs in `infrastructure.local.md`.

## Why the service is publicly reachable

`allUsers` holds `roles/run.invoker`. The phone has no GCP identity, so Cloud Run IAM cannot be
the gate — it would block the only caller. The bearer-token check in `server.js` is the real
boundary, and `/health` is all an unauthenticated probe can see.

## Status

**Not yet applied, and `terraform validate` has not been run** — Terraform is not installed here
and the Docker daemon was not running. The HCL has only had a structural check (balanced blocks,
plausible schema). Validate before the first apply.
