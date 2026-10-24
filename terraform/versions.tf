terraform {
  required_version = ">= 1.5"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
  }

  # State lives in its own bucket, not the music bucket, and not on this laptop - losing the
  # laptop is the scenario this whole project exists to survive. Create it by hand once:
  #
  #   Cloud Storage -> Create bucket -> <project>-tfstate, us-central1, Standard,
  #   versioning ON (state history is the undo button)
  #
  # then `terraform init`. Configured via -backend-config so the bucket name stays out of this
  # public repo; see backend.hcl.example.
  backend "gcs" {
    prefix = "streaming"
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}
