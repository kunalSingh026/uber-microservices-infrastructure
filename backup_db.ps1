# Database Backup Automation Script for Mini Uber Microservices
# Resolves: Phase 2 Persistent State & Backup Strategies

Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "Initiating Live Database Snapshots..." -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan

# 1. Ensure backup directory folders exist on the host
$passengerBackupPath = Join-Path $PSScriptRoot "backups/passenger_db"
$driverBackupPath = Join-Path $PSScriptRoot "backups/driver_db"

if (-not (Test-Path $passengerBackupPath)) {
    New-Item -ItemType Directory -Path $passengerBackupPath -Force | Out-Null
}
if (-not (Test-Path $driverBackupPath)) {
    New-Item -ItemType Directory -Path $driverBackupPath -Force | Out-Null
}

# 2. Execute hot dump in passenger-db mongo container (outputs to mounted /backup folder)
Write-Host "[1/2] Backing up passenger_db database..." -ForegroundColor Yellow
docker exec mini_uber_passenger_db mongodump --db passenger_service_db --out /backup --gzip
if ($LASTEXITCODE -eq 0) {
    Write-Host "[SUCCESS] passenger_db backup complete. Saved to host path: ./backups/passenger_db" -ForegroundColor Green
} else {
    Write-Error "[FAILURE] Could not backup passenger_db. Ensure the container mini_uber_passenger_db is running."
}

# 3. Execute hot dump in driver-db mongo container (outputs to mounted /backup folder)
Write-Host "[2/2] Backing up driver_db database..." -ForegroundColor Yellow
docker exec mini_uber_driver_db mongodump --db driver_service_db --out /backup --gzip
if ($LASTEXITCODE -eq 0) {
    Write-Host "[SUCCESS] driver_db backup complete. Saved to host path: ./backups/driver_db" -ForegroundColor Green
} else {
    Write-Error "[FAILURE] Could not backup driver_db. Ensure the container mini_uber_driver_db is running."
}

Write-Host "`nAll operations completed!" -ForegroundColor Cyan
