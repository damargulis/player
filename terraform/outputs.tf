output "service_url" {
  description = "Base URL for the streaming service; goes into the phone app."
  value       = google_cloud_run_v2_service.streaming.uri
}

output "service_account" {
  description = "Identity the service runs as. Record it in infrastructure.local.md."
  value       = google_service_account.streaming.email
}

output "image_repository" {
  description = "Where to push the container image."
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.images.repository_id}"
}
