-- AlterTable: Change dayOfMonth from Int to Json to support multiple days
-- Convert existing integer values to JSON arrays and change column type
ALTER TABLE "Recurrence" 
ALTER COLUMN "dayOfMonth" TYPE JSONB 
USING CASE 
  WHEN "dayOfMonth" IS NULL THEN NULL::jsonb
  ELSE json_build_array("dayOfMonth"::int)::jsonb
END;

