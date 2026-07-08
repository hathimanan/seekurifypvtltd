import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  BarChart,
  Bar,
  Legend,
  Cell,
} from 'recharts';

const FixedResponsiveContainer = ResponsiveContainer as unknown as React.FC<any>;
const FixedLineChart = LineChart as unknown as React.FC<any>;
const FixedXAxis = XAxis as unknown as React.FC<any>;
const FixedYAxis = YAxis as unknown as React.FC<any>;
const FixedBarChart = BarChart as unknown as React.FC<any>;
const FixedLegend = Legend as unknown as React.FC<any>;
const FixedLine = Line as unknown as React.FC<any>;
const FixedBar = Bar as unknown as React.FC<any>;



interface GraphProps {
  title: string;
  data: { date?: string; category?: string; value: number }[];
    type?: 'line' | 'bar';
  category?: string;
  xKey?: string;
  yKey?: string;
  valueKey?: string;
  dateKey?: string;
  value?: number;
}

const Graph: React.FC<GraphProps> = ({
  title,
  data,
  type = 'line',
  xKey = 'date',
  yKey = 'value',
}) => {
  const total = data.reduce((sum, d) => sum + Number(d[yKey as keyof typeof d] || 0), 0);

  const allZero = total === 0 || data.length === 0;

  return (
    <div className="bg-gray-700 text-white p-4 rounded-2xl shadow-lg w-full h-64 flex flex-col justify-between">
      <div className="text-center">
        <h2 className="text-lg font-bold">{title}</h2>
        <p className="text-xl font-semibold">Total: {total}</p>
      </div>

      {allZero ? (
        <div className="flex-1 flex items-center justify-center text-gray-300">No data to display</div>
      ) : (
        <FixedResponsiveContainer width="100%" height="80%">
          {type === 'line' ? (
            <FixedLineChart data={data}>
              <CartesianGrid stroke="#ccc" strokeDasharray="3 3" />
              <FixedXAxis dataKey={xKey} angle={-45} textAnchor="end" height={60} />
              <FixedYAxis />
              <Tooltip />
              <FixedLegend />
              <FixedLine type="monotone" dataKey={yKey} stroke="#00bcd4" strokeWidth={2} dot />
            </FixedLineChart>
          ) : (
            <FixedBarChart data={data}>
              <CartesianGrid stroke="#ccc" strokeDasharray="3 3" />
              <FixedXAxis dataKey={xKey} />
              <FixedYAxis />
              <Tooltip />
              <FixedLegend />
              <FixedBar dataKey={yKey}>
                {data.map((entry, index) => {
                  const category = entry.category || '';
                  let fillColor = '#4ade80'; // default greenish
                  if (category === 'Poor') fillColor = '#ef4444'; // red
                  else if (category === 'Medium') fillColor = '#f97316'; // orange
                  else if (category === 'Good') fillColor = '#f59e0b'; // amber
                  else if (category === 'Strong') fillColor = '#16a34a'; // green

                  return <Cell key={`cell-${index}`} fill={fillColor} />;
                })}
              </FixedBar>
            </FixedBarChart>
          )}
        </FixedResponsiveContainer>
      )}
    </div>
  );
};

export default Graph;
