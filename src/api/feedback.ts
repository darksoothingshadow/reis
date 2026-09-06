import { supabase } from '../services/spolky/supabaseClient';
import { isDemoMode } from '../errors/demoMode';
import { getInstallId } from '../services/identity/installId';
import { getPlatform } from '../platform';
import { getUserParams } from '../utils/userParams';
import { usagePlatform, type UsagePlatform } from '../utils/usagePlatform';

/**
 * Both writes here identify the DEVICE, never the student.
 *
 * They used to send `SHA-256(studentId)`, which reads as anonymisation and is
 * not: IS student ids are six or seven digits, so the whole preimage space is
 * under ten million and a rainbow table reverses the digest in seconds. That
 * made every row a recoverable student identifier sitting in Supabase, which is
 * the exact opposite of reIS's promise that student data stays on the device.
 *
 * The replacement is a random per-install UUID (see services/identity). The
 * consequence is deliberate and must be read that way in any dashboard built on
 * these tables: they count INSTALLS, not people. One student on a phone and a
 * laptop is two rows, and a reinstall is a third. Where a per-person number is
 * needed, ask the student — an estimate that can be defended beats an exact
 * number that cannot.
 */
export async function submitFeedback(
  feedbackType: 'nps' | 'one_change',
  value: string,
  semesterCode: string,
  reason?: string
): Promise<boolean> {
  // Demo mode is a fabricated student; its feedback would pollute real rows.
  if (isDemoMode()) return false;

  const { error } = await supabase.rpc('submit_feedback', {
    p_student_id: await getInstallId(),
    p_faculty_id: null,
    p_study_semester: null,
    p_feedback_type: feedbackType,
    p_value: value,
    p_semester_code: semesterCode,
    p_reason: reason ?? null,
  });
  if (error) return false;

  return true;
}

/**
 * Faculty and platform are GROUP labels (seven faculties, four platforms) on
 * the same random install id — a count, not a record. Disclosed in
 * PRIVACY.md ("Daily Usage & NPS Feedback").
 */
export async function trackDailyUsage(): Promise<void> {
  if (isDemoMode()) return;

  const faculty = (await getUserParams())?.facultyId ?? null;
  const kind = getPlatform().kind;
  // @capacitor/core imported lazily, and only on the capacitor branch, so the
  // extension bundle never pulls it in — the same reason client.ts's
  // fetchWithAuth does the same dynamic import.
  let platform: UsagePlatform;
  if (kind === 'capacitor') {
    const { Capacitor } = await import('@capacitor/core');
    platform = usagePlatform(kind, () => Capacitor.getPlatform());
  } else {
    platform = usagePlatform(kind, () => 'web');
  }

  const { error } = await supabase.rpc('track_daily_usage', {
    p_student_id: await getInstallId(),
    p_faculty: faculty,
    p_platform: platform,
  });
  if (error) return;
}
