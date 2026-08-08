-- Add drop set support to sets table
-- method: 'linear' (default), 'dropset', 'superset', 'pyramid_up', 'pyramid_down'
-- drop_order: order within a drop set group (1 = first drop, 2 = second, etc.)
-- is_drop_group: 1 if this set is the START of a drop set group
ALTER TABLE `sets` ADD COLUMN `method` TEXT DEFAULT 'linear';
ALTER TABLE `sets` ADD COLUMN `drop_order` INTEGER DEFAULT 0;
ALTER TABLE `sets` ADD COLUMN `is_drop_group` INTEGER DEFAULT 0;
