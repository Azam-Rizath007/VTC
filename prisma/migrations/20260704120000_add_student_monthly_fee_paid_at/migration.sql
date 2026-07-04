ALTER TABLE "StudentMonthlyFee" ADD COLUMN "paidAt" TIMESTAMP(3);

UPDATE "StudentMonthlyFee" AS monthly_fee
SET "paidAt" = latest_payment."paidAt"
FROM (
  SELECT
    "studentId",
    "month",
    "year",
    MAX("paidAt") AS "paidAt"
  FROM "FeePayment"
  WHERE "paidAt" IS NOT NULL
  GROUP BY "studentId", "month", "year"
) AS latest_payment
WHERE monthly_fee."studentId" = latest_payment."studentId"
  AND monthly_fee."month" = latest_payment."month"
  AND monthly_fee."year" = latest_payment."year";
