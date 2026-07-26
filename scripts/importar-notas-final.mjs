/**
 * IMPORTAÇÃO FINAL DE NOTAS — preserva os valores exatamente como estão na
 * planilha "CLASSIFICAÇÃO_23_CFO_NOVA_FORMULA.xlsx". Não recalcula nada que
 * já esteja pronto na planilha (colunas sem sufixo VC/VF = nota final direta).
 * Só calcula a nota final por conta própria quando a matéria tem VC/VF
 * separados na planilha (média simples VC x VF — ajuste calcularNotaFinalMulti
 * em src/config/formulaNotas.ts se a fórmula oficial for outra).
 *
 * Pré-requisitos:
 *   npm install @supabase/supabase-js xlsx
 *
 * Como rodar:
 *   set SUPABASE_URL=https://SEU-PROJETO.supabase.co
 *   set SUPABASE_SERVICE_ROLE_KEY=xxxxx
 *   node importar-notas-final.mjs
 *
 * Coloque "CLASSIFICAÇÃO_23_CFO_NOVA_FORMULA.xlsx" na mesma pasta deste script.
 */

import { createClient } from "@supabase/supabase-js";
import XLSX from "xlsx";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ARQUIVO_XLSX = path.join(__dirname, "CLASSIFICAÇÃO_23_CFO_NOVA_FORMULA.xlsx");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY antes de rodar.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// Nomes que aparecem com grafia um pouco diferente na planilha de notas vs.
// a matriz curricular oficial — mapeados aqui para o nome OFICIAL (o mesmo
// usado em src/config/materiasCfoX.ts), sem alterar nenhum valor de nota.
const ALIASES = {
  "ARMAMENTO MUNIÇÃO E EXPLOSIVO": "Armamento de Fogo, Munição e Explosivos",
  "Comunicação Operacional": "Comunicação Operacional/Telecomunicações",
  "DEFESA TERRITORIAL": "Defesa Territorial I", // só existe no CFO1
  "Criminalistica": "Criminalística",
  "Seminário de Trabalho Científico-Workshop": "Seminário de Trabalho Científico-Workshop de Banca de Defesa do TCC",
  "ORDEM UNIDA": "Cultura e Cotidiano Policial Militar", // confirmado pelo usuário: é a mesma disciplina
};

// (nenhuma matéria fora da matriz oficial restante — "ORDEM UNIDA" foi
// esclarecida e mapeada acima)
const MATERIAS_NAO_OFICIAIS = new Set([]);

const MODULOS = [
  { aba: "CLASSIFICAÇÃO CFO 1", tabela: "notas_cfo1" },
  { aba: "CLASSIFICAÇÃO CFO 2", tabela: "notas_cfo2" },
  { aba: "CLASSIFICAÇÃO CFO 3", tabela: "notas_cfo3" },
];

const COLUNAS_IGNORADAS = new Set(["ORDEM", "NOME", "MÉDIA FINAL", "STATUS (LANÇAMENTO COMPLETO?)", ""]);

