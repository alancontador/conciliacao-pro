import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, Label } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface StatusChartProps {
  data: {
    conciliadas: number;
    pendentes: number;
    emAnalise: number;
  };
}

export function StatusChart({ data }: StatusChartProps) {
  const total = data.conciliadas + data.pendentes + data.emAnalise;
  const percentual = total > 0 ? (data.conciliadas / total) * 100 : 0;

  const chartData = [
    { name: 'Conciliadas', value: data.conciliadas, color: 'hsl(var(--success))' },
    { name: 'Pendentes', value: data.pendentes, color: 'hsl(var(--destructive))' },
    { name: 'Em Análise', value: data.emAnalise, color: 'hsl(var(--warning))' },
  ].filter((d) => d.value > 0);

  if (total === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Status de Conciliação</CardTitle>
          <CardDescription>Distribuição por status</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[280px] text-muted-foreground text-sm">
          Nenhuma conta para exibir
        </CardContent>
      </Card>
    );
  }

  const renderCenterLabel = ({ viewBox }: { viewBox?: { cx: number; cy: number } }) => {
    const cx = viewBox?.cx ?? 0;
    const cy = viewBox?.cy ?? 0;
    return (
      <g>
        <text x={cx} y={cy - 8} textAnchor="middle" fontSize={28} fontWeight={700} fill="hsl(var(--foreground))">
          {percentual.toFixed(0)}%
        </text>
        <text x={cx} y={cy + 14} textAnchor="middle" fontSize={12} fill="hsl(var(--muted-foreground))">
          conciliado
        </text>
      </g>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Status de Conciliação</CardTitle>
        <CardDescription>Distribuição por status</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={72}
              outerRadius={108}
              paddingAngle={2}
              dataKey="value"
              label={false}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0} />
              ))}
              <Label content={renderCenterLabel} position="center" />
            </Pie>
            <Tooltip
              formatter={(value: number, name: string) => [
                `${value} conta${value !== 1 ? 's' : ''}`,
                name,
              ]}
            />
            <Legend
              iconType="circle"
              iconSize={8}
              formatter={(value) => <span style={{ fontSize: 13 }}>{value}</span>}
            />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
