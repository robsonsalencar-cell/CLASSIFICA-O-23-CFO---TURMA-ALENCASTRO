import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Student } from "@/data/mockData";

interface GradeDistributionChartProps {
  students: Student[];
  average: number;
}

export const GradeDistributionChart = ({ students, average }: GradeDistributionChartProps) => {
  const distributionData = useMemo(() => {
    if (students.length === 0) return [];
    
    const grades = students.map(s => s.mediaFinal);
    const min = Math.min(...grades);
    const max = Math.max(...grades);
    
    // Se todos os alunos têm a mesma nota, criar bins fixos de 0 a 10
    const range = max - min;
    const binCount = 10;
    const binSize = range === 0 ? 1 : range / binCount;
    const actualMin = range === 0 ? 0 : min;

    const bins = Array.from({ length: binCount }, (_, i) => {
      const start = actualMin + (i * binSize);
      const end = start + binSize;
      return {
        range: `${start.toFixed(1)} - ${end.toFixed(1)}`,
        count: 0,
        start,
        end
      };
    });

    grades.forEach(grade => {
      let binIndex;
      if (range === 0) {
        // Se todas as notas são iguais, colocar no bin correspondente
        binIndex = Math.min(Math.floor(grade), binCount - 1);
      } else {
        binIndex = Math.min(
          Math.floor((grade - min) / binSize),
          binCount - 1
        );
      }
      if (bins[binIndex]) {
        bins[binIndex].count++;
      }
    });

    return bins;
  }, [students]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">
          Distribuição de Notas
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={distributionData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis 
                dataKey="range" 
                fontSize={12}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis fontSize={12} />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-white p-3 border rounded-lg shadow-lg">
                        <p className="font-semibold">Faixa: {label}</p>
                        <p className="text-primary">
                          Alunos: {payload[0].value}
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <ReferenceLine 
                x={distributionData.find(bin => average >= bin.start && average <= bin.end)?.range}
                stroke="hsl(var(--success))"
                strokeDasharray="4 4"
                strokeWidth={2}
                label={{ value: `Média: ${average.toFixed(2)}`, position: "top" }}
              />
              <Bar 
                dataKey="count" 
                fill="hsl(var(--primary))"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
        
        <div className="mt-4 text-center">
          <p className="text-sm text-muted-foreground">
            Distribuição das médias finais dos {students.length} alunos
          </p>
        </div>
      </CardContent>
    </Card>
  );
};