// Importa as ferramentas necessárias do Deno (ambiente onde as Edge Functions rodam)
// e do Supabase para interagir com o banco de dados.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// FIX: Declare Deno to resolve TypeScript errors in environments without Deno types.
declare const Deno: any;

// Define a interface para as configurações de prazo para garantir a tipagem do código.
interface SalespersonSettings {
  deadlines: {
    initial_contact: {
      minutes: number;
      auto_reassign_enabled: boolean;
      reassignment_mode: "random" | "specific";
      reassignment_target_id: string | null;
    };
  };
}

// A função principal que será executada quando a Edge Function for chamada.
serve(async (req) => {
  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SERVICE_ROLE_KEY") ?? ""
    );

    // 1. Busca todas as empresas para ter acesso ao pipeline_stages de cada uma.
    const { data: companies, error: companiesError } = await supabaseAdmin
      .from("companies")
      .select("id, pipeline_stages");

    if (companiesError) throw companiesError;
    
    const companyStageMap = new Map(companies.map(c => [c.id, c.pipeline_stages]));

    // 2. Busca todos os vendedores com suas configurações individuais.
    const { data: salespeople, error: salespeopleError } = await supabaseAdmin
        .from("team_members")
        .select("id, company_id, prospect_ai_settings")
        .eq("role", "Vendedor");
    
    if(salespeopleError) throw salespeopleError;

    // 3. Filtra apenas os vendedores que têm a função de remanejamento habilitada.
    const enabledSalespeople = salespeople.filter(sp =>
        sp.prospect_ai_settings?.deadlines?.initial_contact?.auto_reassign_enabled === true
    );

    let totalLeadsReassigned = 0;

    // 4. Itera sobre cada vendedor habilitado para verificar seus leads.
    for (const salesperson of enabledSalespeople) {
      const settings: SalespersonSettings = salesperson.prospect_ai_settings;
      const deadlineMinutes = settings.deadlines.initial_contact.minutes;
      
      const companyStages = companyStageMap.get(salesperson.company_id);
      // FIX: Added Array.isArray check to ensure companyStages is an array and to satisfy TypeScript.
      if (!Array.isArray(companyStages)) continue;

      const novosLeadsStage = companyStages.find(
        (stage: any) => stage.name === "Novos Leads"
      );

      if (!novosLeadsStage) continue;

      const timeLimit = new Date(Date.now() - deadlineMinutes * 60 * 1000).toISOString();

      // 5. Busca os leads que pertencem a ESTE vendedor e que ultrapassaram o prazo.
      const { data: overdueLeads, error: leadsError } = await supabaseAdmin
        .from("prospectai")
        .select("id, salesperson_id, details")
        .eq("salesperson_id", salesperson.id) // Apenas leads deste vendedor
        .eq("stage_id", novosLeadsStage.id)
        .lt("created_at", timeLimit);
      
      if (leadsError) {
        console.error(`Error fetching overdue leads for salesperson ${salesperson.id}:`, leadsError);
        continue;
      }
      
      if (overdueLeads.length === 0) continue;

      // 6. Busca todos os OUTROS vendedores da mesma empresa para o remanejamento.
      const { data: allOtherSalespeople, error: otherSalespeopleError } = await supabaseAdmin
        .from("team_members")
        .select("id")
        .eq("company_id", salesperson.company_id)
        .eq("role", "Vendedor")
        .neq("id", salesperson.id); // Exclui o vendedor atual

      if (otherSalespeopleError || !allOtherSalespeople || allOtherSalespeople.length === 0) {
        console.error(`No other salespeople to reassign to for company ${salesperson.company_id}`);
        continue;
      }

      // 7. Itera sobre cada lead atrasado para executar o remanejamento.
      for (const lead of overdueLeads) {
        let newSalespersonId: string | null = null;
        
        if (settings.deadlines.initial_contact.reassignment_mode === "specific") {
            newSalespersonId = settings.deadlines.initial_contact.reassignment_target_id;
        } else { // "random"
            const randomIndex = Math.floor(Math.random() * allOtherSalespeople.length);
            newSalespersonId = allOtherSalespeople[randomIndex].id;
        }

        if (!newSalespersonId || newSalespersonId === lead.salesperson_id) continue;

        const newDetails = {
            ...(lead.details || {}),
            reassigned_by_system: true,
            reassigned_from: lead.salesperson_id,
            reassigned_to: newSalespersonId,
            reassigned_at: new Date().toISOString(),
            reason: "Lead not prospected within the time limit.",
        };

        // 8. Atualiza o lead no banco de dados.
        const { error: updateError } = await supabaseAdmin
          .from("prospectai")
          .update({ salesperson_id: newSalespersonId, details: newDetails })
          .eq("id", lead.id);

        if (updateError) {
            console.error(`Error reassigning lead ${lead.id}:`, updateError);
        } else {
            totalLeadsReassigned++;
        }
      }
    }

    return new Response(
      JSON.stringify({ message: `Verification complete. Reassigned ${totalLeadsReassigned} leads.` }),
      { headers: { "Content-Type": "application/json" }, status: 200 }
    );
  } catch (err) {
    return new Response(String(err?.message ?? err), { status: 500 });
  }
});
