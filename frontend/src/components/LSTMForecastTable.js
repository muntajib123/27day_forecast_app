// src/components/LSTMForecastTable.js
import React, { useEffect, useState } from "react";
import { format } from "date-fns";
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

/*
Props:
  - data: Array of forecast objects (already fetched & filtered by App)
  - onDataLoaded: optional callback invoked with the array displayed
  - lightMode: optional (not used here but accepted)
*/

const formatDateUTC = (rawDate) => {
  const date = new Date(rawDate);
  return format(date, "MMM dd, yyyy");
};

const formatNumber = (v) =>
  typeof v === "number" && !Number.isNaN(v) ? v.toFixed(1) : v;

// nicer Kp color scale
const kpColorFor = (kp) => {
  if (typeof kp !== "number" || Number.isNaN(kp)) return "#ff6f00"; // default orange
  if (kp >= 7) return "#b71c1c"; // very strong - deep red
  if (kp >= 5) return "#d84315"; // stormy - red/orange
  if (kp >= 3) return "#ff9800"; // moderate - orange
  return "#66bb6a"; // calm - green
};

const LSTMForecastTable = ({ data = [], onDataLoaded }) => {
  const [local, setLocal] = useState([]);

  useEffect(() => {
    const arr = Array.isArray(data) ? [...data] : [];
    // sort by date ascending, then take up to 27 items
    arr.sort((a, b) => new Date(a.date) - new Date(b.date));
    const sliced = arr.slice(0, 27);
    setLocal(sliced);
    if (onDataLoaded) onDataLoaded(sliced);
  }, [data, onDataLoaded]);

  if (!local || local.length === 0) {
    return (
      <Typography variant="h6" align="center" sx={{ mt: 4, color: "#777" }}>
        No forecast data available for the selected date range.
      </Typography>
    );
  }

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
        27-Day Space Weather Forecast
      </Typography>

      <Grid container spacing={3} justifyContent="center">
        {local.map((item, idx) => {
          const fluxRaw = item.f107 ?? item.radio_flux ?? null;
          const apRaw = item.a_index ?? item.ap_index ?? null;
          const kpRaw = item.kp_max ?? item.kp_index ?? null;

          // coerce to number if possible
          const flux = typeof fluxRaw === "number" ? fluxRaw : Number(fluxRaw);
          const apIndex = typeof apRaw === "number" ? apRaw : Number(apRaw);
          const kpIndex = typeof kpRaw === "number" ? kpRaw : Number(kpRaw);

          const displayFlux = formatNumber(flux);
          const displayAp = formatNumber(apIndex);
          const displayKp = formatNumber(kpIndex);

          const kpColor = kpColorFor(kpIndex);

          return (
            <Grid item xs={12} sm={6} md={4} key={item.date + "-" + idx}>
              <Card
                sx={{
                  backgroundColor: "#f9f9f9",
                  color: "#000",
                  borderRadius: 3,
                  boxShadow: "0 0 10px rgba(0,0,0,0.08)",
                }}
              >
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    <WbSunnyIcon sx={{ mr: 1, color: "gold" }} />
                    {formatDateUTC(item.date)}
                  </Typography>

                  <Typography variant="body2" gutterBottom sx={{ display: "flex", alignItems: "center" }}>
                    <SignalCellularAltIcon sx={{ mr: 1, color: "#00e5ff" }} />
                    <strong style={{ marginRight: 6 }}>Radio Flux:</strong>{" "}
                    <span>{displayFlux ?? "—"}</span>
                  </Typography>

                  <Typography variant="body2" gutterBottom sx={{ display: "flex", alignItems: "center" }}>
                    <WbSunnyIcon
                      sx={{
                        mr: 1,
                        color:
                          typeof apIndex === "number" && apIndex >= 20
                            ? "orange"
                            : "#64dd17",
                      }}
                    />
                    <strong style={{ marginRight: 6 }}>Ap Index:</strong>{" "}
                    <span>{displayAp ?? "—"}</span>
                  </Typography>

                  <Typography variant="body2" sx={{ display: "flex", alignItems: "center" }}>
                    <BoltIcon sx={{ mr: 1, color: kpColor }} />
                    <strong style={{ marginRight: 6 }}>Kp Index:</strong>{" "}
                    <span style={{ color: kpColor }}>{displayKp ?? "—"}</span>
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
