/*
  Warnings:

  - Added the required column `destinationLat` to the `Trip` table without a default value. This is not possible if the table is not empty.
  - Added the required column `destinationLng` to the `Trip` table without a default value. This is not possible if the table is not empty.
  - Added the required column `originLat` to the `Trip` table without a default value. This is not possible if the table is not empty.
  - Added the required column `originLng` to the `Trip` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Trip" ADD COLUMN     "destinationLat" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "destinationLng" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "estimatedArrival" TIMESTAMP(3),
ADD COLUMN     "originLat" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "originLng" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "routeDistanceKm" DOUBLE PRECISION,
ADD COLUMN     "routeDurationMin" DOUBLE PRECISION,
ADD COLUMN     "routeGeometry" JSONB;

-- CreateTable
CREATE TABLE "GpsPing" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "speedKmh" DOUBLE PRECISION,
    "offRoute" BOOLEAN NOT NULL DEFAULT false,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GpsPing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GpsPing_tripId_idx" ON "GpsPing"("tripId");

-- CreateIndex
CREATE INDEX "GpsPing_tripId_recordedAt_idx" ON "GpsPing"("tripId", "recordedAt");

-- AddForeignKey
ALTER TABLE "GpsPing" ADD CONSTRAINT "GpsPing_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