function normalizarNome(nome) {
  return String(nome || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

function paraNumero(valor) {
  if (valor === null || valor === undefined || valor === "") return null;
  const n = typeof valor === "number" ? valor : parseFloat(String(valor).replace(",", "."));
  return isNaN(n) ? null : n;
}

// Classifica uma coluna: { base, tipo: 'bare' | 'vc' | 'vf' }
function classificarColuna(header) {
  const h = String(header).trim().replace(/\s+/g, " ");
  const semSufixo = h.replace(/\s*(VC\s*\d*|VF\d*)\s*$/i, "").trim();

  if (semSufixo === h) {
    return { base: h, tipo: "bare" };
  }
  if (/VF\d*\s*$/i.test(h)) {
    return { base: semSufixo, tipo: "vf" };
  }
  return { base: semSufixo, tipo: "vc" };
}

function nomeOficial(base) {
  return ALIASES[base] ?? base;
}

async function carregarMapaAlunos() {
  const mapa = new Map();
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase.from("profiles").select("id, nome_completo").range(from, from + pageSize - 1);
    if (error) throw error;
    for (const p of data) mapa.set(normalizarNome(p.nome_completo), p.id);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  console.log(`👥 ${mapa.size} perfis carregados do Supabase.`);
  return mapa;
}

async function importarModulo(workbook, aba, tabela, mapaAlunos) {
  console.log(`\n📊 Importando ${aba} -> ${tabela}...`);
  const ws = workbook.Sheets[aba];
  const linhas = XLSX.utils.sheet_to_json(ws, { header: 1, range: 2 });
  const header = linhas[0];
  const dados = linhas.slice(1);

  const classificacoes = header.map((h) => (h ? classificarColuna(h) : null));

  let totalUpserts = 0;
  const naoOficiaisEncontradas = new Set();
  const semAluno = new Set();

  for (const linha of dados) {
    const nome = linha[1]; // coluna NOME
    if (!nome) continue;

    const alunoId = mapaAlunos.get(normalizarNome(nome));
    if (!alunoId) {
      semAluno.add(nome);
      continue;
    }

    // agrupa por matéria (nome oficial)
    const porMateria = new Map(); // materiaOficial -> { bare, vcs: [], vf }

    for (let col = 2; col < header.length; col++) {
      const h = header[col];
      if (!h || COLUNAS_IGNORADAS.has(String(h).trim().toUpperCase())) continue;

      const classe = classificacoes[col];
      if (!classe) continue;

      const valor = paraNumero(linha[col]);
      if (valor === null) continue;

      const oficial = nomeOficial(classe.base);
      if (MATERIAS_NAO_OFICIAIS.has(classe.base.toUpperCase())) {
        naoOficiaisEncontradas.add(classe.base);
      }

      if (!porMateria.has(oficial)) porMateria.set(oficial, { bare: null, vcs: [], vf: null });
      const entrada = porMateria.get(oficial);

      if (classe.tipo === "bare") entrada.bare = valor;
      else if (classe.tipo === "vf") entrada.vf = valor;
      else entrada.vcs.push(valor);
    }

    const upserts = [];
    for (const [materia, { bare, vcs, vf }] of porMateria.entries()) {
      let nota_final, vc_lista, vfFinal;

      if (bare !== null) {
        // Coluna única já pronta na planilha — usada exatamente como está,
        // sem recalcular nada.
        nota_final = bare;
        vc_lista = [];
        vfFinal = null;
      } else {
        // VC(s) + VF separados — nota final = média(VCs) combinada com VF
        // (fórmula em src/config/formulaNotas.ts).
        const vcMedia = vcs.length > 0 ? vcs.reduce((a, b) => a + b, 0) / vcs.length : null;
        nota_final =
          vcMedia !== null && vf !== null ? Number(((vcMedia + vf) / 2).toFixed(4)) : vcMedia ?? vf;
        vc_lista = vcs;
        vfFinal = vf;
      }

      upserts.push({
        aluno_id: alunoId,
        materia,
        vc_lista,
        vf: vfFinal,
        nota_final,
        updated_at: new Date().toISOString(),
      });
    }

    if (upserts.length > 0) {
      const { error } = await supabase.from(tabela).upsert(upserts, { onConflict: "aluno_id,materia" });
      if (error) {
        console.error(`  ❌ Erro ao salvar notas de ${nome}:`, error.message);
      } else {
        totalUpserts += upserts.length;
      }
    }
  }

  console.log(`✅ ${tabela}: ${totalUpserts} lançamentos gravados.`);
  if (semAluno.size > 0) {
    console.log(`  ⚠️  Alunos não encontrados no Supabase (${semAluno.size}):`, [...semAluno].join(", "));
  }
  if (naoOficiaisEncontradas.size > 0) {
    console.log(
      `  ⚠️  Matérias fora da matriz curricular oficial (importadas mesmo assim, com o nome original):`,
      [...naoOficiaisEncontradas].join(", ")
    );
  }
}

async function main() {
  console.log("🚀 Lendo planilha...");
  const workbook = XLSX.readFile(ARQUIVO_XLSX);
  const mapaAlunos = await carregarMapaAlunos();

  for (const { aba, tabela } of MODULOS) {
    await importarModulo(workbook, aba, tabela, mapaAlunos);
  }

  console.log("\n🎉 Importação concluída. Confira os avisos acima (se houver) antes de considerar 100% ok.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
