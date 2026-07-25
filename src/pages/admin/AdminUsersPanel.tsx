import React, { useState, useEffect } from 'react';
// Tenta o caminho padrao do Lovable/Vite
import { supabase } from '@/integrations/supabase/client';

interface Profile {
  id: string;
  nome_completo: string;
  email: string;
  cpf: string | null;
  role: string;
}

export const AdminUsersPanel = () => {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [editForm, setEditForm] = useState<{
    nome_completo: string;
    cpf: string;
    role: string;
  }>({ nome_completo: '', cpf: '', role: 'aluno' });

  const fetchProfiles = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('nome_completo', { ascending: true });

    if (!error && data) {
      setProfiles(data as Profile[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchProfiles();
  }, []);

  const handleEditClick = (profile: Profile) => {
    setEditingId(profile.id);
    setEditForm({
      nome_completo: profile.nome_completo || '',
      cpf: profile.cpf || '',
      role: profile.role || 'aluno',
    });
  };

  const handleCancel = () => {
    setEditingId(null);
  };

  const handleSave = async (id: string) => {
    const { error } = await supabase
      .from('profiles')
      .update({
        nome_completo: editForm.nome_completo,
        cpf: editForm.cpf || null,
        role: editForm.role,
      })
      .eq('id', id);

    if (error) {
      alert('Erro ao atualizar usuário: ' + error.message);
    } else {
      setEditingId(null);
      fetchProfiles();
    }
  };

  if (loading) return <div className="p-4 text-white">Carregando usuários...</div>;

  return (
    <div className="bg-slate-900 text-white p-6 rounded-lg shadow-md border border-slate-800">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
        👤 Usuários cadastrados ({profiles.length})
      </h2>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-700 text-slate-400 text-sm">
              <th className="py-3 px-4">Nome</th>
              <th className="py-3 px-4">E-mail</th>
              <th className="py-3 px-4">CPF</th>
              <th className="py-3 px-4">Perfil</th>
              <th className="py-3 px-4 text-center">Ações</th>
            </tr>
          </thead>
          <tbody>
            {profiles.map((profile) => {
              const isEditing = editingId === profile.id;

              return (
                <tr key={profile.id} className="border-b border-slate-800 hover:bg-slate-800/50 transition-colors">
                  <td className="py-3 px-4">
                    {isEditing ? (
                      <input
                        type="text"
                        value={editForm.nome_completo}
                        onChange={(e) => setEditForm({ ...editForm, nome_completo: e.target.value })}
                        className="bg-slate-800 border border-amber-500/50 rounded px-2 py-1 text-white w-full focus:outline-none focus:border-amber-500"
                      />
                    ) : (
                      <span className="font-medium text-slate-200">{profile.nome_completo}</span>
                    )}
                  </td>

                  <td className="py-3 px-4 text-slate-400">{profile.email}</td>

                  <td className="py-3 px-4">
                    {isEditing ? (
                      <input
                        type="text"
                        value={editForm.cpf}
                        placeholder="000.000.000-00"
                        onChange={(e) => setEditForm({ ...editForm, cpf: e.target.value })}
                        className="bg-slate-800 border border-amber-500/50 rounded px-2 py-1 text-white w-36 focus:outline-none focus:border-amber-500"
                      />
                    ) : (
                      <span className="text-slate-300">{profile.cpf || '—'}</span>
                    )}
                  </td>

                  <td className="py-3 px-4">
                    {isEditing ? (
                      <select
                        value={editForm.role}
                        onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                        className="bg-slate-800 border border-amber-500/50 rounded px-2 py-1 text-white focus:outline-none focus:border-amber-500"
                      >
                        <option value="aluno">Aluno</option>
                        <option value="admin">Administrador</option>
                      </select>
                    ) : (
                      <span className={`px-2 py-1 text-xs rounded-full ${profile.role === 'admin' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-slate-800 text-slate-300 border border-slate-700'}`}>
                        {profile.role === 'admin' ? 'Administrador' : 'Aluno'}
                      </span>
                    )}
                  </td>

                  <td className="py-3 px-4 text-center">
                    {isEditing ? (
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleSave(profile.id)}
                          className="bg-green-600 hover:bg-green-500 text-white px-3 py-1 rounded text-xs font-semibold transition-colors"
                        >
                          Salvar
                        </button>
                        <button
                          onClick={handleCancel}
                          className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-1 rounded text-xs transition-colors"
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleEditClick(profile)}
                        className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 px-3 py-1 rounded text-xs transition-colors flex items-center gap-1 mx-auto"
                      >
                        ✏️ Editar
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminUsersPanel;
