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
import { fetchJSON } from '../utils/api';  // ✅ use helper

// Color coding based on Kp index severity
const getKpColor = (kpIndex) => {
  if (kpIndex >= 7) return '#e53935'; // red
  if (kpIndex >= 5) return '#fb8c00'; // orange
  if (kpIndex >= 3) return '#fdd835'; // yellow
  return '#43a047'; // green
};

const ForecastDisplay = () => {
  const [forecast, setForecast] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await fetchJSON('/api/predictions/27day');
        setForecast(data);
      } catch (err) {
        console.error("Error fetching forecast:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <Typography variant="h6" align="center" sx={{ mt: 4, color: '#ccc' }}>
        Loading forecast data...
      </Typography>
    );
  }

  if (!forecast?.length) {
    return (
      <Typography variant="h6" align="center" sx={{ mt: 4, color: '#ccc' }}>
        No forecast data available.
      </Typography>
    );
  }

  return (
    <Box
      sx={{
        px: 2,
        py: 4,
        backgroundColor: '#ffffff', // ✅ plain white background
        minHeight: '100vh',
        color: 'black'
      }}
    >
      <Typography
        variant="h4"
        align="center"
        gutterBottom
        sx={{ mb: 4, fontWeight: 'bold', color: '#0a0f2c' }}
      >
        27-Day Space Weather Forecast
      </Typography>

      {/* Cards Section */}
      <Grid container spacing={2} sx={{ mb: 6 }}>
        {forecast.map((day, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <Card
              sx={{
                backgroundColor: '#f5f5f5',
                color: 'black',
                borderRadius: 3,
                boxShadow: 5,
                height: '100%',
                transition: 'transform 0.3s',
                '&:hover': {
                  transform: 'scale(1.05)',
                  backgroundColor: '#e0e0e0'
                }
              }}
            >
              <CardContent>
                <Typography variant="subtitle1">
                  {new Date(day.date).toDateString()}
                </Typography>
                <Typography variant="h6" sx={{ mt: 1 }}>
                  Kp Index:{' '}
                  <span style={{ color: getKpColor(day.kp_index), fontWeight: 'bold' }}>
                    {day.kp_index}
                  </span>
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Table Section */}
      <TableContainer component={Paper} sx={{ backgroundColor: '#fafafa' }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 'bold' }}>Date</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Kp Index</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {forecast.map((day, index) => (
              <TableRow key={index}>
                <TableCell>
                  {new Date(day.date).toDateString()}
                </TableCell>
                <TableCell
                  sx={{ color: getKpColor(day.kp_index), fontWeight: 'bold' }}
                >
                  {day.kp_index}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default ForecastDisplay;
