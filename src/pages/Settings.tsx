import { useState } from 'react';
import { useAccountingStore } from '@/store/accounting';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Save, Building2, History, Trash2 } from 'lucide-react';
import type { CompanyInfo } from '@/types/accounting';

export function Settings() {
  const { companyInfo, setCompanyInfo, importHistory } = useAccountingStore();
  const [formData, setFormData] = useState<CompanyInfo>(companyInfo);
  const { toast } = useToast();

  const handleSave = () => {
    setCompanyInfo(formData);
    toast({
      title: 'Configurações salvas',
      description: 'As informações da empresa foram atualizadas com sucesso.',
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SUCESSO':
        return <Badge variant="default" className="bg-success text-success-foreground">Sucesso</Badge>;
      case 'ERRO':
        return <Badge variant="destructive">Erro</Badge>;
      case 'PARCIAL':
        return <Badge variant="default" className="bg-warning text-warning-foreground">Parcial</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Configurações</h1>
        <p className="text-muted-foreground">Gerencie as configurações do sistema e informações da empresa</p>
      </div>

      {/* Company Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            Informações da Empresa
          </CardTitle>
          <CardDescription>
            Configure os dados da empresa que serão exibidos no cabeçalho do sistema
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="nome">Nome da Empresa</Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                placeholder="Digite o nome da empresa"
              />
            </div>
            
            <div>
              <Label htmlFor="cnpj">CNPJ</Label>
              <Input
                id="cnpj"
                value={formData.cnpj}
                onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                placeholder="00.000.000/0000-00"
              />
            </div>
            
            <div>
              <Label htmlFor="periodo">Período de Análise</Label>
              <Input
                id="periodo"
                value={formData.periodo}
                onChange={(e) => setFormData({ ...formData, periodo: e.target.value })}
                placeholder="Ex: Janeiro/2024"
              />
            </div>
            
            <div>
              <Label htmlFor="responsavel">Contador Responsável</Label>
              <Input
                id="responsavel"
                value={formData.responsavel}
                onChange={(e) => setFormData({ ...formData, responsavel: e.target.value })}
                placeholder="Nome do contador responsável"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSave}>
              <Save className="w-4 h-4 mr-2" />
              Salvar Configurações
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Import History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="w-5 h-5" />
            Histórico de Importações
          </CardTitle>
          <CardDescription>
            Visualize o histórico de arquivos importados no sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          {importHistory.length === 0 ? (
            <div className="text-center py-8">
              <div className="mx-auto w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-4">
                <History className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground">Nenhuma importação realizada ainda</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Arquivo</TableHead>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Linhas Lidas</TableHead>
                    <TableHead>Linhas Ignoradas</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {importHistory.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        {item.data.toLocaleString('pt-BR')}
                      </TableCell>
                      <TableCell>
                        <Badge variant={item.tipo === 'BALANCETE' ? 'default' : 'secondary'}>
                          {item.tipo}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate" title={item.arquivo}>
                        {item.arquivo}
                      </TableCell>
                      <TableCell>{item.usuario}</TableCell>
                      <TableCell className="text-right">{item.linhasLidas}</TableCell>
                      <TableCell className="text-right">{item.linhasIgnoradas}</TableCell>
                      <TableCell>
                        {getStatusBadge(item.status)}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* System Information */}
      <Card>
        <CardHeader>
          <CardTitle>Informações do Sistema</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-2xl font-bold">v1.0.0</div>
              <div className="text-sm text-muted-foreground">Versão do Sistema</div>
            </div>
            
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-2xl font-bold">ConciliaçãoPRO</div>
              <div className="text-sm text-muted-foreground">Sistema Contábil</div>
            </div>
            
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-2xl font-bold">2024</div>
              <div className="text-sm text-muted-foreground">Todos os direitos reservados</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}