-- ============================================================
-- MIGRAÇÃO 6 — Cabeçalhos das páginas totalmente editáveis (não só a
-- "ponta" do texto). Mantém nome_turma/subtitulo_turma como está (usados
-- no menu lateral e na tela de login, que são rótulos curtos) e adiciona
-- campos separados para o texto completo do cabeçalho grande de cada página.
-- ============================================================

alter table public.turmas add column if not exists titulo_pagina_modulo text
  not null default 'Classificação – 23º CFO';

alter table public.turmas add column if not exists titulo_pagina_geral text
  not null default 'CLASSIFICAÇÃO FINAL – 23º CFO';

alter table public.turmas add column if not exists subtitulo_pagina text
  not null default 'Painel de desempenho dos alunos oficiais - Turma Alencastro';

-- Preenche as turmas já existentes com os valores atuais (nome_turma/subtitulo_turma)
-- como ponto de partida, para não ficar vazio.
update public.turmas
set titulo_pagina_modulo = 'Classificação – ' || nome_turma,
    titulo_pagina_geral = 'CLASSIFICAÇÃO FINAL – ' || nome_turma,
    subtitulo_pagina = 'Painel de desempenho dos alunos oficiais - ' || subtitulo_turma
where titulo_pagina_modulo = 'Classificação – 23º CFO'; -- só as que ainda estão no valor padrão
