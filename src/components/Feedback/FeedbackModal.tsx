import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Send, Loader2, CheckCircle2 } from 'lucide-react';
import { submitSuggestion } from '../../api/suggestions';
import { toast } from 'sonner';
import { useTranslation } from '../../hooks/useTranslation';
import { logError } from '../../utils/reportError';
import { feedbackErrorKey } from './feedbackErrorKey';
import { useAppStore } from '../../store/useAppStore';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function FeedbackModal({ isOpen, onClose }: FeedbackModalProps) {
  const [type, setType] = useState<'bug' | 'idea' | 'other'>('bug');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [contact, setContact] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const { t } = useTranslation();
  // Phones get a bottom sheet, not a centred dialog: a floating card with a
  // blurred backdrop is a desktop idiom, and every other mobile surface here
  // rises from the bottom edge.
  const isPhone = useAppStore((s) => s.isTouch && s.isNarrow);

  const handleSubmit = async (e?: React.SyntheticEvent) => {
    if (e) e.preventDefault();
    // The Send button's `disabled` is not the only entry point: Enter in the
    // title or contact field calls this directly. Without its own check, Enter
    // on a half-filled form posts an empty body, the function 400s it, and the
    // student sees the generic failure toast for input the UI should have
    // caught. Trimmed, so whitespace does not count as filled in either.
    if (isSending || !title.trim() || !message.trim()) return;
    setIsSending(true);

    // Context (screen, version, browser, viewport) is assembled in the API
    // layer. Deliberately no window.location.href: on IS it carries
    // studium=/obdobi=/predmet=/termin=.
    // NOTE the rename: SuggestionDraft's field is `body`, the component's state
    // variable is `message`.
    // try/finally is the safety net: submitSuggestion catches internally and
    // resolves { ok: false, error: 'offline' } today, but if that invariant
    // ever breaks, an unexpected rejection must not leave the Send button
    // stuck on "Sending…" with the user's text trapped behind it.
    try {
      const result = await submitSuggestion({ type, title, body: message, contact });

      if (result.ok) {
        setIsSuccess(true);
        toast.success(t('feedback.toastSuccess'));
      } else {
        toast.error(t(feedbackErrorKey(result.error)));
      }
    } catch (err) {
      logError('FeedbackModal.handleSubmit', err);
      toast.error(t(feedbackErrorKey(undefined)));
    } finally {
      setIsSending(false);
    }
  };

  const handleClose = () => {
    onClose();
    // Reset form after delay
    setTimeout(() => {
      setIsSuccess(false);
      setTitle('');
      setMessage('');
      setContact('');
      setType('bug');
    }, 300);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className={`fixed inset-0 z-[60] flex justify-center ${
            isPhone ? 'items-end px-0' : 'items-center px-4'
          }`}
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={handleClose}
          />

          <motion.div
            initial={isPhone ? { y: '100%' } : { opacity: 0, scale: 0.95, y: 10 }}
            animate={isPhone ? { y: 0 } : { opacity: 1, scale: 1, y: 0 }}
            exit={isPhone ? { y: '100%' } : { opacity: 0, scale: 0.95, y: 10 }}
            className={`w-full bg-base-100 shadow-2xl border-base-300 overflow-hidden relative z-10 ${
              isPhone
                ? 'max-w-none rounded-t-[20px] border-t max-h-[85dvh] overflow-y-auto'
                : 'max-w-md rounded-2xl border'
            }`}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-base-300/50">
              <h3 className="font-semibold text-lg text-base-content">{t('feedback.title')}</h3>
              <button
                onClick={handleClose}
                aria-label={t('feedback.close')}
                className="btn btn-sm btn-ghost btn-circle text-base-content/75 hover:text-base-content"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              {isSuccess ? (
                <div className="flex flex-col items-center justify-center py-8 text-center space-y-4">
                  <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center text-success mb-2">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl font-bold text-base-content">
                    {t('feedback.successTitle')}
                  </h3>
                  <p className="text-base-content/60 max-w-xs">{t('feedback.successText')}</p>
                  <button onClick={handleClose} className="btn btn-primary w-full mt-4">
                    {t('feedback.close')}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Type Selection */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-base-content/60 ml-1">
                      {t('feedback.typeLabel')}
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setType('bug')}
                        className={`btn btn-sm border-0 ${type === 'bug' ? 'bg-error/20 text-base-content hover:bg-error/30' : 'bg-base-200 text-base-content/75 hover:bg-base-300 hover:text-base-content'}`}
                      >
                        {t('feedback.bug')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setType('idea')}
                        className={`btn btn-sm border-0 ${type === 'idea' ? 'bg-warning/20 text-base-content hover:bg-warning/30' : 'bg-base-200 text-base-content/75 hover:bg-base-300 hover:text-base-content'}`}
                      >
                        {t('feedback.idea')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setType('other')}
                        className={`btn btn-sm border-0 ${type === 'other' ? 'bg-neutral text-neutral-content hover:bg-neutral/80' : 'bg-base-200 text-base-content/75 hover:bg-base-300 hover:text-base-content'}`}
                      >
                        {t('feedback.other')}
                      </button>
                    </div>
                  </div>

                  {/* Title */}
                  <div className="form-control">
                    <label className="label pt-0 pb-1">
                      <span className="text-sm font-medium text-base-content/60">
                        {t('feedback.subject')}
                      </span>
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder={t('feedback.subjectPlaceholder')}
                      className="input input-bordered w-full bg-base-200 border-base-300 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20 text-base-content transition-colors"
                      required
                      autoFocus
                      maxLength={120}
                      onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                    />
                  </div>

                  {/* Message */}
                  <div className="form-control">
                    <label className="label pt-0 pb-1">
                      <span className="text-sm font-medium text-base-content/60">
                        {t('feedback.description')}
                      </span>
                    </label>
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder={t('feedback.descriptionPlaceholder')}
                      className="textarea textarea-bordered h-32 w-full bg-base-200 border-base-300 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20 text-base-content transition-colors leading-relaxed resize-none"
                      required
                      maxLength={2000}
                    />
                  </div>

                  {/* Contact (Optional) */}
                  <div className="form-control">
                    <label className="label pt-0 pb-1">
                      <span className="text-sm font-medium text-base-content/60">
                        {t('feedback.contact')}
                      </span>
                    </label>
                    <input
                      type="text"
                      value={contact}
                      onChange={(e) => setContact(e.target.value)}
                      placeholder={t('feedback.contactPlaceholder')}
                      className="input input-bordered w-full bg-base-200 border-base-300 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20 text-base-content transition-colors"
                      onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                    />
                  </div>

                  {/* Submit Button */}
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={isSending || !title.trim() || !message.trim()}
                      className="btn btn-primary w-full gap-2 font-semibold no-animation"
                    >
                      {isSending ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          {t('feedback.sending')}
                        </>
                      ) : (
                        <>
                          <Send className="w-5 h-5" />
                          {t('feedback.submit')}
                        </>
                      )}
                    </button>
                  </div>

                  <p className="text-[10px] text-center text-base-content/75 mt-2">
                    {t('feedback.footer')}
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
