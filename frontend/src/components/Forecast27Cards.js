// src/components/Forecast27Cards.js
import React, { useEffect, useState } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  CircularProgress
} from '@mui/material';
import { format } from 'date-fns';

// Emoji helper for Kp
const kpEmoji = (kp) => {
  if (kp >= 7) return '🌩️';
  if (kp >= 5) return '⚡';
  if (kp >= 3) return '🌤️';
  return '☀️';
};

export default function Forecast27Cards({ apiBase = '' }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const url = (apiBase || '') + '/api/predictions/27day';
    fetch(url)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(json => {
        const normalized = json.map(d => ({
          ...d,
          date: d.date ? new Date(d.date) : null
        })).sort((a, b) => {
          if (!a.date) return 1;
          if (!b.date) return -1;
          return new Date(a.date) - new Date(b.date);
        });
        setData(normalized);
      })
      .catch(err => {
        console.error('fetch error', err);
        setError(err.message);
      });
  }, [apiBase]);

  if (!data && !error) {
    return <Box display="flex" justifyContent="center" mt={4}><CircularProgress /></Box>;
  }
  if (error) {
    return <Box textAlign="center" color="error.main">Error: {error}</Box>;
  }
  if (!data.length) {
    return <Box textAlign="center">No forecast data available.</Box>;
  }

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h5" align="center" gutterBottom color="white">27-Day Space Weather Forecast</Typography>
      <Grid container spacing={2} justifyContent="center">
        {data.map((d, i) => (
          <Grid item key={i} xs={12} sm={6} md={4} lg={3}>
            <Card sx={{ bgcolor: 'rgba(0,0,0,0.65)', color: 'white', minHeight: 120 }}>
              <CardContent>
                <Typography variant="subtitle1" sx={{ fontWeight: '600' }}>
                  {d.date ? format(new Date(d.date), 'MMM dd, yyyy') : 'Unknown date'} {kpEmoji(d.kp_max)}
                </Typography>

                <Typography variant="body2" sx={{ mt: 1 }}>
                  📡 Radio Flux: <strong>{d.f107 ?? '—'}</strong>
                </Typography>
                <Typography variant="body2">
                  🧭 Ap Index: <strong>{d.a_index ?? '—'}</strong>
                </Typography>
                <Typography variant="body2">
                  ⚡ Kp Index: <strong>{d.kp_max ?? '—'}</strong>
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
