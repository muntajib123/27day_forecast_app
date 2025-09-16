// src/components/ForecastCharts.js
import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { format } from "date-fns";
import { Typography, Box, Paper } from "@mui/material";

// Format date for X-axis label
const formatDateLabel = (dateStr) => {
  try {
    const date = new Date(dateStr);
    return format(date, "MMM dd");
  } catch (err) {
    return dateStr;
  }
};

// Reusable Line Chart Component
const CustomChart = ({ data, dataKey, color, label }) => {
  const formattedData = data.map((entry) => ({
    ...entry,
    date: formatDateLabel(entry.date),
    radio_flux_pred: Number(entry.radio_flux_pred ?? entry.radio_flux ?? 0),
    a_index_pred: Number(entry.a_index_pred ?? entry.a_index ?? 0),
    kp_index_pred: Number(entry.kp_index_pred ?? entry.kp_index ?? 0),
  }));

  return (
    <Paper elevation={3} sx={{ p: 3, my: 3, backgroundColor: "#0a1929" }}>
      <Typography
        variant="h6"
        align="center"
        gutterBottom
        sx={{ color, fontWeight: "bold", mb: 2 }}
      >
        {label}
      </Typography>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart
          data={formattedData}
          margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
          <XAxis dataKey="date" stroke="#ccc" />
          <YAxis stroke="#ccc" />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1e1e2f",
              borderColor: "#57c7ff",
              color: "#fff",
            }}
            labelStyle={{ color: "#57c7ff" }}
          />
          <Legend wrapperStyle={{ color: "#ccc" }} />
          <Line
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            strokeWidth={2.5}
            dot={{ r: 3, stroke: color, strokeWidth: 2, fill: "#000" }}
            activeDot={{ r: 6 }}
            isAnimationActive={true}
            animationDuration={1000}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </Paper>
  );
};

const ForecastCharts = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <Box sx={{ textAlign: "center", py: 4 }}>
        <Typography variant="body1" color="text.secondary">
          No chart data available.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ mt: 5 }}>
      <CustomChart
        data={data}
        dataKey="radio_flux_pred"
        color="#57c7ff"
        label="📡 Radio Flux"
      />
      <CustomChart
        data={data}
        dataKey="a_index_pred"
        color="#90ee90"
        label="🧭 A Index"
      />
      <CustomChart
        data={data}
        dataKey="kp_index_pred"
        color="#ff6b6b"
        label="🧲 Kp Index"
      />
    </Box>
  );
};

export default ForecastCharts;
