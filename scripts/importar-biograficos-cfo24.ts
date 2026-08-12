// Script avulso — roda 1x via `npx tsx scripts/importar-biograficos-cfo24.ts`.
// Não faz parte do build da aplicação.
//
// HISTÓRICO: a versão original deste script só fazia UPDATE de dados
// biográficos em alunos já cadastrados. Na execução real (11/08/2026) foi
// descoberto que os 67 cadetes do 24º CFO ainda não tinham conta nenhuma no
// sistema (turma "24° CFO" existia, mas com 0 profiles) — então o script
// também passou a CRIAR a conta (auth + profile) de cada cadete, usando a
// Auth Admin API (equivalente ao que a Edge Function admin-create-user faz),
// e só then preencher matrícula + dados biográficos. Essa execução real foi
// feita via script Python avulso (sem passar pelo build do projeto, por
// falta de acesso de rede pro `npm install tsx` no ambiente da sessão) —
// este arquivo TS é a versão documentada/reprodutível equivalente, para
// planilhas futuras (ex: RG PM e escola anterior, quando o usuário enviar).
//
// Resultado da execução real: 64 contas criadas, 3 cadetes pulados por não
// terem e-mail na planilha (Luan Victor de Paula Nascimento Fernandes, João
// Gonçalves Queiroz Neto, Naara Kássia Matos Belém — precisam de e-mail
// antes de conseguir conta). As senhas provisórias geradas foram salvas em
// `DASHBORD/credenciais_24_cfo.csv` (fora do repo, não versionado) para o
// usuário distribuir aos alunos.
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const CAMINHO_PLANILHA = process.env.CAMINHO_PLANILHA ?? "DASHBORD/Planilha dados cfo 24 .xlsx";
const TURMA_ID = process.env.TURMA_24_ID!; // id da turma "24° CFO" em public.turmas

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !TURMA_ID) {
  console.error("Defina SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY e TURMA_24_ID no ambiente antes de rodar.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface LinhaPlanilha {
  nomeCompleto: string;
  matricula: string | null;
  cpf: string | null;
  email: string | null;
  naturalidade: string | null;
  dataNascimento: string | null; // ISO yyyy-mm-dd
  pai: string | null;
  mae: string | null;
}

function primeiroEmail(valor: unknown): string | null {
  if (!valor) return null;
  const texto = String(valor).trim();
  if (!texto) return null;
  // às vezes a célula tem 2 emails separados por espaço (ou espaço digitado
  // por engano no meio de 1 email — conferir manualmente se o e-mail
  // resultante não bater com o padrão de e-mail esperado).
  return texto.split(/\s+/)[0].toLowerCase();
}

function lerPlanilha(): LinhaPlanilha[] {
  const wb = XLSX.readFile(CAMINHO_PLANILHA);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const linhas: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false });
  const resultado: LinhaPlanilha[] = [];
  // Linha 0 = título mesclado, linha 1 = cabeçalho, dados a partir do índice 2.
  for (let i = 2; i < linhas.length; i++) {
    const linha = linhas[i];
    const nomeCompleto = linha[2] != null ? String(linha[2]).trim() : "";
    if (!nomeCompleto) continue; // linha vazia (fim da planilha)
    let matricula = linha[3] != null ? String(linha[3]).trim() : null;
    if (matricula?.endsWith(".0")) matricula = matricula.slice(0, -2);
    resultado.push({
      nomeCompleto,
      matricula: matricula || null,
      cpf: linha[5] != null ? String(linha[5]).trim() : null,
      email: primeiroEmail(linha[7]),
      naturalidade: linha[8] != null ? String(linha[8]).trim() : null,
      dataNascimento: linha[9] ? new Date(linha[9] as string).toISOString().slice(0, 10) : null,
      pai: linha[11] != null ? String(linha[11]).trim() : null,
      mae: linha[12] != null ? String(linha[12]).trim() : null,
    });
  }
  return resultado;
}

function gerarSenhaProvisoria(): string {
  // Mesmo padrão do painel (AdminUsersPanel.tsx, gerarSenhaProvisoria).
  const base = Math.random().toString(36).slice(-8);
  return `${base}A1!`;
}

async function main() {
  const linhas = lerPlanilha();
  console.log(`Lidas ${linhas.length} linhas da planilha.`);

  const criados: { nome: string; email: string; matricula: string | null; senha: string }[] = [];
  const pulados: { nome: string; motivo: string }[] = [];
  const erros: { nome: string; erro: string }[] = [];

  for (const linha of linhas) {
    // Já tem conta? (matrícula ou CPF já cadastrados) — atualiza só os dados
    // biográficos em vez de criar de novo.
    let alunoId: string | null = null;
    if (linha.matricula) {
      const { data } = await supabase.from("profiles").select("id").eq("matricula", linha.matricula).maybeSingle();
      alunoId = data?.id ?? null;
    }
    if (!alunoId && linha.cpf) {
      const { data } = await supabase.from("profiles").select("id").eq("cpf", linha.cpf).maybeSingle();
      alunoId = data?.id ?? null;
    }

    if (alunoId) {
      const { error } = await supabase
        .from("profiles")
        .update({
          naturalidade: linha.naturalidade,
          data_nascimento: linha.dataNascimento,
          filiacao_pai: linha.pai,
          filiacao_mae: linha.mae,
        })
        .eq("id", alunoId);
      if (error) erros.push({ nome: linha.nomeCompleto, erro: error.message });
      continue;
    }

    // Não achou — precisa criar a conta do zero.
    if (!linha.email) {
      pulados.push({ nome: linha.nomeCompleto, motivo: "sem e-mail na planilha" });
      continue;
    }

    const senha = gerarSenhaProvisoria();
    const { data: criado, error: createError } = await supabase.auth.admin.createUser({
      email: linha.email,
      password: senha,
      email_confirm: true,
      user_metadata: {
        nome_completo: linha.nomeCompleto,
        cpf: linha.cpf,
        role: "aluno",
        turma_id: TURMA_ID,
      },
    });
    if (createError || !criado.user) {
      erros.push({ nome: linha.nomeCompleto, erro: createError?.message ?? "criação falhou sem detalhe" });
      continue;
    }

    // O profile é criado automaticamente pelo trigger on_auth_user_created —
    // falta gravar matrícula + dados biográficos, que o trigger não conhece.
    const { error: patchError } = await supabase
      .from("profiles")
      .update({
        matricula: linha.matricula,
        naturalidade: linha.naturalidade,
        data_nascimento: linha.dataNascimento,
        filiacao_pai: linha.pai,
        filiacao_mae: linha.mae,
      })
      .eq("id", criado.user.id);
    if (patchError) {
      erros.push({ nome: linha.nomeCompleto, erro: `conta criada mas patch de dados falhou: ${patchError.message}` });
      continue;
    }

    criados.push({ nome: linha.nomeCompleto, email: linha.email, matricula: linha.matricula, senha });
  }

  console.log(`Contas novas criadas: ${criados.length}`);
  console.log(`Pulados (sem e-mail): ${pulados.length}`);
  console.log(`Erros: ${erros.length}`);
  pulados.forEach((p) => console.warn("PULADO:", p));
  erros.forEach((e) => console.error("ERRO:", e));

  if (criados.length > 0) {
    console.log("\nCredenciais provisórias (guarde num lugar seguro, não versionar):");
    criados.forEach((c) => console.log(`${c.nome};${c.email};${c.matricula ?? ""};${c.senha}`));
  }
}

main();
