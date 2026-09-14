-- NOT unique on purpose: the dataset has 6 (name, category_id) pairs twice, so a UNIQUE
-- index rejects the exercise import. Matches lib/db/schema.ts and lib/db/ddl.ts.
CREATE INDEX `name_category_idx` ON `exercises` (`name`,`category_id`);
