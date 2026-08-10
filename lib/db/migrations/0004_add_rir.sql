-- Add RIR (Reps In Reserve) support to sets table
-- rir: how many reps were left in reserve when finishing the set
--   0 = to failure, 1 = one rep left, 2 = two reps left, etc.
--   NULL = not recorded
ALTER TABLE `sets` ADD COLUMN `rir` INTEGER;