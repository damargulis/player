# The streaming stack: everything here is cheap to destroy and recreate, which is the line
# CLAUDE.md draws for what Terraform is allowed to manage.
#
# The music bucket is NOT managed here. It is read through a data source, so Terraform can
# reference it but has no power to modify or destroy it - the config itself enforces the policy
# rather than relying on anyone remembering it.

data "google_storage_bucket" "backups" {
  name = var.bucket_name
}

resource "google_project_service" "required" {
  for_each = toset([
    "artifactregistry.googleapis.com",
    "iamcredentials.googleapis.com", # signBlob, how the service signs without a key
    "run.googleapis.com",
  ])

  service = each.value

  # Tearing down this stack must not disable APIs other things in the project may rely on.
  disable_on_destroy = false
}

# ---------------------------------------------------------------------------------------------
# Identity
# ---------------------------------------------------------------------------------------------

# Deliberately separate from the backup writer, which stays objectCreator-only. A compromise of
# the streaming service must not be able to touch backup integrity.
resource "google_service_account" "streaming" {
  account_id   = "mymusic-streaming"
  display_name = "MyMusic streaming service"
  description  = "Reads the backup bucket and signs short-lived URLs. No key is ever created for it."
}

# _member, never _binding or _policy. The additive form touches only this one grant; the
# authoritative forms would silently strip every other member on the role - including the
# backup writer's objectCreator grant, which is the one thing protecting the backups.
resource "google_storage_bucket_iam_member" "streaming_reader" {
  bucket = data.google_storage_bucket.backups.name
  role   = "roles/storage.objectViewer"
  member = "serviceAccount:${google_service_account.streaming.email}"
}

# Lets the service ask IAM to sign as itself, so V4 URLs need no private key anywhere.
# Without this /catalog still works and every /track/:id fails - a confusing half-broken state.
resource "google_service_account_iam_member" "sign_as_self" {
  service_account_id = google_service_account.streaming.name
  role               = "roles/iam.serviceAccountTokenCreator"
  member             = "serviceAccount:${google_service_account.streaming.email}"
}

# ---------------------------------------------------------------------------------------------
# Image registry
# ---------------------------------------------------------------------------------------------

resource "google_artifact_registry_repository" "images" {
  location      = var.region
  repository_id = "mymusic"
  format        = "DOCKER"
  description   = "Container images for MyMusic services."

  depends_on = [google_project_service.required]
}

# ---------------------------------------------------------------------------------------------
# The service
# ---------------------------------------------------------------------------------------------

resource "google_cloud_run_v2_service" "streaming" {
  name     = "mymusic-streaming"
  location = var.region

  # The service authenticates callers itself, with per-device bearer tokens.
  ingress = "INGRESS_TRAFFIC_ALL"

  template {
    service_account = google_service_account.streaming.email

    scaling {
      # Scale to zero: this is idle almost all the time. The cost is a ~1-2s cold start on the
      # first play, which the phone hides by prefetching the next track's URL.
      min_instance_count = 0
      max_instance_count = var.max_instances
    }

    containers {
      image = var.image

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
        # No CPU billed while idle between requests.
        cpu_idle = true
      }

      env {
        name  = "GCS_BACKUP_BUCKET"
        value = data.google_storage_bucket.backups.name
      }

      env {
        name  = "STREAM_DEVICE_TOKENS"
        value = var.device_tokens
      }

      env {
        name  = "STREAM_URL_TTL_SECONDS"
        value = tostring(var.url_ttl_seconds)
      }

      startup_probe {
        http_get {
          path = "/health"
        }
        initial_delay_seconds = 1
        period_seconds        = 3
        failure_threshold     = 5
      }
    }
  }

  depends_on = [google_project_service.required]
}

# The phone has no GCP identity, so Cloud Run's own IAM cannot be the gate - it would block the
# only caller. Reachability is public on purpose; the bearer-token check in server.js is the
# real boundary, and /health is the only thing an unauthenticated probe can see.
resource "google_cloud_run_v2_service_iam_member" "public_invoker" {
  name     = google_cloud_run_v2_service.streaming.name
  location = google_cloud_run_v2_service.streaming.location
  role     = "roles/run.invoker"
  member   = "allUsers"
}
