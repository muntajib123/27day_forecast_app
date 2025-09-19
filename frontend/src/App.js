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
import LogoutIcon from "@mui/icons-material/Logout";
import { isWithinInterval, startOfDay, endOfDay } from "date-fns";

import LSTMForecastTable from "./components/LSTMForecastTable";
import ForecastCharts from "./components/ForecastCharts";
import ForecastBarCharts from "./components/ForecastBarCharts";
import DateRangeFilter from "./components/DateRangeFilter";
import LoginGate from "./components/LoginGate";

import { fetchJSON } from "./utils/api";

// ===== Fallback fetch: try LSTM, then combined, then NOAA 27day =====
async function fetchForecastData() {
  const endpoints = [
    "/api/predictions/lstm",
    "/api/predictions/combined",
    "/api/predictions/27day",
  ];

  for (const ep of endpoints) {
    try {
      const res = await fetchJSON(ep);
      if (Array.isArray(res) && res.length > 0) {
        console.log(`✅ Using endpoint: ${ep}`);
        return res;
      } else {
        console.warn(`⚠️ Endpoint returned empty array: ${ep}`);
      }
    } catch (err) {
      console.warn(`⚠️ Endpoint failed: ${ep}`, err && (err.message || err));
    }
  }

  return [];
}

function AppContent() {
  const [forecastData, setForecastData] = useState([]);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [loadingData, setLoadingData] = useState(true);

  // Load data from backend
  useEffect(() => {
    (async () => {
      try {
        setLoadingData(true);
        const data = await fetchForecastData();
        setForecastData(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("❌ Fetch error:", err);
        setForecastData([]);
      } finally {
        setLoadingData(false);
      }
    })();
  }, []);

  const theme = createTheme({
    palette: {
      mode: "light",
      primary: { main: "#1976d2" },
      background: { default: "#f5f5f5", paper: "#fff" },
      text: { primary: "#000" },
    },
    typography: {
      fontFamily: "Orbitron, Roboto, sans-serif",
      h3: { fontSize: "3rem" },
    },
  });

  const handleDataLoaded = useCallback((data) => {
    console.log("📡 Forecast data loaded:", data);
  }, []);

  const sortedByDate = [...forecastData].sort(
    (a, b) => new Date(a.date) - new Date(b.date)
  );

  const filteredData = sortedByDate.filter((item) => {
    const itemDate = new Date(item.date);

    if (startDate && endDate) {
      return isWithinInterval(itemDate, {
        start: startOfDay(startDate),
        end: endOfDay(endDate),
      });
    }
    if (startDate && !endDate) {
      return itemDate >= startOfDay(startDate);
    }
    if (!startDate && endDate) {
      return itemDate <= endOfDay(endDate);
    }
    return true;
  });

  const clearFilters = () => {
    setStartDate(null);
    setEndDate(null);
  };

  async function handleLogout() {
    try {
      await fetch("/api/logout", { method: "POST", credentials: "include" });
    } catch (e) {
      console.warn("Logout failed:", e);
    } finally {
      window.location.reload();
    }
  }

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
          {/* Header */}
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={4}>
            <Box display="flex" alignItems="center">
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

            {/* Logout button */}
            <Button
              variant="outlined"
              startIcon={<LogoutIcon />}
              onClick={handleLogout}
            >
              Logout
            </Button>
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

export default function App() {
  return (
    <LoginGate>
      <AppContent />
    </LoginGate>
  );
}
