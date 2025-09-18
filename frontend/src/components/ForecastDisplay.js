// src/components/ForecastDisplay.js
import React, { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper
} from '@mui/material';
import './ForecastDisplay.css';
import { fetchJSON } from '../utils/api';

// Color coding based on Kp index severity
const getKpColor = (kpIndex) => {
  if (kpIndex >= 7) return '#e53935'; // red
  if (kpIndex >= 5) return '#fb8c00'; // orange
  if (kpIndex >= 3) return '#fdd835'; // yellow
  return '#43a047'; // green
};

const ForecastDisplay = () => {
  const [noaa, setNoaa] = useState([]);
  const [lstm, setLstm] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);

      const endpoints = [
        ['/api/predictions/27day', setNoaa],
        ['/api/predictions/lstm', setLstm]
      ];

      await Promise.all(
        endpoints.map(async ([path, setter]) => {
          try {
            const res = await fetchJSON(path);
            if (!mounted) return;
            if (Array.isArray(res)) setter(res);
            else setter([]);
          } catch (err) {
            console.warn(`Forecast fetch failed: ${path}`, err?.message || err);
            if (mounted) setter([]);
          }
        })
      );

      if (mounted) setLoading(false);
    }

    load();
    return () => { mounted = false; };
  }, []);

  if (loading) {
    return (
      <Typography variant="h6" align="center" sx={{ mt: 4, color: '#666' }}>
        Loading forecast data...
      </Typography>
    );
  }

  if ((!noaa || noaa.length === 0) && (!lstm || lstm.length === 0)) {
    return (
      <Typography variant="h6" align="center" sx={{ mt: 4, color: '#999' }}>
        No forecast data available.
      </Typography>
    );
  }

  const sortedNoaa = [...noaa].sort((a, b) => new Date(a.date) - new Date(b.date));
  const sortedLstm = [...lstm].sort((a, b) => new Date(a.date) - new Date(b.date));

  const ForecastCard = ({ day, source }) => (
    <Card
      sx={{
        backgroundColor: '#f5f5f5',
        color: 'black',
        borderRadius: 3,
        boxShadow: 5,
        height: '100%',
        transition: 'transform 0.18s',
        '&:hover': { transform: 'scale(1.03)', backgroundColor: '#eaeaea' }
      }}
    >
      <CardContent>
        <Typography variant="subtitle1">
          {new Date(day.date).toDateString()}
        </Typography>
        <Typography variant="body2" sx={{ mt: 0.5 }}>
          Radio Flux: <strong>{day.radio_flux ?? day.f107}</strong>
        </Typography>
        <Typography variant="body2">
          Ap Index: <strong>{day.ap_index ?? day.a_index}</strong>
        </Typography>
        <Typography variant="h6" sx={{ mt: 1 }}>
          Kp:{" "}
          <span style={{ color: getKpColor(day.kp_index ?? day.kp_max), fontWeight: '700' }}>
            {day.kp_index ?? day.kp_max}
          </span>
        </Typography>
        <Typography variant="caption" sx={{ display: 'block', mt: 1, color: '#666' }}>
          Source: {source.toUpperCase()}
        </Typography>
      </CardContent>
    </Card>
  );

  return (
    <Box sx={{ px: 2, py: 4, backgroundColor: '#ffffff', minHeight: '100vh', color: 'black' }}>
      <Typography variant="h4" align="center" gutterBottom sx={{ mb: 4, fontWeight: 'bold', color: '#0a0f2c' }}>
        27-Day Space Weather Forecast
      </Typography>

      {/* NOAA Section */}
      <Typography variant="h5" sx={{ mb: 2, color: '#0a3d62' }}>NOAA 27-day (live, shifted)</Typography>
      {sortedNoaa.length ? (
        <Grid container spacing={2} sx={{ mb: 4 }}>
          {sortedNoaa.map((d) => (
            <Grid item xs={12} sm={6} md={3} key={d.date}>
              <ForecastCard day={d} source="NOAA" />
            </Grid>
          ))}
        </Grid>
      ) : (
        <Typography sx={{ mb: 3, color: '#777' }}>NOAA forecast not available.</Typography>
      )}

      {/* LSTM Section */}
      <Typography variant="h5" sx={{ mb: 2, color: '#2d6a4f' }}>LSTM Future Forecast (starts after NOAA)</Typography>
      {sortedLstm.length ? (
        <Grid container spacing={2} sx={{ mb: 4 }}>
          {sortedLstm.map((d) => (
            <Grid item xs={12} sm={6} md={3} key={d.date}>
              <ForecastCard day={d} source="LSTM" />
            </Grid>
          ))}
        </Grid>
      ) : (
        <Typography sx={{ mb: 3, color: '#777' }}>
          No LSTM future forecasts found (will appear after LSTM run inserts them).
        </Typography>
      )}

      {/* Combined Table */}
      <TableContainer component={Paper} sx={{ backgroundColor: '#fafafa', mt: 3 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 'bold' }}>Date</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Radio Flux</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Ap</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Kp</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Source</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedNoaa.map((d) => (
              <TableRow key={`noaa-${d.date}`}>
                <TableCell>{new Date(d.date).toDateString()}</TableCell>
                <TableCell>{d.radio_flux ?? d.f107}</TableCell>
                <TableCell>{d.ap_index ?? d.a_index}</TableCell>
                <TableCell sx={{ color: getKpColor(d.kp_index ?? d.kp_max), fontWeight: 'bold' }}>
                  {d.kp_index ?? d.kp_max}
                </TableCell>
                <TableCell>NOAA</TableCell>
              </TableRow>
            ))}
            {sortedLstm.map((d) => (
              <TableRow key={`lstm-${d.date}`}>
                <TableCell>{new Date(d.date).toDateString()}</TableCell>
                <TableCell>{d.radio_flux ?? d.f107}</TableCell>
                <TableCell>{d.ap_index ?? d.a_index}</TableCell>
                <TableCell sx={{ color: getKpColor(d.kp_index ?? d.kp_max), fontWeight: 'bold' }}>
                  {d.kp_index ?? d.kp_max}
                </TableCell>
                <TableCell>LSTM</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default ForecastDisplay;
