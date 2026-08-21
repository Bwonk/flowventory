import { Resend } from 'resend';
import { logger } from '@/lib/logger';
import type { AlertCandidate } from './rules';

/**
 * Resend ile alarm özeti e-postası.
 * RESEND_API_KEY tanımlı değilse sessizce atlanır (uygulama içi bildirim
 * her durumda çalışır; e-posta opsiyonel katman).
 */

const TYPE_LABELS: Record<string, string> = {
  'critical-stock': 'Kritik Stok',
  'dead-stock': 'Ölü Stok',
  'sales-spike': 'Satış Artışı',
};

export async function sendAlertEmail(to: string, alerts: AlertCandidate[]): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    logger.warn('RESEND_API_KEY not set, skipping alert email');
    return;
  }
  const from = process.env.RESEND_FROM || 'Flowventory <onboarding@resend.dev>';

  const items = alerts
    .map(
      a =>
        `<tr>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:12px;color:#616161;white-space:nowrap">${TYPE_LABELS[a.type] ?? a.type}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#212121"><span style="font-weight:600">${a.title}.</span> ${a.body}</td>
        </tr>`,
    )
    .join('');

  const html = `
    <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px">
      <p style="font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#93939f;margin:0 0 4px">FLOWVENTORY</p>
      <h1 style="font-size:20px;font-weight:600;color:#17171c;margin:0 0 16px">Stok Uyarıları (${alerts.length})</h1>
      <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px">${items}</table>
      <p style="font-size:12px;color:#93939f;margin-top:16px">
        Bu e-posta, Flowventory bildirim ayarlarınız açık olduğu için gönderildi.
        Ayarlar sayfasından kapatabilirsiniz.
      </p>
    </div>`;

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from,
    to,
    subject: `Flowventory: ${alerts.length} stok uyarısı`,
    html,
  });
  if (error) throw new Error(`Resend error: ${error.message}`);
}
