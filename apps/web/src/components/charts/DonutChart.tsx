import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

interface DonutChartProps {
  data: {
    name: string;
    value: number;
    color: string;
  }[];
  height?: number;
  centerContent?: React.ReactNode;
}

const DEFAULT_COLORS = [
  "#3b82f6", // blue
  "#10b981", // green
  "#f59e0b", // amber
  "#ef4444", // red
  "#8b5cf6", // purple
  "#ec4899", // pink
];

export function DonutChart({ data, height = 300, centerContent }: DonutChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsPieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={80}
          paddingAngle={2}
          dataKey="value"
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip />
        {centerContent && (
          <foreignObject x="40%" y="40%" width="20%" height="20%">
            <div className="flex items-center justify-center h-full">
              {centerContent}
            </div>
          </foreignObject>
        )}
      </RechartsPieChart>
    </ResponsiveContainer>
  );
}
