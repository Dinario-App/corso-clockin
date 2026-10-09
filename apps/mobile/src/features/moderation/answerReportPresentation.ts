import { copy } from '@/constants/copy';
import {
  resolveReportReasonRows,
  type ReportMenuView,
  type ReportStatus,
} from './reportTokenPresentation';

/** Shared width keeps both report menus inside the 369 dp Seeker margins. */
export const MODERATION_REPORT_MENU_WIDTH = 268;
export const ANSWER_REPORT_MENU_WIDTH = MODERATION_REPORT_MENU_WIDTH;

export function resolveAnswerReportMenu(status: ReportStatus): ReportMenuView {
  return {
    title: copy.home.answerReport.title,
    reasons: status === 'idle' ? resolveReportReasonRows() : [],
    note:
      status === 'sending'
        ? copy.home.answerReport.sending
        : status === 'sent'
          ? copy.home.answerReport.sent
          : status === 'failed'
            ? copy.home.answerReport.failed
            : copy.home.answerReport.note,
    retryLabel: status === 'failed' ? copy.home.answerReport.retry : null,
    busy: status === 'sending',
    dismissLabel: copy.home.answerReport.close,
  };
}
