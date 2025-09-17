// src/App.js
import React, { useState, useEffect, useCallback } from "react";
import {
  Container,
  Box,
  Typography,
  CssBaseline,
  createTheme,
  ThemeProvider,
  Button,
} from "@mui/material";
import { isWithinInterval } from "date-fns";

import LSTMForecastTable from "./components/LSTMForecastTable";
import ForecastCharts from "./components/ForecastCharts";
import ForecastBarCharts from "./components/ForecastBarCharts";
import DateRangeFilter from "./components/DateRangeFilter";

import { fetchJSON } from "./utils/api"; // ✅ use helper

function App() {
  const [forecastData, setForecastData] = useState([]);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);

  // Load data from backend
  useEffect(() => {
    (async () => {
      try {
        const data = await fetchJSON("/api/predictions/lstm");
        setForecastData(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Fetch error:", err);
      }
    })();
  }, []);

  // Light theme with larger font sizes
  const theme = createTheme({
    palette: {
      mode: "light",
      primary: { main: "#1976d2" },
      secondary: { main: "#dc004e" },
      background: {
        default: "#f5f5f5",
        paper: "#fff",
      },
      text: {
        primary: "#000",
        secondary: "#333",
      },
    },
    typography: {
      fontFamily: "Orbitron, Roboto, sans-serif",
      h3: { fontSize: "3rem" },
      subtitle1: { fontSize: "1.5rem" },
      body1: { fontSize: "1.2rem" },
      button: { fontSize: "1.1rem" },
    },
  });

  const handleDataLoaded = useCallback((data) => {
    console.log("Data loaded:", data);
  }, []);

  const sortedByDate = [...forecastData].sort(
    (a, b) => new Date(a.date) - new Date(b.date)
  );
  const last27 = sortedByDate.slice(-27);

  const filteredData = last27.filter((item) => {
    const itemDate = new Date(item.date);
    return (
      (!startDate && !endDate) ||
      (startDate &&
        endDate &&
        isWithinInterval(itemDate, { start: startDate, end: endDate }))
    );
  });

  const clearFilters = () => {
    setStartDate(null);
    setEndDate(null);
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box
        sx={{
          backgroundColor: theme.palette.background.default,
          minHeight: "100vh",
          py: 6,
        }}
      >
        <Container
          maxWidth="lg"
          sx={{
            bgcolor: theme.palette.background.paper,
            borderRadius: 4,
            boxShadow: 5,
            py: 4,
            px: { xs: 2, md: 4 },
          }}
        >
          {/* Header with CoralComp Logo */}
          <Box display="flex" alignItems="center" justifyContent="center" mb={4}>
            <Box
              component="img"
              src="/coralcomp-logo.png"
              alt="CoralComp Logo"
              sx={{ height: 60, mr: 2 }}
            />
            <Typography variant="h3" gutterBottom color="text.primary">
              🛰️ 27-Day Space Weather Forecast
            </Typography>
          </Box>

          {/* Date Filter */}
          <DateRangeFilter
            startDate={startDate}
            endDate={endDate}
            setStartDate={setStartDate}
            setEndDate={setEndDate}
          />

          {/* Clear Filters Button */}
          <Box textAlign="center" mt={3} mb={4}>
            <Button variant="outlined" onClick={clearFilters}>
              Clear Filters
            </Button>
          </Box>

          {/* Forecast Table */}
          <LSTMForecastTable
            data={filteredData}
            onDataLoaded={handleDataLoaded}
            lightMode={true}
          />

          {/* Charts */}
          <Box mt={6}>
            <ForecastCharts data={filteredData} lightMode={true} />
          </Box>
          <Box mt={6}>
            <ForecastBarCharts data={filteredData} lightMode={true} />
          </Box>

          {/* Footer */}
          <Box textAlign="center" mt={6} color="text.secondary">
            <Typography variant="body1">© 2025 LSTM Forecast Viewer</Typography>
          </Box>
        </Container>
      </Box>
    </ThemeProvider>
  );
}

export default App;
