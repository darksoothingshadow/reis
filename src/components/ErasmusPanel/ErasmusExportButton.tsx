import { useState } from 'react';
import { Download } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { downloadErasmusPdf } from '@/utils/erasmusPdf';

interface Props {
  className?: string;
}

export function ErasmusExportButton({ className = '' }: Props) {
  const studentInfo = useAppStore((s) => s.erasmusStudentInfo);
  const options = useAppStore((s) => s.erasmusTableAOptions);
  const tableBCourses = useAppStore((s) => s.erasmusTableBCourses);
  const tableBManual = useAppStore((s) => s.erasmusTableBManualCourses);
  const dualPlan = useAppStore((s) => s.studyPlanDual);
  const [loading, setLoading] = useState(false);

  // PDF must always use English subject names regardless of UI language (EU guidelines)
  const allSubjects = (dualPlan?.en?.blocks ?? []).flatMap((b) =>
    (b.groups ?? []).flatMap((g) => g.subjects ?? [])
  );

  const handleExport = async () => {
    setLoading(true);
    try {
      await downloadErasmusPdf(studentInfo, options, tableBCourses, allSubjects, tableBManual);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={loading}
      className={`btn btn-sm gap-2 text-xs font-bold border-0 ${className}`}
    >
      {loading ? <span className="loading loading-spinner loading-xs" /> : <Download size={12} />}
      Export .pdf
    </button>
  );
}
