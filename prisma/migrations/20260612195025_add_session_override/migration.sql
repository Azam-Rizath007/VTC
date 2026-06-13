-- CreateTable
CREATE TABLE "SessionOverride" (
    "id" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "gradeId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "extraSessions" INTEGER NOT NULL DEFAULT 1,
    "grantedBy" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SessionOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SessionOverride_subjectId_gradeId_month_year_key" ON "SessionOverride"("subjectId", "gradeId", "month", "year");

-- AddForeignKey
ALTER TABLE "SessionOverride" ADD CONSTRAINT "SessionOverride_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionOverride" ADD CONSTRAINT "SessionOverride_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "Grade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionOverride" ADD CONSTRAINT "SessionOverride_grantedBy_fkey" FOREIGN KEY ("grantedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
