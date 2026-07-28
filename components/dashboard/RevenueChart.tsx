"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency } from "@/lib/calculations";

type Point = { label: string; total: number };

export function RevenueChart({ data }: { data: Point[] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#d4cbb8" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: "#5c6b7a", fontSize: 11 }}
            axisLine={{ stroke: "#d4cbb8" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "#5c6b7a", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${Math.round(v / 1000)}k`}
          />
          <Tooltip
            formatter={(value) => formatCurrency(Number(value ?? 0))}
            contentStyle={{
              background: "#faf7f0",
              border: "1px solid #d4cbb8",
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Bar dataKey="total" fill="#0d6e6e" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
