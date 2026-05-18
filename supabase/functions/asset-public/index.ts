import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, PUT, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const TECH_PIN = "1234";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    const url = new URL(req.url);
    const serial = url.searchParams.get("serial");

    // ── GET: fetch asset data ──────────────────────────────────────────────
    if (req.method === "GET") {
      if (!serial) return json({ error: "serial is required" }, 400);

      const { data: asset, error } = await supabase
        .from("assets")
        .select("id, serial_number, name, asset_type, brand, model, status, location, purchase_date, purchase_value, warranty_expiry, end_of_life, notes, image_url")
        .eq("serial_number", serial)
        .maybeSingle();

      if (error) throw error;
      if (!asset) return json({ error: "not_found" }, 404);

      const [{ data: assignment }, { count: openIncidents }, { data: recentIncidents }, { data: employees }] = await Promise.all([
        supabase
          .from("asset_assignments")
          .select("assigned_at, notes, employee:employees(id, name, department, position, email)")
          .eq("asset_id", asset.id)
          .is("returned_at", null)
          .maybeSingle(),
        supabase
          .from("incidents")
          .select("id", { count: "exact", head: true })
          .eq("asset_id", asset.id)
          .neq("status", "closed"),
        supabase
          .from("incidents")
          .select("id, title, status, priority, opened_at")
          .eq("asset_id", asset.id)
          .order("opened_at", { ascending: false })
          .limit(5),
        supabase
          .from("employees")
          .select("id, name, department, position")
          .eq("active", true)
          .order("name"),
      ]);

      return json({
        asset,
        assignment: assignment ?? null,
        openIncidents: openIncidents ?? 0,
        recentIncidents: recentIncidents ?? [],
        employees: employees ?? [],
      });
    }

    // ── POST: report a new incident ────────────────────────────────────────
    if (req.method === "POST") {
      if (!serial) return json({ error: "serial is required" }, 400);

      const body = await req.json();
      const { title, description, priority = "medium" } = body;

      if (!title?.trim()) return json({ error: "title is required" }, 400);

      const { data: asset } = await supabase
        .from("assets")
        .select("id, serial_number")
        .eq("serial_number", serial)
        .maybeSingle();

      if (!asset) return json({ error: "not_found" }, 404);

      const { data: incident, error: incErr } = await supabase
        .from("incidents")
        .insert([{
          asset_id: asset.id,
          title: title.trim(),
          description: description?.trim() ?? "",
          priority,
          status: "open",
          opened_at: new Date().toISOString(),
        }])
        .select("id")
        .maybeSingle();

      if (incErr) throw incErr;

      await supabase.from("audit_logs").insert([{
        action: "reported_incident",
        entity_type: "asset",
        entity_id: asset.id,
        entity_name: asset.serial_number,
        details: { title, priority, source: "public_qr" },
        performed_by: "public",
      }]);

      try {
        await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/notify-incident`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ incident_id: incident?.id, event: "created" }),
        });
      } catch (_) {
        // Best-effort notification. Public reporting should still succeed.
      }

      return json({ success: true, incident_id: incident?.id });
    }

    // ── PATCH: update location (public, no PIN) ────────────────────────────
    if (req.method === "PATCH") {
      if (!serial) return json({ error: "serial is required" }, 400);

      const body = await req.json();
      const { location } = body;

      if (!location?.trim()) return json({ error: "location is required" }, 400);

      const { data: asset } = await supabase
        .from("assets")
        .select("id, serial_number")
        .eq("serial_number", serial)
        .maybeSingle();

      if (!asset) return json({ error: "not_found" }, 404);

      await supabase
        .from("assets")
        .update({ location: location.trim(), updated_at: new Date().toISOString() })
        .eq("id", asset.id);

      await supabase.from("audit_logs").insert([{
        action: "updated_location",
        entity_type: "asset",
        entity_id: asset.id,
        entity_name: asset.serial_number,
        details: { new_location: location.trim(), source: "public_qr" },
        performed_by: "public",
      }]);

      return json({ success: true });
    }

    // ── PUT: tech panel update (PIN protected) ─────────────────────────────
    if (req.method === "PUT") {
      if (!serial) return json({ error: "serial is required" }, 400);

      const body = await req.json();
      const { pin, status, location, notes, employee_id } = body;

      if (pin !== TECH_PIN) return json({ error: "invalid_pin" }, 403);

      const { data: asset } = await supabase
        .from("assets")
        .select("id, serial_number")
        .eq("serial_number", serial)
        .maybeSingle();

      if (!asset) return json({ error: "not_found" }, 404);

      // Build asset update payload with only provided fields
      const assetUpdate: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (status !== undefined) assetUpdate.status = status;
      if (location !== undefined) assetUpdate.location = location;
      if (notes !== undefined) assetUpdate.notes = notes;

      await supabase.from("assets").update(assetUpdate).eq("id", asset.id);

      // Handle employee assignment change
      if (employee_id !== undefined) {
        // Close current open assignment
        await supabase
          .from("asset_assignments")
          .update({ returned_at: new Date().toISOString() })
          .eq("asset_id", asset.id)
          .is("returned_at", null);

        // Create new assignment if employee selected
        if (employee_id !== null && employee_id !== "") {
          await supabase.from("asset_assignments").insert([{
            asset_id: asset.id,
            employee_id,
            assigned_at: new Date().toISOString(),
            notes: "Asignado desde panel técnico (QR)",
          }]);
        }
      }

      await supabase.from("audit_logs").insert([{
        action: "tech_update",
        entity_type: "asset",
        entity_id: asset.id,
        entity_name: asset.serial_number,
        details: { status, location, notes, employee_id, source: "tech_pin_qr" },
        performed_by: "tech_pin",
      }]);

      return json({ success: true });
    }

    return json({ error: "method not allowed" }, 405);

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
