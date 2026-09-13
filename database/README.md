# Database migrations

Run migrations once against PostgreSQL before starting the upgraded server. The first migration adds the multi-branch foundation without deleting existing records.

```powershell
psql -h localhost -U postgres -d ordernow -f database/migrations/001_multi_branch_foundation.sql
```

After it succeeds, create at least one branch in the admin screen or through `POST /api/branches`, then assign staff to that branch. Existing records have a null `branch_id` until they are migrated to a selected branch.

Run `002_reservation_otp.sql` next to enable OTP, customer profiles and transaction-safe time-range reservation checks.
