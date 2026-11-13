// Configuração do Supabase — preencha com os dados do SEU projeto (passo 3 do LEIA-ME).
// A "publishable key" (ou "anon key") pode ficar pública no site: quem protege os dados
// são as regras de segurança criadas pelo arquivo supabase.sql.
// NUNCA coloque aqui a "secret key" nem a "service_role key".
window.OSSO_CONFIG = {
  SUPABASE_URL: "https://chskjmsmqvwpkyppbrrx.supabase.co",        // ex.: https://abcdefghijk.supabase.co
  SUPABASE_KEY: "sb_publishable_xPjh7vh6WZ1UpGDDT7sR6A_jT0jRUgs",    // ex.: sb_publishable_... (ou a anon key)

  // Links de pagamento da Kiwify (produto "Osso a Osso Pro").
  // Com os dois preenchidos, o app passa a bloquear o conteúdo Pro para quem não assinou.
  // Para desligar o bloqueio, deixe os dois vazios ("").
  KIWIFY_MENSAL: "https://pay.kiwify.com.br/e84LalF",
  KIWIFY_ANUAL: "https://pay.kiwify.com.br/75qBJeq"
};
