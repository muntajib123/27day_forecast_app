// src/components/ForecastBarCharts.js
import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { format } from "date-fns";
import { Typography, Box, Paper } from "@mui/material";

// Format date labels for the X-axis
const formatDateLabel = (dateStr) => {
  try {
    const date = new Date(dateStr);
    return format(date, "MMM dd");
  } catch (err) {
    return dateStr;
  }
};

// Reusable Bar Chart component
const CustomBarChart = ({ data, dataKey, color, label, icon }) => {
  const formattedData = data.map((entry) => ({
    ...entry,
    date: formatDateLabel(entry.date),
    radio_flux_pred: Number(entry.radio_flux_pred ?? entry.radio_flux ?? 0),
    a_index_pred: Number(entry.a_index_pred ?? entry.a_index ?? 0),
    kp_index_pred: Number(entry.kp_index_pred ?? entry.kp_index ?? 0),
  }));

  return (
    <Paper elevation={3} sx={{ p: 3, backgroundColor: "#0a1929" }}>
      <Typography
        variant="h6"
        align="center"
        sx={{ color, fontWeight: "bold", mb: 2 }}
      >
        {icon} {label}
      </Typography>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart
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
          <Bar
            dataKey={dataKey}
            fill={color}
            name={label}
            animationDuration={800}
            isAnimationActive
          />
        </BarChart>
      </ResponsiveContainer>
    </Paper>
  );
};

const ForecastBarCharts = ({ data }) => {
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
    <Box sx={{ display: "grid", gap: 5, mt: 5 }}>
      <CustomBarChart
        data={data}
        dataKey="radio_flux_pred"
        color="#57c7ff"
        label="Radio Flux"
        icon="📡"
      />
      <CustomBarChart
        data={data}
        dataKey="a_index_pred"
        color="#90ee90"
        label="A Index"
        icon="🧭"
      />
      <CustomBarChart
        data={data}
        dataKey="kp_index_pred"
        color="#ff6b6b"
        label="Kp Index"
        icon="🧲"
      />
    </Box>
  );
};

export default ForecastBarCharts;
