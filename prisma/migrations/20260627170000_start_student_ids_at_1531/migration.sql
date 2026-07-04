-- Normalize readable student IDs so each year starts at 1531 with no zero padding.
WITH numbered_students AS (
  SELECT
    "id",
    'VTC-' || to_char("createdAt", 'YY') ||
      (
        1530 + row_number() OVER (
          PARTITION BY date_part('year', "createdAt")
          ORDER BY "createdAt", "id"
        )
      )::text AS normalized_student_id
  FROM "Student"
)
UPDATE "Student" AS student
SET "studentId" = 'TMP-STUDENT-ID-' || student."id"
FROM numbered_students
WHERE student."id" = numbered_students."id"
  AND student."studentId" IS DISTINCT FROM numbered_students.normalized_student_id;

WITH numbered_students AS (
  SELECT
    "id",
    'VTC-' || to_char("createdAt", 'YY') ||
      (
        1530 + row_number() OVER (
          PARTITION BY date_part('year', "createdAt")
          ORDER BY "createdAt", "id"
        )
      )::text AS normalized_student_id
  FROM "Student"
)
UPDATE "Student" AS student
SET "studentId" = numbered_students.normalized_student_id
FROM numbered_students
WHERE student."id" = numbered_students."id"
  AND student."studentId" LIKE 'TMP-STUDENT-ID-%';
