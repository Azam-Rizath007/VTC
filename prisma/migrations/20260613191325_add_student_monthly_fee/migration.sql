-- CreateTable
CREATE TABLE "StudentMonthlyFee" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "expectedAmount" INTEGER NOT NULL,
    "paidAmount" INTEGER NOT NULL DEFAULT 0,
    "discount" INTEGER NOT NULL DEFAULT 0,
    "balance" INTEGER NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentMonthlyFee_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudentMonthlyFee_month_year_status_idx" ON "StudentMonthlyFee"("month", "year", "status");

-- CreateIndex
CREATE INDEX "StudentMonthlyFee_studentId_idx" ON "StudentMonthlyFee"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentMonthlyFee_studentId_month_year_key" ON "StudentMonthlyFee"("studentId", "month", "year");

-- AddForeignKey
ALTER TABLE "StudentMonthlyFee" ADD CONSTRAINT "StudentMonthlyFee_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
