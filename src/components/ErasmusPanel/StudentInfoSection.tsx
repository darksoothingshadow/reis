import { useEffect } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { useAppStore } from '@/store/useAppStore';
import type { UserParams } from '@/utils/userParams';

interface Props {
  userParams: UserParams | null;
  dob: string;
}

export function StudentInfoSection({ userParams, dob }: Props) {
  const { t } = useTranslation();
  const info = useAppStore((s) => s.erasmusStudentInfo);
  const setInfo = useAppStore((s) => s.setErasmusStudentInfo);
  const initInfo = useAppStore((s) => s.initErasmusStudentInfo);

  useEffect(() => {
    if (!userParams) return;
    initInfo({
      fullName: userParams.fullName,
      studyProgram: userParams.studyProgram,
      studentId: userParams.studentId,
    });
  }, [userParams, initInfo]);

  useEffect(() => {
    if (!dob || info.dob) return;
    setInfo({ dob });
  }, [dob, info.dob, setInfo]);

  const inputCls =
    'input input-sm input-bordered bg-base-200 w-full text-xs focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20';
  const labelCls = 'text-[10px] uppercase tracking-wider font-bold text-base-content/70 ml-1';

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 px-1">
        <div className="badge badge-sm font-black tracking-wider bg-base-content/10 text-base-content/70 border-base-content/20">
          S
        </div>
        <span className="text-[10px] uppercase tracking-widest font-bold text-base-content/70">
          {t('erasmus.studentInfo')}
        </span>
      </div>

      <div className="bg-base-100 border border-base-300 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className={labelCls}>{t('erasmus.firstName')}</label>
              <input
                type="text"
                className={inputCls}
                value={info.firstName}
                onChange={(e) => setInfo({ firstName: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelCls}>{t('erasmus.lastName')}</label>
              <input
                type="text"
                className={inputCls}
                value={info.lastName}
                onChange={(e) => setInfo({ lastName: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className={labelCls}>{t('erasmus.dateOfBirth')}</label>
              <input
                type="text"
                className={inputCls}
                placeholder="DD.MM.YYYY"
                value={info.dob}
                onChange={(e) => setInfo({ dob: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelCls}>{t('erasmus.studyCode')}</label>
              <input
                type="text"
                className={inputCls}
                value={info.studyCode}
                onChange={(e) => setInfo({ studyCode: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className={labelCls}>{t('erasmus.semesterOfStay')}</label>
              <div className="join">
                {(['WS', 'SS'] as const).map((sem) => (
                  <button
                    key={sem}
                    onClick={() => setInfo({ semester: info.semester === sem ? '' : sem })}
                    className={`join-item btn btn-sm flex-1 text-xs font-bold border-0 ${info.semester === sem ? 'btn-primary' : 'btn-ghost'}`}
                  >
                    {t(sem === 'WS' ? 'erasmus.semesterWS' : 'erasmus.semesterSS')}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelCls}>{t('erasmus.studentId')}</label>
              <input
                type="text"
                className={inputCls}
                value={info.studentId}
                onChange={(e) => setInfo({ studentId: e.target.value })}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
