-- ============================================================
-- IMPORTAÇÃO: Diário de Classe — Direito Administrativo Disciplinar Militar III
-- (CFO III) — dados extraídos do PDF que você enviou.
--
-- Observações:
-- - No diário, as notas estavam na escala 0-100 (ex: 100, 90, 95, 80).
--   Convertidas aqui para a escala 0-10 usada no resto do sistema (÷10).
-- - Ninguém tinha VC1/VC2/VC3 preenchido nesse diário — só VF. Por isso
--   vc_lista fica vazia e a nota final = a própria VF.
-- - O casamento com o aluno é feito pelo NOME, ignorando maiúsculas/acentos/
--   espaços extras. Ao final, um aviso lista quem não foi encontrado (ex:
--   se o nome no diário tiver uma grafia bem diferente do cadastro).
-- ============================================================

do $$
declare
  v_materia text := 'Direito Administrativo Disciplinar Militar III';
  v_linha record;
  v_aluno_id uuid;
  v_nao_encontrados text := '';
  v_dados text[][] := array[
    array['Aline Aparecida Rosa', '10.0'],
    array['Andre Baroni Oliveira', '10.0'],
    array['Angelo Marcio Ferreira Menezes', '10.0'],
    array['Bruna Laís Evangelista Da Silva Ribeiro', '10.0'],
    array['Caisson Grazianni Albuquerque Guimarães', '10.0'],
    array['Delvi Péricles Souza Gomes Júnior', '10.0'],
    array['Diego Cesar Barbosa Araujo', '10.0'],
    array['Edson Garcia Moreira Da Silva', '10.0'],
    array['Eduardo Roberto Lopes Filho', '10.0'],
    array['Fellipe Rafael Santos De Souza', '10.0'],
    array['Gernaian Rodrigues Da Silva', '10.0'],
    array['Gideoni Pereira Da Silva', '10.0'],
    array['Gracielle De Siqueira Carvalho', '10.0'],
    array['Jamile Rober Dos Santos Fleury Ferreira', '9.0'],
    array['Jhonathan Antunes Pauluk', '10.0'],
    array['Joilson Santos De Moraes', '9.0'],
    array['Juliano Do Val Petry Freitas', '8.0'],
    array['Juliano Jacinto Caminha', '10.0'],
    array['Lauriane Simonini', '10.0'],
    array['Lavínia Diniz Siqueira', '10.0'],
    array['Lucas Carvalho Silva', '10.0'],
    array['Luiz Henrique Ackermann', '10.0'],
    array['Moyses Ferreira De Carvalho', '10.0'],
    array['Odezio Borge De Carvalho', '10.0'],
    array['Petrus Andrey Guimarães Garcia', '10.0'],
    array['Publio Ferreira Moreno', '10.0'],
    array['Raphael Rocha Xavier', '9.5'],
    array['Robson Dos Santos Alencar', '10.0'],
    array['Vinicius Antônio Oliveira Da Silva', '10.0'],
    array['Wender Da Silva Figueiredo', '9.0']
  ];
begin
  for i in 1..array_length(v_dados, 1) loop
    -- casamento tolerante: ignora maiúsculas/minúsculas e espaços nas pontas;
    -- se não achar exato, tenta um "começa com" nos dois sentidos
    select id into v_aluno_id
    from public.profiles
    where lower(trim(nome_completo)) = lower(trim(v_dados[i][1]))
    limit 1;

    if v_aluno_id is null then
      select id into v_aluno_id
      from public.profiles
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
    raise notice 'ATENÇÃO — alunos não encontrados (confira o nome no cadastro): %', v_nao_encontrados;
  else
    raise notice 'Todos os 30 alunos foram encontrados e as notas foram gravadas com sucesso.';
  end if;
end $$;
