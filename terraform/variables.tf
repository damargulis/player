# No defaults for anything identifying: this repo is public. Real values go in
# terraform.tfvars, which is gitignored. See terraform.tfvars.example.

variable "project_id" {
  description = "GCP project hosting the bucket and the streaming service."
  type        = string
}

variable "region" {
  description = "Region for Cloud Run and Artifact Registry. Match the bucket's region to keep latency and egress down."
  type        = string
  default     = "us-central1"
}

variable "bucket_name" {
  description = "Existing backup bucket. Referenced read-only; Terraform never manages it."
  type        = string
}

variable "device_tokens" {
  description = <<-EOT
    Allowlist for the streaming service: "<sha256hex>:<label>,<sha256hex>:<label>".
    These are hashes, not credentials - a hash cannot be used to authenticate - so they are
    safe in Terraform state. Mint entries with `node streaming/mint-token.js <label>`.
  EOT
  type        = string

  validation {
    # An empty allowlist would deploy a service nobody can use; the server refuses to start on
    # one, and catching it at plan time is cheaper than catching it at rollout.
    condition     = length(trimspace(var.device_tokens)) > 0
    error_message = "device_tokens must list at least one device, or no one can authenticate."
  }
}

variable "image" {
  description = "Container image for the service, e.g. us-central1-docker.pkg.dev/<project>/mymusic/streaming:<tag>. Built and pushed by scripts/deploy-streaming.sh, not by Terraform."
  type        = string
}

variable "url_ttl_seconds" {
  description = "Lifetime of a minted signed URL. Longer than any track, short enough that a leaked URL is nearly worthless."
  type        = number
  default     = 3600
}

variable "max_instances" {
  description = "Ceiling on concurrent Cloud Run instances. Requests are tiny and rare; this exists to bound a runaway bill, not to serve load."
  type        = number
  default     = 3
}
