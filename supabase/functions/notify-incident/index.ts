import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function statusLabel(status: string) {
  if (status === "open") return "Abierta";
  if (status === "assigned") return "Asignada";
  if (status === "in_progress") return "En progreso";
  if (status === "waiting_user") return "Pendiente usuario";
  if (status === "resolved") return "Resuelta";
  if (status === "closed") return "Cerrada";
  return status;
}

function priorityLabel(priority: string) {
  if (priority === "critical") return "Critica";
  if (priority === "high") return "Alta";
  if (priority === "medium") return "Media";
  if (priority === "low") return "Baja";
  return priority;
}

function extractEmail(from: string) {
  const match = from.match(/<([^>]+)>/);
  return (match?.[1] ?? from).trim();
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function fieldRow(label: string, value?: string | null) {
  if (!value) return "";
  return `
    <tr>
      <td style="padding:8px 12px;color:#64748b;font-size:13px;width:150px;">${escapeHtml(label)}</td>
      <td style="padding:8px 12px;color:#0f172a;font-size:14px;font-weight:600;">${escapeHtml(value)}</td>
    </tr>`;
}

function buildEmailHtml(params: {
  eventLabel: string;
  title: string;
  priority: string;
  status: string;
  asset?: string | null;
  location?: string | null;
  employee?: string | null;
  assignedTo?: string | null;
  description?: string | null;
  appUrl: string;
}) {
  const description = params.description?.trim();
  return `<!doctype html>
<html>
  <body style="margin:0;background:#f6f8fb;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <div style="max-width:680px;margin:0 auto;padding:28px 16px;">
      <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;box-shadow:0 8px 24px rgba(15,23,42,.08);">
        <div style="background:#2563eb;padding:18px 22px;color:#ffffff;">
          <div style="font-size:13px;font-weight:700;opacity:.9;">IT Inventario</div>
          <h1 style="margin:6px 0 0;font-size:22px;line-height:1.25;">${escapeHtml(params.eventLabel)}</h1>
        </div>
        <div style="padding:22px;">
          <h2 style="margin:0 0 14px;font-size:20px;line-height:1.3;color:#111827;">${escapeHtml(params.title)}</h2>
          <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;background:#f8fafc;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">
            ${fieldRow("Prioridad", params.priority)}
            ${fieldRow("Estado", params.status)}
            ${fieldRow("Activo", params.asset)}
            ${fieldRow("Ubicacion", params.location)}
            ${fieldRow("Empleado afectado", params.employee)}
            ${fieldRow("Asignado a", params.assignedTo)}
          </table>
          ${description ? `
          <div style="margin-top:18px;">
            <div style="font-size:13px;color:#64748b;font-weight:700;margin-bottom:8px;">Descripcion</div>
            <div style="white-space:pre-wrap;background:#ffffff;border:1px solid #e5e7eb;border-radius:10px;padding:14px;color:#111827;font-size:14px;line-height:1.5;">${escapeHtml(description)}</div>
          </div>` : ""}
          <div style="margin-top:22px;">
            <a href="${escapeHtml(params.appUrl)}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:11px 16px;border-radius:9px;">Abrir aplicacion</a>
          </div>
          <p style="margin:16px 0 0;color:#94a3b8;font-size:12px;">${escapeHtml(params.appUrl)}</p>
        </div>
      </div>
    </div>
  </body>
</html>`;
}

async function sendWithResend(from: string, to: string[], subject: string, text: string, html: string) {
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  if (!resendApiKey) return { ok: false, status: 400, result: { message: "missing_RESEND_API_KEY" } };

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, text, html }),
  });

  const result = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, result };
}

async function sendWithSendGrid(from: string, to: string[], subject: string, text: string, html: string) {
  const sendGridApiKey = Deno.env.get("SENDGRID_API_KEY");
  if (!sendGridApiKey) return { ok: false, status: 400, result: { message: "missing_SENDGRID_API_KEY" } };

  const senderEmail = extractEmail(from);
  const senderName = from.includes("<") ? from.replace(/<[^>]+>/, "").trim() : "IT Inventario";

  const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${sendGridApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{ to: to.map((email) => ({ email })) }],
      from: { email: senderEmail, name: senderName || "IT Inventario" },
      subject,
      content: [
        { type: "text/plain", value: text },
        { type: "text/html", value: html },
      ],
    }),
  });

  const result = response.status === 202
    ? { id: response.headers.get("x-message-id") ?? `sendgrid-${Date.now()}` }
    : await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, result };
}

