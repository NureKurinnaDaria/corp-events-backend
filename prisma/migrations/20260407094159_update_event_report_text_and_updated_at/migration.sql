/*
  Warnings:

  - Added the required column `updatedAt` to the `EventReport` table without a default value. This is not possible if the table is not empty.
  - Made the column `text` on table `EventReport` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "EventReport" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "text" SET NOT NULL;
