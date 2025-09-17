import React, { useEffect, useState } from "react";
import { format } from "date-fns";
import ClipLoader from "react-spinners/ClipLoader";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
} from "@mui/material";
import WbSunnyIcon from "@mui/icons-material/WbSunny";
import BoltIcon from "@mui/icons-material/Bolt";
import SignalCellularAltIcon from "@mui/icons-material/SignalCellularAlt";
import { fetchJSON } from "../utils/api"; // ✅ use fetch helper

// Utility to format date
const formatDateUTC = (rawDate) => {
  const date = new Date(rawDate);
  return format(date, "MMM dd, yyyy");
};

const LSTMForecastTable = ({ onDataLoaded }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const forecast = await fetchJSON("/api/predictions/lstm");
        setData(forecast);
        if (onDataLoaded) onDataLoaded(forecast);
      } catch (err) {
        console.error("Error fetching LSTM forecast:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [onDataLoaded]);

  if (loading) {
    return (
      <Box sx={{ textAlign: "center", py: 5 }}>
        <ClipLoader size={35} color="#1976d2" />
        <Typography variant="body2" sx={{ mt: 1, color: "#777" }}>
          Loading forecast data...
        </Typography>
      </Box>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Typography variant="h6" align="center" sx={{ mt: 4, color: "#777" }}>
        No LSTM forecast data available.
      </Typography>
    );
  }

  const filtered = [...data]
    .filter((item) => item.date)
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, 27);

  return (
    <Box
      sx={{
        mt: 5,
        px: 2,
        py: 4,
        backgroundColor: "#ffffff",
        borderRadius: 2,
      }}
    >
      <Typography
        variant="h5"
        align="center"
        gutterBottom
        sx={{ color: "#0a0f2c", fontWeight: "bold", mb: 4 }}
      >
        27-Day Space Weather Forecast (LSTM Model)
      </Typography>

      <Grid container spacing={3} justifyContent="center">
        {filtered.map((item, idx) => {
          const flux = item.f107 || item.radio_flux;
          const apIndex = item.a_index;
          const kpIndex = item.kp_max || item.kp_index;

          return (
            <Grid item xs={12} sm={6} md={4} key={idx}>
              <Card
                sx={{
                  backgroundColor: "#f9f9f9",
                  color: "#000",
                  borderRadius: 3,
                  boxShadow: "0 0 10px rgba(0,0,0,0.1)",
                }}
              >
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    <WbSunnyIcon sx={{ mr: 1, color: "gold" }} />
                    {formatDateUTC(item.date)}
                  </Typography>

                  <Typography variant="body2" gutterBottom>
                    <SignalCellularAltIcon sx={{ mr: 1, color: "#00e5ff" }} />
                    <strong>Radio Flux:</strong> {flux}
                  </Typography>

                  <Typography variant="body2" gutterBottom>
                    <WbSunnyIcon
                      sx={{
                        mr: 1,
                        color: apIndex >= 20 ? "orange" : "#64dd17",
                      }}
                    />
                    <strong>Ap Index:</strong> {apIndex}
                  </Typography>

                  <Typography variant="body2">
                    <BoltIcon
                      sx={{
                        mr: 1,
                        color: kpIndex >= 5 ? "red" : "#ff6f00",
                      }}
                    />
                    <strong>Kp Index:</strong> {kpIndex}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>
    </Box>
  );
};

export default LSTMForecastTable;
