import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminUsersPanel } from "./AdminUsersPanel";
import { AdminGradesEditor } from "./AdminGradesEditor";
import { AdminPersonalizacao } from "./AdminPersonalizacao";
import { AdminEncerramento } from "./AdminEncerramento";
import { MATERIAS_CFO1 } from "@/config/materiasCfo1";
import { MATERIAS_CFO2 } from "@/config/materiasCfo2";
import { MATERIAS_CFO3 } from "@/config/materiasCfo3";

export default function Admin() {
  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Painel do Administrador</h1>
        <p className="text-sm text-muted-foreground">
          Cadastro de alunos e lançamento/alteração de notas por módulo.
        </p>
      </div>

      <Tabs defaultValue="usuarios">
        <TabsList>
          <TabsTrigger value="usuarios">Usuários</TabsTrigger>
          <TabsTrigger value="cfo1">Notas CFO I</TabsTrigger>
          <TabsTrigger value="cfo2">Notas CFO II</TabsTrigger>
          <TabsTrigger value="cfo3">Notas CFO III</TabsTrigger>
          <TabsTrigger value="encerramento">Encerramento</TabsTrigger>
          <TabsTrigger value="personalizacao">Personalização</TabsTrigger>
        </TabsList>

        <TabsContent value="usuarios" className="mt-6">
          <AdminUsersPanel />
        </TabsContent>
        <TabsContent value="cfo1" className="mt-6">
          <AdminGradesEditor tabela="notas_cfo1" tituloModulo="CFO I" listaMaterias={MATERIAS_CFO1} />
        </TabsContent>
        <TabsContent value="cfo2" className="mt-6">
          <AdminGradesEditor tabela="notas_cfo2" tituloModulo="CFO II" listaMaterias={MATERIAS_CFO2} />
        </TabsContent>
        <TabsContent value="cfo3" className="mt-6">
          <AdminGradesEditor tabela="notas_cfo3" tituloModulo="CFO III" listaMaterias={MATERIAS_CFO3} />
        </TabsContent>
        <TabsContent value="encerramento" className="mt-6">
          <AdminEncerramento />
        </TabsContent>
        <TabsContent value="personalizacao" className="mt-6">
          <AdminPersonalizacao />
        </TabsContent>
      </Tabs>
    </div>
  );
}