async function sendWithBrevo(from: string, to: string[], subject: string, text: string, html: string) {
  const brevoApiKey = Deno.env.get("BREVO_API_KEY");
  if (!brevoApiKey) return { ok: false, status: 400, result: { message: "missing_BREVO_API_KEY" } };

  const senderEmail = extractEmail(from);
  const senderName = from.includes("<") ? from.replace(/<[^>]+>/, "").trim() : "IT Inventario";

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": brevoApiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      sender: { email: senderEmail, name: senderName || "IT Inventario" },
      to: to.map((email) => ({ email })),
      subject,
      textContent: text,
      htmlContent: html,
    }),
  });

  const result = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, result };
}

async function sendWithGoogleAppsScript(from: string, to: string[], subject: string, text: string, html: string) {
  const scriptUrl = Deno.env.get("GOOGLE_SCRIPT_MAIL_URL");
  const scriptSecret = Deno.env.get("GOOGLE_SCRIPT_MAIL_SECRET");
  if (!scriptUrl || !scriptSecret) {
    return { ok: false, status: 400, result: { message: "missing_GOOGLE_SCRIPT_MAIL_URL_or_SECRET" } };
  }

  const response = await fetch(scriptUrl, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({
      secret: scriptSecret,
      fromName: from.includes("<") ? from.replace(/<[^>]+>/, "").trim() : "IT Inventario",
      to,
      subject,
      text,
      html,
    }),
  });

  const result = await response.json().catch(() => ({}));
  return { ok: response.ok && result?.ok !== false, status: response.status, result };
}

