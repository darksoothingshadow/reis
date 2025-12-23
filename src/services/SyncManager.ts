import { fetchWeekSchedule } from "../api/schedule";
import { fetchExamData } from "../api/exams";
import { fetchSubjects } from "../api/subjects";
import { fetchFilesFromFolder } from "../api/documents";
import { fetchSubjectSuccessRates } from "../api/successRate";
import { loggers } from "../utils/logger";
import type { SyncedData } from "../types/messages";
import type { SubjectsData, ParsedFile } from "../types/documents";

export class SyncManager {
    private cachedData: SyncedData = { lastSync: 0 };
    private syncIntervalId: ReturnType<typeof setInterval> | null = null;
    private onUpdate: (data: SyncedData) => void;

    constructor(onUpdate: (data: SyncedData) => void) {
        this.onUpdate = onUpdate;
    }

    public start(intervalMs: number) {
        loggers.system.info("[SyncManager] Starting service...");
        this.syncAllData();
        this.syncIntervalId = setInterval(() => {
            this.syncAllData();
        }, intervalMs);
    }

    public stop() {
        if (this.syncIntervalId) {
            clearInterval(this.syncIntervalId);
        }
    }

    public getCachedData() {
        return this.cachedData;
    }

    public async syncAllData() {
        loggers.system.info("[SyncManager] Syncing all data...");
        const startTime = Date.now();

        try {
            const [schedule, exams, subjects] = await Promise.allSettled([
                this.fetchScheduleData(),
                fetchExamData(),
                fetchSubjects(),
            ]);

            this.cachedData = {
                schedule: schedule.status === "fulfilled" ? schedule.value : null,
                exams: exams.status === "fulfilled" ? exams.value : null,
                subjects: subjects.status === "fulfilled" ? subjects.value : null,
                files: {},
                lastSync: Date.now(),
            };

            this.onUpdate(this.cachedData);

            if (subjects.status === "fulfilled" && subjects.value) {
                const subjectsData = subjects.value as SubjectsData;
                const files: Record<string, ParsedFile[]> = {};
                const subjectEntries = Object.entries(subjectsData.data);

                // Fetch files for each subject
                for (const [courseCode, subject] of subjectEntries) {
                    if (subject.folderUrl) {
                        try {
                            const subjectFiles = await fetchFilesFromFolder(subject.folderUrl);
                            files[courseCode] = subjectFiles;
                        } catch (e) {
                            loggers.system.warn(`[SyncManager] Failed to fetch files for ${courseCode}:`, e);
                        }
                    }
                }

                this.cachedData.files = files;
                this.cachedData.lastSync = Date.now();
                this.onUpdate(this.cachedData);

                // Start success rate sync in parallel
                this.syncSuccessRates(subjectsData);

                loggers.system.info(`[SyncManager] Full sync complete in ${Date.now() - startTime}ms`);
            }
        } catch (error) {
            loggers.system.error("[SyncManager] Sync failed:", error);
            this.cachedData.error = String(error);
        }
    }

    private async syncSuccessRates(subjectsData: SubjectsData) {
        try {
            const codes = Object.keys(subjectsData.data);
            if (codes.length > 0) {
                loggers.system.info(`[SyncManager] Fetching success rates for ${codes.length} subjects...`);
                const stats = await fetchSubjectSuccessRates(codes);
                this.cachedData.successRates = stats;
                this.cachedData.successRatesFetched = true;
                this.onUpdate(this.cachedData);
            }
        } catch (statsError) {
            loggers.system.warn('[SyncManager] Success rate sync failed:', statsError);
        }
    }

    private async fetchScheduleData() {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();

        let start: Date;
        let end: Date;

        if (currentMonth >= 8) {
            start = new Date(currentYear, 8, 1);
            end = new Date(currentYear + 1, 1, 28);
        } else if (currentMonth <= 1) {
            start = new Date(currentYear - 1, 8, 1);
            end = new Date(currentYear, 1, 28);
        } else {
            start = new Date(currentYear, 1, 1);
            end = new Date(currentYear, 7, 31);
        }

        return fetchWeekSchedule({ start, end });
    }
}
