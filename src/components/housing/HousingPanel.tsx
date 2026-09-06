import { useTranslation } from '../../hooks/useTranslation';
import { HousingBoard } from './HousingBoard';

// Desktop host. Verification opens the poster's IS page in a new tab: the
// extension runs inside is.mendelu.cz, so the student is already signed in.
export function HousingPanel() {
  const { t } = useTranslation();
  return (
    <div className="mx-auto flex h-full w-full max-w-2xl flex-col">
      <div className="px-3 pt-3">
        <h2 className="text-xl font-bold">{t('housing.title')}</h2>
        <p className="text-sm opacity-70">{t('housing.subtitle')}</p>
      </div>
      <HousingBoard
        onVerify={(post) =>
          window.open(
            `https://is.mendelu.cz/lide/clovek.pl?id=${encodeURIComponent(post.personId)}`,
            '_blank',
            'noopener,noreferrer'
          )
        }
      />
    </div>
  );
}
