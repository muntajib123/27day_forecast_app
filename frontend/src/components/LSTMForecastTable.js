// src/components/LSTMForecastTable.js
import React, { useEffect } from "react";
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

// Utility to format date
const formatDateUTC = (rawDate) => {
  const date = new Date(rawDate);
  return format(date, "MMM dd, yyyy");
};

const LSTMForecastTable = ({ data = [], onDataLoaded }) => {
  useEffect(() => {
    if (data.length > 0) {
      onDataLoaded(data);
    }
  }, [data, onDataLoaded]);

  if (!data || data.length === 0) {
    return (
      <Box sx={{ textAlign: "center", py: 5 }}>
        <ClipLoader size={35} color="#1976d2" />
        <Typography variant="body2" sx={{ mt: 1, color: "#ccc" }}>
          Loading forecast data...
        </Typography>
      </Box>
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
        backgroundImage: "url('/images/space-bg.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        borderRadius: 2,
      }}
    >
      <Typography
        variant="h5"
        align="center"
        gutterBottom
        sx={{ color: "#fff", fontWeight: "bold", mb: 4 }}
      >
        27-Day Space Weather Forecast
      </Typography>

      <Grid container spacing={3} justifyContent="center">
        {filtered.map((item, idx) => {
          const flux = item.radio_flux;
          const apIndex = item.a_index;
          const kpIndex = item.kp_index;

          return (
            <Grid item xs={12} sm={6} md={4} key={idx}>
              <Card
                sx={{
                  backgroundColor: "rgba(20, 20, 30, 0.9)",
                  color: "#fff",
                  borderRadius: 3,
                  boxShadow: "0 0 20px rgba(255,255,255,0.1)",
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
