const SECRET = 'CAMBIA_ESTE_TEXTO_POR_UNA_CLAVE_LARGA';

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    if (data.secret !== SECRET) {
      return json({ ok: false, error: 'unauthorized' });
    }

    const recipients = Array.isArray(data.to) ? data.to.join(',') : String(data.to || '');
    if (!recipients) {
      return json({ ok: false, error: 'no_recipients' });
    }

    GmailApp.sendEmail(recipients, data.subject || 'Aviso IT Inventario', data.text || '', {
      name: data.fromName || 'IT Inventario',
    });

    return json({ ok: true });
  } catch (error) {
    return json({ ok: false, error: String(error) });
  }
}

function json(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
