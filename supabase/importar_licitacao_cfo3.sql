-- ============================================================
-- Importa "Licitação de Contrato e Aquisição" (CFO III) — dados extraídos
-- do PDF "LCA - TC FABIABO 45H - notas.pdf". Todos têm VC1=10 (só uma VC);
-- 2 alunos sem nota lançada (Angelo Marcio, Lavínia) são ignorados.
-- ============================================================
do $$
declare
  v_materia text := 'Licitação de Contrato e Aquisição';
  v_aluno_id uuid;
  v_dados text[][] := array[
    array['Aline Aparecida Rosa', '6.25'],
    array['Andre Baroni Oliveira', '7'],
    array['Bruna Laís Evangelista Da Silva Ribeiro', '7'],
    array['Caisson Grazianni Albuquerque Guimarães', '8.75'],
    array['Delvi Péricles Souza Gomes Júnior', '7.25'],
    array['Diego Cesar Barbosa Araujo', '8.75'],
    array['Edson Garcia Moreira Da Silva', '8'],
    array['Eduardo Roberto Lopes Filho', '8.75'],
    array['Fellipe Rafael Santos De Souza', '7'],
    array['Gernaian Rodrigues Da Silva', '8.75'],
    array['Gideoni Pereira Da Silva', '7'],
    array['Gracielle De Siqueira Carvalho', '4.5'],
    array['Jamile Rober Dos Santos Fleury Ferreira', '7.5'],
    array['Jhonathan Antunes Pauluk', '7.5'],
    array['Joilson Santos De Moraes', '8.75'],
    array['Juliano Do Val Petry Freitas', '7.25'],
    array['Juliano Jacinto Caminha', '6'],
    array['Lauriane Simonini', '8.5'],
    array['Lucas Carvalho Silva', '6.75'],
    array['Luiz Henrique Ackermann', '8.75'],
    array['Moyses Ferreira De Carvalho', '5.75'],
    array['Odezio Borge De Carvalho', '7.5'],
    array['Petrus Andrey Guimarães Garcia', '7'],
    array['Publio Ferreira Moreno', '8.25'],
    array['Raphael Rocha Xavier', '7.5'],
    array['Robson Dos Santos Alencar', '7.25'],
    array['Vinicius Antônio Oliveira Da Silva', '8.25'],
    array['Wender Da Silva Figueiredo', '7']
  ];
  v_nao_encontrados text := '';
begin
  for i in 1..array_length(v_dados, 1) loop
    select id into v_aluno_id from public.profiles
    where lower(trim(nome_completo)) = lower(trim(v_dados[i][1])) limit 1;

    if v_aluno_id is null then
      v_nao_encontrados := v_nao_encontrados || v_dados[i][1] || '; ';
    else
      insert into public.notas_cfo3 (aluno_id, materia, vc_lista, vf, nota_final, updated_at)
      values (
        v_aluno_id, v_materia, array[10]::numeric[], v_dados[i][2]::numeric,
        round((10*2 + v_dados[i][2]::numeric*3)/5, 4), now()
      )
      on conflict (aluno_id, materia) do update
        set vc_lista = excluded.vc_lista, vf = excluded.vf,
            nota_final = excluded.nota_final, updated_at = now();
    end if;
  end loop;

  if v_nao_encontrados <> '' then
    raise notice 'Não encontrados: %', v_nao_encontrados;
  else
    raise notice 'Todos os alunos foram encontrados e as notas foram gravadas.';
  end if;
end $$;
