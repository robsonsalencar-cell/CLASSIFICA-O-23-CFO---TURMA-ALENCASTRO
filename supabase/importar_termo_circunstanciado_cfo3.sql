-- ============================================================
-- Importa "Termo Circunstanciado de Ocorrência" (CFO III) — dados extraídos
-- do PDF "DIÁRIO_TCO.pdf". Só tem VF (sem VC). Angelo Marcio não entra
-- (tinha "-" no diário, confirma que ele não participou desta matéria).
-- ============================================================
do $$
declare
  v_materia text := 'Termo Circunstanciado de Ocorrência';
  v_aluno_id uuid;
  v_nao_encontrados text := '';
  v_dados text[][] := array[
    array['Aline Aparecida Rosa', '10'],
    array['Andre Baroni Oliveira', '7.4'],
    array['Bruna Laís Evangelista Da Silva Ribeiro', '10'],
    array['Caisson Grazianni Albuquerque Guimarães', '7.7'],
    array['Delvi Péricles Souza Gomes Júnior', '6.7'],
    array['Diego Cesar Barbosa Araujo', '10'],
    array['Edson Garcia Moreira Da Silva', '10'],
    array['Eduardo Roberto Lopes Filho', '10'],
    array['Fellipe Rafael Santos De Souza', '7.4'],
    array['Gernaian Rodrigues Da Silva', '9.7'],
    array['Gideoni Pereira Da Silva', '10'],
    array['Gracielle De Siqueira Carvalho', '10'],
    array['Jamile Rober Dos Santos Fleury Ferreira', '10'],
    array['Jhonathan Antunes Pauluk', '10'],
    array['Joilson Santos De Moraes', '9'],
    array['Juliano Do Val Petry Freitas', '10'],
    array['Juliano Jacinto Caminha', '9'],
    array['Lauriane Simonini', '10'],
    array['Lucas Carvalho Silva', '9'],
    array['Luiz Henrique Ackermann', '10'],
    array['Moyses Ferreira De Carvalho', '9'],
    array['Odezio Borge De Carvalho', '10'],
    array['Petrus Andrey Guimarães Garcia', '6.7'],
    array['Publio Ferreira Moreno', '8.7'],
    array['Raphael Rocha Xavier', '10'],
    array['Robson Dos Santos Alencar', '10'],
    array['Vinicius Antônio Oliveira Da Silva', '6.7'],
    array['Wender Da Silva Figueiredo', '10']
  ];
begin
  for i in 1..array_length(v_dados, 1) loop
    select id into v_aluno_id from public.profiles
    where lower(trim(nome_completo)) = lower(trim(v_dados[i][1])) limit 1;

    if v_aluno_id is null then
      select id into v_aluno_id from public.profiles
      where lower(nome_completo) like lower(trim(v_dados[i][1])) || '%'
         or lower(trim(v_dados[i][1])) like lower(nome_completo) || '%'
      limit 1;
    end if;

    if v_aluno_id is null then
      v_nao_encontrados := v_nao_encontrados || v_dados[i][1] || '; ';
    else
      insert into public.notas_cfo3 (aluno_id, materia, vc_lista, vf, nota_final, updated_at)
      values (v_aluno_id, v_materia, '{}', v_dados[i][2]::numeric, v_dados[i][2]::numeric, now())
      on conflict (aluno_id, materia) do update
        set vf = excluded.vf, nota_final = excluded.nota_final, updated_at = now();
    end if;
  end loop;

  if v_nao_encontrados <> '' then
    raise notice 'ATENÇÃO — alunos não encontrados: %', v_nao_encontrados;
  else
    raise notice 'Todos os alunos encontrados e notas gravadas com sucesso.';
  end if;
end $$;
