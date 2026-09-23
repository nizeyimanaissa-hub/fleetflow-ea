/*
  Warnings:

  - Added the required column `scheduledEnd` to the `Trip` table without a default value. This is not possible if the table is not empty.
  - Added the required column `scheduledStart` to the `Trip` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Trip" ADD COLUMN     "scheduledEnd" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "scheduledStart" TIMESTAMP(3) NOT NULL;

-- CreateTable
CREATE TABLE "SchedulingRule" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "maxDrivingHoursPerDay" DOUBLE PRECISION NOT NULL DEFAULT 8,
    "maxDrivingHoursPerWeek" DOUBLE PRECISION NOT NULL DEFAULT 48,
    "minRestHoursBetweenTrips" DOUBLE PRECISION NOT NULL DEFAULT 11,
    "maxConsecutiveDrivingDays" INTEGER NOT NULL DEFAULT 6,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchedulingRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SchedulingRule_companyId_key" ON "SchedulingRule"("companyId");

-- AddForeignKey
ALTER TABLE "SchedulingRule" ADD CONSTRAINT "SchedulingRule_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
