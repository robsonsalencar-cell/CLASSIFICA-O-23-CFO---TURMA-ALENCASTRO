import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface SubjectAverage {
  name: string;
  average: number;
  standardDeviation: number;
  count: number;
}

interface SubjectAveragesChartProps {
  data: SubjectAverage[];
}

export const SubjectAveragesChart = ({ data }: SubjectAveragesChartProps) => {
  // Show top 15 subjects to avoid overcrowding
  const topSubjects = data.slice(0, 15);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">
          Média por Disciplina (Top 15)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={topSubjects}
              layout="horizontal"
              margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis 
                type="number"
                domain={[8, 10]}
                fontSize={12}
              />
              <YAxis 
                type="category"
                dataKey="name"
                fontSize={11}
                width={150}
                tickFormatter={(value) => value.length > 20 ? value.substring(0, 18) + "..." : value}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-white p-3 border rounded-lg shadow-lg max-w-xs">
                        <p className="font-semibold mb-2">{label}</p>
                        <p className="text-primary">
                          Média: {data.average.toFixed(2)}
                        </p>
                        <p className="text-muted-foreground text-sm">
                          Desvio padrão: {data.standardDeviation.toFixed(2)}
                        </p>
                        <p className="text-muted-foreground text-sm">
                          Alunos: {data.count}
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar 
                dataKey="average" 
                fill="hsl(var(--chart-2))"
                radius={[0, 4, 4, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
        
        <div className="mt-4 text-center">
          <p className="text-sm text-muted-foreground">
            Disciplinas ordenadas por média decrescente
          </p>
        </div>
      </CardContent>
    </Card>
  );
};