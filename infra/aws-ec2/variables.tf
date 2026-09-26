variable "aws_region" {
  type    = string
  default = "ap-south-1"
}

variable "instance_type" {
  type    = string
  default = "t3.medium"
}

variable "disk_gb" {
  type    = number
  default = 40
}

variable "key_name" {
  type        = string
  description = "Existing EC2 SSH key pair name"
}

variable "ssh_cidr" {
  type        = string
  description = "Administrator public IP in CIDR form, e.g. 203.0.113.10/32"
  validation {
    condition     = can(cidrhost(var.ssh_cidr, 0)) && !contains(["0.0.0.0/0", "::/0"], var.ssh_cidr)
    error_message = "Provide a valid restricted administrator CIDR."
  }
}
