import { useState } from 'react';
import { ShieldCheck, Flag } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import type { HousingPost } from '../../types/housing';

export function HousingCard({
  post,
  onVerify,
  onReport,
}: {
  post: HousingPost;
  onVerify: (post: HousingPost) => void;
  onReport: (post: HousingPost) => Promise<boolean>;
}) {
  const { t, language } = useTranslation();
  const [reportState, setReportState] = useState<'idle' | 'sent' | 'failed'>('idle');
  const locale = language === 'cz' ? 'cs' : language;
  const fmt = (iso: string) => new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'numeric' });

  return (
    <div className="card card-compact bg-base-100 shadow-sm">
      <div className="card-body gap-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="badge badge-outline badge-sm">{t(`housing.roomType.${post.roomType}`)}</div>
            <h3 className="mt-1 text-base font-semibold">{post.district}</h3>
          </div>
          {post.priceCzk !== null && (
            <div className="text-right text-sm font-semibold">
              {post.priceCzk.toLocaleString(locale)} <span className="text-xs font-normal opacity-70">{t('housing.priceUnit')}</span>
            </div>
          )}
        </div>
        <div className="text-sm opacity-80">
          {t('housing.freeFrom')} {fmt(post.freeFrom)}
          {post.freeUntil && ` ${t('housing.freeUntil')} ${fmt(post.freeUntil)}`}
        </div>
        {post.note && <p className="whitespace-pre-wrap text-sm">{post.note}</p>}
        <div className="text-sm">
          <span className="opacity-70">{t('housing.contact')}: </span>
          <span className="select-all font-medium">{post.contact}</span>
        </div>
        <div className="card-actions items-center justify-between">
          {/* The login is the trust mechanism: one tap opens the poster in IS. */}
          <button type="button" className="btn btn-ghost btn-sm gap-1" onClick={() => onVerify(post)}>
            <ShieldCheck size={14} /> {post.isLogin} · {t('housing.verify')}
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-xs opacity-70"
            disabled={reportState === 'sent'}
            onClick={async () => { setReportState((await onReport(post)) ? 'sent' : 'failed'); }}
          >
            <Flag size={12} /> {reportState === 'sent' ? t('housing.reported') : reportState === 'failed' ? t('housing.form.failed') : t('housing.report')}
          </button>
        </div>
      </div>
    </div>
  );
}
