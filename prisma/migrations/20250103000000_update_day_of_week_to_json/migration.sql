-- AlterTable: Change dayOfWeek from Int to Json to support multiple days
-- Convert existing integer values to JSON arrays and change column type
ALTER TABLE "Recurrence" 
ALTER COLUMN "dayOfWeek" TYPE JSONB 
USING CASE 
  WHEN "dayOfWeek" IS NULL THEN NULL::jsonb
  ELSE json_build_array("dayOfWeek"::int)::jsonb
END;

