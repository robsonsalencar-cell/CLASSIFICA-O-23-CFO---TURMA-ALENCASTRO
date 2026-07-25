/**
 * MIGRAÇÃO ÚNICA: Google Sheets -> Supabase
 * ---------------------------------------------------------------
 * Roda LOCALMENTE no seu computador (nunca no navegador/frontend),
 * pois usa a chave service_role, que tem acesso total ao banco.
 *
 * Pré-requisitos:
 *  1) node >= 18
 *  2) npm install @supabase/supabase-js papaparse
 *  3) Um arquivo alunos-emails.csv na mesma pasta, com colunas:
 *       NOME,EMAIL,CPF
 *     (NOME deve bater EXATAMENTE com o nome usado na planilha, em maiúsculas)
 *  4) Rode: node scripts/importar-planilha.mjs
 *
 * Variáveis de ambiente necessárias:
 *   SUPABASE_URL=https://SEU-PROJETO.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY=xxxxx   (em Project Settings > API, NUNCA COMMITAR)
 *   SENHA_PROVISORIA=Trocar@123        (opcional; padrão usado para todos os novos alunos)
 */

import { createClient } from "@supabase/supabase-js";
import Papa from "papaparse";
import fs from "fs";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SENHA_PROVISORIA = process.env.SENHA_PROVISORIA || "Trocar@123";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY como variáveis de ambiente.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const SPREADSHEET_ID = "1tJnMN1BY5oYmNt4Z3Jysfv8E4TSuFtSj";
const ABAS = {
  notas_cfo1: `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=csv&gid=1004161421`,
  notas_cfo2: `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=csv&gid=453878135`,
  notas_cfo3: `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=csv&gid=187280075`,
};

// Colunas que NÃO são matérias (ignoradas ao lançar notas)
const COLUNAS_IGNORADAS = new Set(["RANK", "NOME", "MÉDIA FINAL"]);

function normalizarNumero(valor) {
  if (!valor || String(valor).trim() === "") return null;
  const n = parseFloat(String(valor).replace(",", "."));
  return isNaN(n) ? null : n;
}

async function carregarMapaEmails() {
  const csv = fs.readFileSync(new URL("../alunos-emails.csv", import.meta.url), "utf-8");
  const { data } = Papa.parse(csv, { header: true, skipEmptyLines: true });
  const mapa = new Map();
  for (const row of data) {
    const nome = (row.NOME || "").trim().toUpperCase();
    if (nome) mapa.set(nome, { email: row.EMAIL?.trim(), cpf: row.CPF?.trim() || null });
  }
  return mapa;
}

async function buscarOuCriarAluno(nome, mapaEmails, cacheIds) {
  const chave = nome.trim().toUpperCase();
  if (cacheIds.has(chave)) return cacheIds.get(chave);

  const info = mapaEmails.get(chave);
  if (!info?.email) {
    console.warn(`⚠️  Sem e-mail cadastrado para "${nome}" em alunos-emails.csv — pulando.`);
    return null;
  }

  // já existe?
  const { data: existente } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", info.email)
    .maybeSingle();

  if (existente) {
    cacheIds.set(chave, existente.id);
    return existente.id;
  }

  // cria o usuário (auth + profile via trigger)
  const { data: criado, error } = await supabase.auth.admin.createUser({
    email: info.email,
    password: SENHA_PROVISORIA,
    email_confirm: true,
    user_metadata: { nome_completo: nome, cpf: info.cpf, role: "aluno" },
  });

  if (error) {
    console.error(`Erro ao criar usuário para ${nome} (${info.email}):`, error.message);
    return null;
  }

  cacheIds.set(chave, criado.user.id);
  return criado.user.id;
}

async function importarModulo(tabela, url, mapaEmails, cacheIds) {
  console.log(`\n📥 Importando ${tabela}...`);
  const resposta = await fetch(url);
  const textoCsv = await resposta.text();
  const { data } = Papa.parse(textoCsv, { header: true, skipEmptyLines: true });

  let totalNotas = 0;

  for (const linha of data) {
    const nome = (linha["NOME"] || "").trim();
    if (!nome) continue;

    const alunoId = await buscarOuCriarAluno(nome, mapaEmails, cacheIds);
    if (!alunoId) continue;

    const upserts = [];
    for (const [coluna, valor] of Object.entries(linha)) {
      if (COLUNAS_IGNORADAS.has(coluna)) continue;
      const nota = normalizarNumero(valor);
      if (nota === null) continue;
      upserts.push({
        aluno_id: alunoId,
        materia: coluna.trim(),
        nota_final: nota,
        updated_at: new Date().toISOString(),
      });
    }

    if (upserts.length > 0) {
      const { error } = await supabase
        .from(tabela)
        .upsert(upserts, { onConflict: "aluno_id,materia" });
      if (error) {
        console.error(`Erro ao importar notas de ${nome} em ${tabela}:`, error.message);
      } else {
        totalNotas += upserts.length;
      }
    }
  }

  console.log(`✅ ${tabela}: ${totalNotas} notas importadas.`);
}

async function main() {
  const mapaEmails = await carregarMapaEmails();
  const cacheIds = new Map();

  for (const [tabela, url] of Object.entries(ABAS)) {
    await importarModulo(tabela, url, mapaEmails, cacheIds);
  }

  console.log("\n🎉 Migração concluída. Lembre-se de:");
  console.log("  1) Avisar os alunos da senha provisória para o primeiro acesso.");
  console.log("  2) Tornar seu usuário admin: update profiles set role='admin' where email='...'");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
