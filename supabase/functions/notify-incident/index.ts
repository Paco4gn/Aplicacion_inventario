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
  if (status === "in_progress") return "En progreso";
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

    let assignedTo: { name?: string; email?: string } | null = null;
    let employee: { name?: string; email?: string } | null = null;
    const [assignedResult, employeeResult] = await Promise.all([
      incident.assigned_to_id
        ? supabase
          .from("employees")
          .select("name,email")
          .eq("id", incident.assigned_to_id)
          .maybeSingle()
        : Promise.resolve({ data: null }),
      incident.employee_id
        ? supabase
          .from("employees")
          .select("name,email")
          .eq("id", incident.employee_id)
          .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    assignedTo = assignedResult.data;
    employee = employeeResult.data;

    const to = Array.from(new Set((recipients ?? []).map((r) => r.email).filter(Boolean)));
    const assignedEmail = assignedTo?.email;
    if (assignedEmail) to.push(assignedEmail);
    const uniqueTo = Array.from(new Set(to));

    if (uniqueTo.length === 0) {
      return json({ sent: false, reason: "no_recipients" });
    }

    const appUrl = Deno.env.get("APP_URL") ?? "https://paco4gn.github.io/Aplicacion_inventario/";
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const from = Deno.env.get("INCIDENT_EMAIL_FROM") ?? "IT Inventario <onboarding@resend.dev>";
    const asset = incident.asset;
    const eventLabel = event === "created" ? "Nueva incidencia" : event === "assigned" ? "Incidencia asignada" : "Incidencia actualizada";
    const subject = `[IT Inventario] ${eventLabel}: ${incident.title}`;
    const details = [
      `Titulo: ${incident.title}`,
      `Prioridad: ${priorityLabel(incident.priority)}`,
      `Estado: ${statusLabel(incident.status)}`,
      asset?.serial_number ? `Activo: ${asset.serial_number} - ${[asset.brand, asset.model].filter(Boolean).join(" ")}` : null,
      asset?.location ? `Ubicacion: ${asset.location}` : null,
      employee?.name ? `Empleado afectado: ${employee.name}` : null,
      assignedTo?.name ? `Responsable: ${assignedTo.name}` : null,
      incident.description ? `Descripcion: ${incident.description}` : null,
      `Abrir aplicacion: ${appUrl}`,
    ].filter(Boolean).join("\n");

    if (!resendApiKey) {
      await supabase.from("audit_logs").insert([{
        action: "email_not_configured",
        entity_type: "incident",
        entity_id: incident.id,
        entity_name: incident.title,
        details: { to: uniqueTo, event },
        performed_by: "notify-incident",
      }]);
      return json({ sent: false, reason: "missing_RESEND_API_KEY", to: uniqueTo });
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: uniqueTo,
        subject,
        text: details,
      }),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      return json({ sent: false, error: result }, 502);
    }

    await supabase.from("audit_logs").insert([{
      action: "email_sent",
      entity_type: "incident",
      entity_id: incident.id,
      entity_name: incident.title,
      details: { to: uniqueTo, event, provider_id: result.id },
      performed_by: "notify-incident",
    }]);

    return json({ sent: true, to: uniqueTo, provider_id: result.id });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