async function sendWithMicrosoftGraph(from: string, to: string[], subject: string, text: string, html: string) {
  const tenantId = Deno.env.get("MS_TENANT_ID");
  const clientId = Deno.env.get("MS_CLIENT_ID");
  const clientSecret = Deno.env.get("MS_CLIENT_SECRET");
  const sender = Deno.env.get("MS_SENDER_EMAIL") ?? extractEmail(from);

  if (!tenantId || !clientId || !clientSecret || !sender) {
    return {
      ok: false,
      status: 400,
      result: { message: "missing_MS_TENANT_ID_MS_CLIENT_ID_MS_CLIENT_SECRET_or_sender" },
    };
  }

  const tokenBody = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });

  const tokenResponse = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: tokenBody,
  });
  const tokenResult = await tokenResponse.json().catch(() => ({}));
  if (!tokenResponse.ok) return { ok: false, status: tokenResponse.status, result: tokenResult };

  const response = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sender)}/sendMail`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tokenResult.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: {
        subject,
        body: { contentType: "HTML", content: html },
        toRecipients: to.map((address) => ({ emailAddress: { address } })),
      },
      saveToSentItems: true,
    }),
  });

  const result = response.status === 202 ? { id: `graph-${Date.now()}` } : await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, result };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    const { incident_id, event = "created" } = await req.json();
    if (!incident_id) return json({ error: "incident_id is required" }, 400);

    const [{ data: incident, error: incidentError }, { data: recipients, error: recipientsError }] = await Promise.all([
      supabase
        .from("incidents")
        .select("*, asset:assets(serial_number,brand,model,location)")
        .eq("id", incident_id)
        .maybeSingle(),
      supabase
        .from("incident_notification_recipients")
        .select("email,name")
        .eq("enabled", true),
    ]);

    if (incidentError) throw incidentError;
    if (recipientsError) throw recipientsError;
    if (!incident) return json({ error: "incident_not_found" }, 404);

    let employee: { name?: string; email?: string } | null = null;
    const assignedTo = incident.assigned_to_email
      ? {
        email: incident.assigned_to_email,
        name: incident.assigned_to_name || incident.assigned_to_email,
      }
      : null;
    const [employeeResult] = await Promise.all([
      incident.employee_id
        ? supabase
          .from("employees")
          .select("name,email")
          .eq("id", incident.employee_id)
          .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    employee = employeeResult.data;

    const assignedEmail = assignedTo?.email;
    const to = assignedEmail
      ? [assignedEmail]
      : (recipients ?? []).map((r) => r.email).filter(Boolean);
    const uniqueTo = Array.from(new Set(to));

    if (uniqueTo.length === 0) {
      return json({ sent: false, reason: "no_recipients" });
    }

    const appUrl = Deno.env.get("APP_URL") ?? "https://paco4gn.github.io/Aplicacion_inventario/";
    const from = Deno.env.get("INCIDENT_EMAIL_FROM") ?? "IT Inventario <onboarding@resend.dev>";
    const asset = incident.asset;
    const eventLabel = event === "created" ? "Nueva incidencia" : event === "assigned" ? "Incidencia asignada" : "Incidencia actualizada";
    const priority = priorityLabel(incident.priority);
    const status = statusLabel(incident.status);
    const assetLabel = asset?.serial_number
      ? `${asset.serial_number}${[asset.brand, asset.model].filter(Boolean).length ? ` - ${[asset.brand, asset.model].filter(Boolean).join(" ")}` : ""}`
      : null;
    const subject = `[IT Inventario] ${eventLabel}: ${incident.title}`;
    const details = [
      `Titulo: ${incident.title}`,
      `Prioridad: ${priority}`,
      `Estado: ${status}`,
      assetLabel ? `Activo: ${assetLabel}` : null,
      asset?.location ? `Ubicacion: ${asset.location}` : null,
      employee?.name ? `Empleado afectado: ${employee.name}` : null,
      assignedTo?.name ? `Asignado a: ${assignedTo.name}` : null,
      incident.description ? `Descripcion: ${incident.description}` : null,
      `Abrir aplicacion: ${appUrl}`,
    ].filter(Boolean).join("\n");
    const html = buildEmailHtml({
      eventLabel,
      title: incident.title,
      priority,
      status,
      asset: assetLabel,
      location: asset?.location,
      employee: employee?.name,
      assignedTo: assignedTo?.name,
      description: incident.description,
      appUrl,
    });

    const provider = (Deno.env.get("MAIL_PROVIDER") ?? (Deno.env.get("MS_TENANT_ID") ? "graph" : "resend")).toLowerCase();
    const sendResult = provider === "graph"
      ? await sendWithMicrosoftGraph(from, uniqueTo, subject, details, html)
      : provider === "sendgrid"
        ? await sendWithSendGrid(from, uniqueTo, subject, details, html)
        : provider === "brevo"
          ? await sendWithBrevo(from, uniqueTo, subject, details, html)
          : provider === "google_script"
            ? await sendWithGoogleAppsScript(from, uniqueTo, subject, details, html)
            : await sendWithResend(from, uniqueTo, subject, details, html);

    if (sendResult.status === 400 && typeof sendResult.result === "object" && "message" in sendResult.result) {
      await supabase.from("audit_logs").insert([{
        action: "email_not_configured",
        entity_type: "incident",
        entity_id: incident.id,
        entity_name: incident.title,
        details: { to: uniqueTo, event, provider, error: sendResult.result },
        performed_by: "notify-incident",
      }]);
      return json({ sent: false, reason: sendResult.result.message, provider, to: uniqueTo });
    }

    if (!sendResult.ok) {
      await supabase.from("audit_logs").insert([{
        action: "email_failed",
        entity_type: "incident",
        entity_id: incident.id,
        entity_name: incident.title,
        details: { to: uniqueTo, event, provider, status: sendResult.status, provider_error: sendResult.result },
        performed_by: "notify-incident",
      }]);
      return json({ sent: false, provider, error: sendResult.result }, 502);
    }

    await supabase.from("audit_logs").insert([{
      action: "email_sent",
      entity_type: "incident",
      entity_id: incident.id,
      entity_name: incident.title,
      details: { to: uniqueTo, event, provider, provider_id: sendResult.result.id },
      performed_by: "notify-incident",
    }]);

    return json({ sent: true, provider, to: uniqueTo, provider_id: sendResult.result.id });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
