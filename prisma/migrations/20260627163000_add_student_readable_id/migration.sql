-- Add readable public student IDs while preserving the internal primary key.
ALTER TABLE "Student" ADD COLUMN "studentId" TEXT;

WITH numbered_students AS (
  SELECT
    "id",
    'VTC-' || to_char("createdAt", 'YY') ||
      lpad(
        row_number() OVER (
          PARTITION BY date_part('year', "createdAt")
          ORDER BY "createdAt", "id"
        )::text,
        8,
        '0'
      ) AS generated_student_id
  FROM "Student"
)
UPDATE "Student" AS student
SET "studentId" = numbered_students.generated_student_id
FROM numbered_students
WHERE student."id" = numbered_students."id";

ALTER TABLE "Student" ALTER COLUMN "studentId" SET NOT NULL;

CREATE UNIQUE INDEX "Student_studentId_key" ON "Student"("studentId");
