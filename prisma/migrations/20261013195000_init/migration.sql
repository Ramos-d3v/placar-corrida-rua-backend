-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "events" (
    "id" UUID NOT NULL,
    "event_title" TEXT NOT NULL,
    "event_slug" TEXT NOT NULL,
    "total_results" INTEGER NOT NULL,
    "imported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "results" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "bib_number" TEXT NOT NULL,
    "athlete_name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "gender" TEXT NOT NULL,
    "rank_general" INTEGER,
    "rank_category" INTEGER,
    "time_gross" TEXT,
    "time_net" TEXT,
    "team_name" TEXT,

    CONSTRAINT "results_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "events_event_slug_key" ON "events"("event_slug");

-- CreateIndex
CREATE INDEX "results_event_id_rank_general_idx" ON "results"("event_id", "rank_general");

-- CreateIndex
CREATE INDEX "results_event_id_gender_rank_general_idx" ON "results"("event_id", "gender", "rank_general");

-- CreateIndex
CREATE INDEX "results_event_id_category_rank_category_idx" ON "results"("event_id", "category", "rank_category");

-- CreateIndex
CREATE INDEX "results_event_id_athlete_name_idx" ON "results"("event_id", "athlete_name");

-- CreateIndex
CREATE UNIQUE INDEX "results_event_id_bib_number_key" ON "results"("event_id", "bib_number");

-- AddForeignKey
ALTER TABLE "results" ADD CONSTRAINT "results_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;