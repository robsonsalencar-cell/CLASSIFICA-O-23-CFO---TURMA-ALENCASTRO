do $$
declare
  v_materia text := 'Natação';
  v_aluno_id uuid;
  v_nao_encontrados text := '';
  v_dados text[][] := array[
    array['Aline Aparecida Rosa', '9.250'],
    array['Andre Baroni Oliveira', '9.000'],
    array['Bruna Laís Evangelista Da Silva Ribeiro', '9.750'],
    array['Caisson Grazianni Albuquerque Guimarães', '9.250'],
    array['Delvi Péricles Souza Gomes Júnior', '0.000'],
    array['Diego Cesar Barbosa Araujo', '9.750'],
    array['Edson Garcia Moreira Da Silva', '9.750'],
    array['Eduardo Roberto Lopes Filho', '9.750'],
    array['Fellipe Rafael Santos De Souza', '0.000'],
    array['Gernaian Rodrigues Da Silva', '9.625'],
    array['Gideoni Pereira Da Silva', '9.500'],
    array['Gracielle De Siqueira Carvalho', '8.125'],
    array['Jamile Rober Dos Santos Fleury Ferreira', '9.500'],
    array['Jhonathan Antunes Pauluk', '9.625'],
    array['Joilson Santos De Moraes', '9.750'],
    array['Juliano Do Val Petry Freitas', '9.500'],
    array['Juliano Jacinto Caminha', '9.375'],
    array['Lauriane Simonini', '9.750'],
    array['Lucas Carvalho Silva', '8.875'],
    array['Luiz Henrique Ackermann', '9.750'],
    array['Moyses Ferreira De Carvalho', '9.625'],
    array['Odezio Borge De Carvalho', '9.500'],
    array['Petrus Andrey Guimarães Garcia', '9.750'],
    array['Publio Ferreira Moreno', '9.750'],
    array['Raphael Rocha Xavier', '9.750'],
    array['Robson Dos Santos Alencar', '9.625'],
    array['Vinicius Antônio Oliveira Da Silva', '9.000'],
    array['Wender Da Silva Figueiredo', '9.250']
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
    raise notice 'Todos os alunos encontrados e notas de Natação gravadas com sucesso.';
  end if;
end $$;
